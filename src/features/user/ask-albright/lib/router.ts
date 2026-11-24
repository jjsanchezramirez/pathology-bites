/**
 * Ask Dr. Albright — sources, excerpting and answer prompts. Pure functions
 * only, so they are unit-testable without a model or the network. The
 * planning step (scope / source / query / focus / format) is in planner.ts.
 *
 * Token budget, measured on Workers AI (Nov 2026):
 *   planner ≈ 320 tokens (mistral-small, JSON)
 *   answer  ≈ 2–3k prompt tokens (3 whole passages), capped at ANSWER_MAX_TOKENS output
 */

import type { PathTalkTool } from "@/shared/services/pathtalk";

export type AskSource = "outlines" | "pubmed" | "who" | "literature";

export const SOURCE_TOOL: Record<AskSource, PathTalkTool> = {
  outlines: "search_pathology_outlines",
  pubmed: "search_path_pubmed",
  who: "search_who",
  literature: "search_path_literature",
};

export const SOURCE_LABEL: Record<AskSource, string> = {
  outlines: "PathologyOutlines",
  pubmed: "PubMed",
  who: "WHO Classification",
  literature: "Literature",
};

/**
 * Answer model, chosen on the same ~700-token prompt (Nov 2026): llama-3.1-8b
 * and llama-3.3-70b both inverted the chromophobe/oncocytoma KIT-CK7 pattern
 * that sat in the passages; mistral-small read it correctly at ~1–3s. Same
 * tokens, ~2x the 8b's price (~$0.0003 a question). gemma-4-26b returned empty.
 */
export const ANSWER_MODEL = "@cf/mistralai/mistral-small-3.1-24b-instruct";

export const MAX_QUESTION_CHARS = 300;
/** Passages the answer model sees, and the size of each (measured by the eval). */
export const PASSAGES = 3;
/**
 * Each passage is read whole up to this length. PathTalk chunks run ~1,800
 * chars and a page is often 2 chunks (~3,600): at 3,000 the secretory
 * carcinoma page was cut and the answer named ETV6-RET, not ETV6-NTRK3.
 */
export const PASSAGE_CHARS = 4500;
/** Searches per question at most: the planned corpus, then others only on a miss. */
export const MAX_SEARCHES = 3;
/** Excerpt length the reranker scores (it reads ~512 tokens per pair). */
export const RERANK_CHARS = 900;
/** Best reranker score below which a corpus "missed" and the fallback corpus is searched. */
export const RELEVANCE_MIN = 0.1;
/** PathTalk returns at most 3 hits per search, whatever the limit. */
export const SEARCH_LIMIT = 3;
/** Room for a short answer, list or small table plus the one-line follow-ups (~40 tokens). */
export const ANSWER_MAX_TOKENS = 360;

/**
 * Zero-token source guess for when the planner call fails. Only strong
 * signals move it off the textbook default.
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
  const words: string[] = question.toLowerCase().match(/[a-z0-9][a-z0-9-]*/g) ?? [];
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
  const lowerAll = words.map((w) => w.toLowerCase());
  const terms = questionTerms(question);
  // Rarer terms weigh more: "trps1" (3 mentions) must beat "carcinoma" (30),
  // or the window lands on whichever paragraph says "carcinoma" most.
  const weight = new Map(
    terms.map((t) => [t, 1 / Math.max(1, lowerAll.filter((w) => w.startsWith(t)).length)])
  );

  const windows = (size: number) => {
    const out: Array<{ start: number; end: number; covers: Set<string> }> = [];
    for (let start = 0; start < words.length; start += 8) {
      let end = start;
      let len = 0;
      while (end < words.length && len + words[end].length + 1 <= size)
        len += words[end++].length + 1;
      const seg = lowerAll.slice(start, end);
      out.push({
        start,
        end,
        covers: new Set(terms.filter((t) => seg.some((w) => w.startsWith(t)))),
      });
      if (end >= words.length) break;
    }
    return out;
  };
  const score = (covers: Set<string>, skip = new Set<string>()) =>
    [...covers].reduce((s, t) => (skip.has(t) ? s : s + (weight.get(t) ?? 0)), 0);
  // `>=`: of equally good windows keep the last, which starts at the matches
  // instead of ending on them (answers follow the keyword, not precede it).
  const best = <T extends { covers: Set<string> }>(ws: T[], skip?: Set<string>) =>
    ws.reduce((a, w) => (score(w.covers, skip) >= score(a.covers, skip) ? w : a), ws[0]);
  const render = (w: { start: number; end: number }) =>
    `${w.start > 0 ? "… " : ""}${words.slice(w.start, w.end).join(" ")}${w.end < words.length ? " …" : ""}`;

  const one = best(windows(max));
  // Two half-size windows when the second one adds question terms the first
  // missed (a page that names TRPS1 in two places sends both).
  const halves = windows(Math.floor(max / 2));
  const first = best(halves);
  const rest = halves.filter((w) => w.end <= first.start || w.start >= first.end);
  const second = rest.length ? best(rest, first.covers) : null;
  if (!second || score(second.covers, first.covers) === 0) return render(one);
  const [a, b] = first.start < second.start ? [first, second] : [second, first];
  return `${render(a)} ${render(b)}`.replace(/… …/g, "…");
}

