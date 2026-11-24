/**
 * Ask Dr. Albright — the planning step. One small JSON call decides, before
 * any search:
 *   1. scope   — is this a pathology question narrow enough to answer?
 *   2. source  — which corpus answers it best (and a fallback)
 *   3. query   — clean search words (names, not prose)
 *   4. focus   — what to look for in the passages
 *   5. format  — sentence, bullets, paragraph or table
 *
 * Fewer, better-aimed searches beat more searches: PathTalk works through
 * searches about one at a time (~0.8 s each), so every extra one costs every
 * user latency. The tokens go into reading instead (see ask.ts).
 *
 * `focus` is phrased as what to LOOK FOR, never an answer: a first draft let
 * the planner write its own guess ("CD117 is negative in oncocytoma", wrong),
 * which would have steered the answer toward it.
 *
 * Pure parsing/validation lives here; the model call is in ask.ts.
 */

import { ANSWER_RULES, type AskSource, heuristicSource } from "./router";

export type AnswerFormat = "sentence" | "bullets" | "paragraph" | "table";
export type PlanScope = "ok" | "off_topic" | "too_broad";

export interface Plan {
  scope: PlanScope;
  source: AskSource;
  /** Second corpus to try when the first one's passages miss the question. */
  fallback: AskSource;
  query: string;
  focus: string;
  format: AnswerFormat;
}

/** Planner model (mistral-small made sound scope/source calls; llama-8b invented labels). */
export const PLANNER_MODEL = "@cf/mistralai/mistral-small-3.1-24b-instruct";

export const PLANNER_SYSTEM = `You plan answers for a pathology Q&A tool. Reply with JSON only:
{"scope":"ok"|"off_topic"|"too_broad","source":"who"|"outlines"|"pubmed"|"literature","fallback":"who"|"outlines"|"pubmed"|"literature","query":"...","focus":"...","format":"sentence"|"bullets"|"paragraph"|"table"}
- scope: off_topic if not about pathology or medicine; too_broad if it asks about 3 or more diagnoses at once or for a whole field; else ok.
- source: who = WHO classification, definitions, grading, diagnostic criteria; outlines = textbook morphology, immunostains, differentials, IHC panels; pubmed = study results, sensitivity/specificity, percentages, outcomes; literature = newer or detailed findings. fallback: the next best, different from source.
- query: 3-8 search words: diagnosis, marker, gene or feature names (expand abbreviations, keep marker names).
- focus: what to look for in the sources, under 12 words. Never state an answer or a fact.
- format: table only for comparing 2+ items across features; bullets for lists; sentence for a single fact; else paragraph.`;

const SOURCES: AskSource[] = ["who", "outlines", "pubmed", "literature"];
const FORMATS: AnswerFormat[] = ["sentence", "bullets", "paragraph", "table"];
const SCOPES: PlanScope[] = ["ok", "off_topic", "too_broad"];

/** The plan used when the planner call fails or returns junk: search as asked. */
export function fallbackPlan(question: string): Plan {
  const source = heuristicSource(question);
  return {
    scope: "ok",
    source,
    fallback: source === "outlines" ? "pubmed" : "outlines",
    query: question,
    focus: "",
    format: /\b(compare|versus|vs\.?|table)\b/i.test(question) ? "table" : "paragraph",
  };
}

/**
 * Validate the planner's JSON into a Plan. Anything missing or out of range
 * falls back field by field, so a half-good plan still helps.
 */
export function parsePlan(raw: string, question: string): Plan {
  const base = fallbackPlan(question);
  let j: Record<string, unknown>;
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    j = m ? JSON.parse(m[0]) : {};
  } catch {
    return base;
  }
  const pick = <T extends string>(v: unknown, allowed: readonly T[], dflt: T): T =>
    typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : dflt;
  const scope = pick(j.scope, SCOPES, "ok");
  const source = pick(j.source, SOURCES, base.source);
  let fallback = pick(j.fallback, SOURCES, base.fallback);
  if (fallback === source) fallback = source === "outlines" ? "pubmed" : "outlines";
  const query =
    typeof j.query === "string" && j.query.trim().length >= 3
      ? j.query.trim().slice(0, 120)
      : question;
  const focus = typeof j.focus === "string" ? j.focus.trim().slice(0, 120) : "";
  return { scope, source, fallback, query, focus, format: pick(j.format, FORMATS, base.format) };
}

/** What Dr. Albright says instead of searching, for out-of-scope questions. */
export const SCOPE_REPLY: Record<Exclude<PlanScope, "ok">, string> = {
  off_topic:
    "I can only help with pathology questions. Try asking about a diagnosis, stain or finding.",
  too_broad:
    "That covers a lot at once. Try one or two diagnoses at a time, e.g. a specific differential or panel.",
};

/** The answer instruction for each format. */
export const FORMAT_INSTRUCTION: Record<AnswerFormat, string> = {
  sentence: "Answer in one or two sentences.",
  bullets:
    'Answer as short bullets ("- "). Group them under bold labels on their own line (e.g. "**Positive:**", "**Negative:**"), one label per group; keep each bullet to the item and its key detail. Never list an item in more than one group, and leave out items the sources do not mention (no "not stated" group).',
  paragraph: "Answer in a short paragraph of at most 4 sentences.",
  table:
    "Answer as a compact Markdown table: at most 4 columns and 6 rows, cells under 10 words, no padding or alignment spaces (rows = items, columns = features). Then one sentence that answers the question directly.",
};

/** The answer model's system prompt: shared rules plus the planned format. */
export function answerSystem(format: AnswerFormat): string {
  return `${ANSWER_RULES} ${FORMAT_INSTRUCTION[format]}`;
}
