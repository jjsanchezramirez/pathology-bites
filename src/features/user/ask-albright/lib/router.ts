/**
 * Ask Dr. Albright — source routing and prompt building. Pure functions only,
 * so the cheap parts are unit-testable without a model or the network.
 *
 * Token budget, measured on Workers AI (Nov 2026):
 *   router  ≈ 94 prompt tokens + 1 output token  (llama-3.2-3b, 8/8 on a probe set)
 *   answer  ≈ 450–600 prompt tokens, capped at ANSWER_MAX_TOKENS output
 */

import type { PathTalkTool } from "@/shared/services/pathtalk";

export type AskSource = "outlines" | "pubmed" | "who";

export const SOURCE_TOOL: Record<AskSource, PathTalkTool> = {
  outlines: "search_pathology_outlines",
  pubmed: "search_path_pubmed",
  who: "search_who",
};

export const SOURCE_LABEL: Record<AskSource, string> = {
  outlines: "PathologyOutlines",
  pubmed: "PubMed",
  who: "WHO Classification",
};

/**
 * Router model. llama-3.2-1b was the first choice but Cloudflare retired it on
 * 2026-11-20 (now answers 410/5028). The 3b scored 8/8 on the probe set where
 * llama-3.1-8b-fast scored 5/8 with the same prompt.
 */
export const ROUTER_MODEL = "@cf/meta/llama-3.2-3b-instruct";
/**
 * Answer model, chosen on the same ~700-token prompt (Nov 2026): llama-3.1-8b
 * and llama-3.3-70b both inverted the chromophobe/oncocytoma KIT-CK7 pattern
 * that sat in the passages; mistral-small read it correctly at ~1–3s. Same
 * tokens, ~2x the 8b's price (~$0.0003 a question). gemma-4-26b returned empty.
 */
export const ANSWER_MODEL = "@cf/mistralai/mistral-small-3.1-24b-instruct";

export const MAX_QUESTION_CHARS = 300;
export const PASSAGES = 3;
export const PASSAGE_CHARS = 600;
export const ANSWER_MAX_TOKENS = 220;

const LETTER_TO_SOURCE: Record<string, AskSource> = { A: "outlines", B: "pubmed", C: "who" };

/** One-letter multiple choice: the shortest prompt the small model labels reliably. */
export function buildRouterPrompt(question: string): string {
  return [
    "Pick a source for this pathology question.",
    "A: textbook (morphology, stains, differentials)",
    "B: PubMed (studies, outcomes, statistics)",
    "C: WHO (classification, grading, definitions)",
    `Q: ${question}`,
    "Reply with one letter.",
  ].join("\n");
}

/** Map the model's reply to a source, or null when it said something else. */
export function parseRouterReply(reply: string): AskSource | null {
  const m = reply.trim().match(/^[("'*\s]*([ABC])\b/i);
  return m ? LETTER_TO_SOURCE[m[1].toUpperCase()] : null;
}

/**
 * Zero-token fallback when the router call fails or answers off-format. Only
 * strong signals move it off the textbook default.
 */
export function heuristicSource(question: string): AskSource {
  const q = question.toLowerCase();
  if (/\bwho\b|classification|\bgrad(e|ing)\b|nomenclature|definition|essential criteria/.test(q))
    return "who";
  if (
    /\bstud(y|ies)\b|trial|surviv|prognos|incidence|prevalence|outcome|recent|meta-analysis/.test(q)
  )
    return "pubmed";
  return "outlines";
}

/** Normalise for the cache key: case, whitespace and trailing punctuation don't change the answer. */
export function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[?.!\s]+$/, "");
}

const STOPWORDS = new Set(
  "a an and are as at be by can do does for from how in is it its of on or the to vs what when where which who whom why with versus between from".split(
    " "
  )
);

/** Content words of the question, for scoring passage windows. */
export function questionTerms(question: string): string[] {
  const words = question.toLowerCase().match(/[a-z0-9][a-z0-9-]*/g) ?? [];
  return [...new Set(words.filter((w) => w.length > 1 && !STOPWORDS.has(w)))];
}

/**
 * The `max`-character stretch of a passage most about the question. PathTalk
 * returns ~1,800-character chunks whose answering sentence is often mid-chunk
 * (WHO's "Grading:" paragraph starts ~400 chars in), so keeping the head throws
 * the answer away. Slides a word window, scores it by distinct question terms
 * (prefix match, so "stain" hits "staining"), keeps the best. Zero tokens.
 */
export function relevantExcerpt(body: string, question: string, max = PASSAGE_CHARS): string {
  const flat = body.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const words = flat.split(" ");
  const terms = questionTerms(question);

  let best = { start: 0, end: 0, score: -1 };
  for (let start = 0; start < words.length; start += 8) {
    let end = start;
    let len = 0;
    while (end < words.length && len + words[end].length + 1 <= max) len += words[end++].length + 1;
    const lower = words.slice(start, end).map((w) => w.toLowerCase());
    const score = terms.filter((t) => lower.some((w) => w.startsWith(t))).length;
    // `>=`: of equally good windows keep the last, which starts at the matches
    // instead of ending on them (answers follow the keyword, not precede it).
    if (score >= best.score) best = { start, end, score };
    if (end >= words.length) break;
  }
  const text = words.slice(best.start, best.end).join(" ");
  return `${best.start > 0 ? "… " : ""}${text}${best.end < words.length ? " …" : ""}`;
}

export const ANSWER_SYSTEM =
  "You are Dr. Albright, a concise pathology tutor. Answer in at most 4 sentences using only the numbered sources. Cite as [1], [2], [3]. If the sources do not answer the question, say so in one sentence.";

export function buildAnswerPrompt(
  question: string,
  passages: Array<{ title: string; text: string }>
): string {
  const sources = passages.map((p, i) => `[${i + 1}] ${p.title}: ${p.text}`).join("\n");
  return `Sources:\n${sources}\n\nQuestion: ${question}`;
}