/**
 * Answer instructions. The "not stated" line exists because, asked for a
 * comparison table, the model filled cells the sources never covered — it
 * wrote MEF2B "not expressed" in PMBL when its own source reported 14/15
 * positive. A gap must read as a gap.
 */
export const ANSWER_RULES =
  'You are Dr. Albright, a concise pathology tutor. Use only the numbered sources; read them fully and attribute each number or finding to the item it belongs to. A source answers the question even when worded differently (a percentage of cases staining positive answers a question about sensitivity). Cite as [1], [2], [3], in table cells too. Never fill a gap with a guess: write "not stated" for anything the sources do not say. If the sources do not answer the question, say so in one sentence. End with one line: "Follow-ups: <question> | <question>" — two short questions a pathology learner might ask next.';

/** True when an answer used (almost) its whole output budget, i.e. was cut off. */
export function hitTokenCap(
  completionTokens: number | undefined,
  cap = ANSWER_MAX_TOKENS
): boolean {
  return (completionTokens ?? 0) >= cap - 4;
}

/**
 * Collapse runs of spaces the model uses to align table columns (they cost
 * tokens and render as nothing), and trailing whitespace on each line.
 */
export function tidyAnswer(text: string): string {
  return text
    .split("\n")
    .map((l) => l.replace(/[ \t]{2,}/g, " ").trimEnd())
    .join("\n")
    .trim();
}

/**
 * Split the model's trailing "Follow-ups: a | b" line off the answer. The
 * follow-ups ride along in the same call (~40 tokens) rather than costing a
 * second one. Tolerates bold/bullet decoration and a missing line.
 */
export function splitFollowUps(text: string): { answer: string; followUps: string[] } {
  const m = text.match(/(?:^|\n)[ \t>*_-]*\**follow[- ]?ups?\**\s*:\**\s*([\s\S]+?)\s*$/i);
  if (!m) return { answer: text.trim(), followUps: [] };
  const followUps = m[1]
    .split(/\s*\|\s*|\n+/)
    .map((q) =>
      q
        .replace(/^[\s*\d.)-]+/, "")
        .replace(/\*+/g, "")
        .trim()
    )
    .filter((q) => q.length >= 8 && q.length <= 120)
    .slice(0, 3);
  return { answer: text.slice(0, m.index).trim(), followUps };
}

export function buildAnswerPrompt(
  question: string,
  passages: Array<{ title: string; text: string }>,
  /** e.g. "Same marker: CD117 = KIT." — so a column named KIT answers a question about CD117. */
  note = "",
  /** From the planner: what to look for in the sources. */
  focus = ""
): string {
  const sources = passages.map((p, i) => `[${i + 1}] ${p.title}: ${p.text}`).join("\n");
  return `Sources:\n${sources}\n\n${note ? `${note}\n` : ""}${focus ? `Look for: ${focus}\n` : ""}Question: ${question}`;
}
