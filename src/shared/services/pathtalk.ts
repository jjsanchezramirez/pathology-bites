import "server-only";

/**
 * PathTalk retrieval over plain HTTP, for app routes.
 *
 * PathTalk (api.pathtalk.io) is the MCP server the editor uses for WHO /
 * PathologyOutlines / PubMed search. It speaks MCP Streamable HTTP with no
 * auth, so a route can call it directly. This is the TypeScript twin of the
 * pipeline client `dev/resources/who_classification/lib/pathtalk.mjs`, which
 * lives in the untracked WHO pipeline and cannot be imported by the app. Keep
 * the protocol notes in step with that file:
 *
 * - The trailing slash matters: `/mcp` 307s and a POST will not follow.
 * - `Accept` must list both JSON and SSE, or the server answers 406.
 * - `initialize` returns the session in the `mcp-session-id` response header;
 *   every later request carries it, after a `notifications/initialized`.
 * - Replies are SSE frames even when single — pull the `data:` lines.
 * - Results are double-encoded: `result.content[]` text blocks whose `text` is
 *   itself JSON `{title, source, href, body}` (or an array of them).
 */

const ENDPOINT = "https://api.pathtalk.io/mcp/";
const HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
};

export type PathTalkTool =
  | "search_pathology_outlines"
  | "search_path_pubmed"
  | "search_who"
  | "search_path_literature";

export interface PathTalkHit {
  title: string;
  source?: string;
  href: string;
  body: string;
}

export function parseSse(text: string): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const line of text.split("\n")) {
    if (!line.startsWith("data:")) continue;
    try {
      out.push(JSON.parse(line.slice(5).trim()));
    } catch {
      /* keep-alive or partial frame */
    }
  }
  return out;
}

/** Unwrap a tools/call frame into hits. Exported for tests. */
export function hitsFromFrames(frames: Array<Record<string, unknown>>): PathTalkHit[] {
  const frame = frames.find((f) => f.result || f.error) as
    | {
        result?: { content?: Array<{ type: string; text?: string }> };
        error?: { message?: string };
      }
    | undefined;
  // No result frame is a truncated or dropped reply, not "nothing found" —
  // treating it as [] silently lost PubMed from an answer. Throw so it retries.
  if (!frame) throw new Error("pathtalk: no result frame");
  if (frame.error) throw new Error(`pathtalk: ${frame.error.message ?? "tool error"}`);
  const out: PathTalkHit[] = [];
  for (const c of frame.result?.content ?? []) {
    if (c.type !== "text" || !c.text) continue;
    try {
      const parsed = JSON.parse(c.text);
      for (const item of Array.isArray(parsed) ? parsed : [parsed]) {
        if (item && typeof item.href === "string" && typeof item.body === "string") {
          out.push({
            title: String(item.title ?? ""),
            source: item.source,
            href: item.href,
            body: item.body,
          });
        }
      }
    } catch {
      /* not a JSON block */
    }
  }
  return out;
}

async function post(body: unknown, session: string | null, timeoutMs: number): Promise<Response> {
  return fetch(ENDPOINT, {
    method: "POST",
    headers: session ? { ...HEADERS, "mcp-session-id": session } : HEADERS,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

// Fluid Compute reuses instances, so one session serves many requests. It is
// held as a promise so concurrent searches share ONE in-flight initialize:
// letting each parallel search connect on its own (and reconnect on any error)
// stampeded PathTalk with ~24 initializes per burst and timed them all out.
let sessionPromise: Promise<string> | null = null;

function getSession(timeoutMs: number): Promise<string> {
  sessionPromise ??= connect(timeoutMs).catch((err) => {
    sessionPromise = null;
    throw err;
  });
  return sessionPromise;
}

async function connect(timeoutMs: number): Promise<string> {
  const res = await post(
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "pathology-bites-app", version: "1" },
      },
    },
    null,
    timeoutMs
  );
  if (!res.ok) throw new Error(`pathtalk initialize: HTTP ${res.status}`);
  const session = res.headers.get("mcp-session-id");
  await res.text();
  if (!session) throw new Error("pathtalk initialize: no mcp-session-id");
  await post({ jsonrpc: "2.0", method: "notifications/initialized" }, session, timeoutMs);
  return session;
}

let nextId = 100;

async function callTool(
  session: string,
  tool: PathTalkTool,
  query: string,
  limit: number,
  timeoutMs: number
): Promise<PathTalkHit[]> {
  const res = await post(
    {
      jsonrpc: "2.0",
      id: nextId++,
      method: "tools/call",
      params: { name: tool, arguments: { query, limit } },
    },
    session,
    timeoutMs
  );
  if (!res.ok) throw new Error(`pathtalk ${tool}: HTTP ${res.status}`);
  return hitsFromFrames(parseSse(await res.text()));
}

/**
 * Search one PathTalk corpus. Reuses the instance's session; on any failure
 * (stale session 4xx, dropped reply, timeout) reconnects and tries once more.
 */
export async function searchPathTalk(
  tool: PathTalkTool,
  query: string,
  { limit = 3, timeoutMs = 8_000 }: { limit?: number; timeoutMs?: number } = {}
): Promise<PathTalkHit[]> {
  const current = getSession(timeoutMs);
  try {
    return await callTool(await current, tool, query, limit, timeoutMs);
  } catch {
    // Drop the session only if nobody has replaced it yet, so a burst of
    // failures triggers one reconnect, not one each.
    if (sessionPromise === current) sessionPromise = null;
    return callTool(await getSession(timeoutMs), tool, query, limit, timeoutMs);
  }
}
