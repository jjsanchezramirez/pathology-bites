import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@/shared/utils/logging", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { streamOpenAICompatText } from "@/shared/services/openai-compat";

/** A fetch Response whose body is these SSE lines, split across awkward chunk boundaries. */
function sse(lines: string[]): Response {
  const text = lines.map((l) => `data: ${l}\n\n`).join("");
  const bytes = new TextEncoder().encode(text);
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (let i = 0; i < bytes.length; i += 7) c.enqueue(bytes.slice(i, i + 7));
      c.close();
    },
  });
  return new Response(body, { status: 200 });
}

const chunk = (content: unknown) => JSON.stringify({ choices: [{ delta: { content } }] });

describe("streamOpenAICompatText", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps digit-only tokens Workers AI sends as JSON numbers (V600E, CD10)", async () => {
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "acct");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sse([
          chunk("BRAF V"),
          chunk(6),
          chunk(0),
          chunk(0),
          chunk("E; CD1"),
          chunk(0),
          chunk(null),
          JSON.stringify({
            choices: [{ delta: {}, finish_reason: "stop" }],
            usage: { prompt_tokens: 9, completion_tokens: 6, total_tokens: 15, neurons: 0.7 },
          }),
          "[DONE]",
        ])
      )
    );
    let text = "";
    let usage: unknown;
    for await (const c of streamOpenAICompatText("cloudflare", "@cf/x", "key", "q")) {
      if ("delta" in c) text += c.delta;
      else usage = c.usage;
    }
    expect(text).toBe("BRAF V600E; CD10");
    expect(usage).toEqual({
      prompt_tokens: 9,
      completion_tokens: 6,
      total_tokens: 15,
      neurons: 0.7,
    });
  });

  it("asks for a stream with usage, and throws on an HTTP error", async () => {
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "acct");
    const fetchMock = vi.fn(async () => new Response("overloaded", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    const run = async () => {
      for await (const _ of streamOpenAICompatText("cloudflare", "@cf/x", "key", "q", {
        system: "sys",
        maxTokens: 50,
      }));
    };
    await expect(run()).rejects.toThrow(/503/);
    const body = JSON.parse(
      (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string
    );
    expect(body).toMatchObject({
      stream: true,
      stream_options: { include_usage: true },
      max_completion_tokens: 50,
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: "q" },
      ],
    });
  });
});
