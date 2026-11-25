import "server-only";

import { getApiKey } from "@/shared/config/ai-keys";

/**
 * Cross-encoder reranking on Workers AI (@cf/baai/bge-reranker-base).
 *
 * The term-coverage heuristic in rank.ts decides which pages mention the
 * question's words; a cross-encoder reads question and passage together and
 * scores whether the passage answers it. It costs ~$0.003 per million input
 * tokens — a dozen 900-character excerpts is a few thousand tokens, i.e.
 * effectively free next to the answer call.
 *
 * Not OpenAI-compatible, so it uses the native `ai/run` endpoint rather than
 * the shared openai-compat caller.
 */
export const RERANK_MODEL = "@cf/baai/bge-reranker-base";

/** Scores aligned with `texts` (higher = more relevant). Throws on any failure. */
export async function rerankScores(
  query: string,
  texts: string[],
  { timeoutMs = 4000 }: { timeoutMs?: number } = {}
): Promise<number[]> {
  if (texts.length === 0) return [];
  const account =
    process.env.CLOUDFLARE_ACCOUNT_ID || process.env.NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_ID;
  const key = getApiKey("cloudflare");
  if (!account || !key) throw new Error("rerank: Workers AI not configured");

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${RERANK_MODEL}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, contexts: texts.map((text) => ({ text })) }),
      signal: AbortSignal.timeout(timeoutMs),
    }
  );
  if (!res.ok) throw new Error(`rerank: HTTP ${res.status}`);
  const data = (await res.json()) as {
    result?: { response?: Array<{ id: number; score: number }> };
  };
  const scores = new Array<number>(texts.length).fill(-Infinity);
  for (const r of data.result?.response ?? []) {
    if (r.id >= 0 && r.id < texts.length) scores[r.id] = r.score;
  }
  if (scores.every((s) => s === -Infinity)) throw new Error("rerank: empty response");
  return scores;
}
