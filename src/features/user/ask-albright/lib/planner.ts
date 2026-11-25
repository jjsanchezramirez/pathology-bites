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
import { KNOWN_STAINS } from "./tables";

export type AnswerFormat = "sentence" | "bullets" | "paragraph" | "table" | "marker";
export type PlanScope = "ok" | "off_topic" | "too_broad";

export interface Plan {
  scope: PlanScope;
  source: AskSource;
  /** Second corpus to try when the first one's passages miss the question. */
  fallback: AskSource;
  query: string;
  focus: string;
  format: AnswerFormat;
  /** For comparisons: the diagnoses compared, spelled out (each gets a passage). */
  items: string[];
}

/** Planner model (mistral-small made sound scope/source calls; llama-8b invented labels). */
export const PLANNER_MODEL = "@cf/mistralai/mistral-small-3.1-24b-instruct";

export const PLANNER_SYSTEM = `You plan answers for a pathology Q&A tool. Reply with JSON only:
{"scope":"ok"|"off_topic"|"too_broad","source":"who"|"outlines"|"pubmed"|"literature","fallback":"who"|"outlines"|"pubmed"|"literature","query":"...","focus":"...","format":"sentence"|"bullets"|"paragraph"|"table"|"marker","items":["..."]}
- scope: off_topic if not about pathology or medicine; too_broad only if it asks about 5 or more diagnoses at once, or for a whole organ system or field (\"explain all of soft tissue pathology\"). Comparing 2-4 diagnoses (e.g. a three-way IHC table) is ok.
- source: who = WHO classification, definitions, grading, diagnostic criteria; outlines = textbook morphology, immunostains, differentials, IHC panels; pubmed = study results, sensitivity/specificity, percentages, outcomes; literature = newer or detailed findings. fallback: the next best, different from source.
- query: 3-8 search words: diagnosis, marker, gene or feature names (expand abbreviations, correct misspellings, keep marker names). For a marker question: the marker name plus \"immunostain\".
- focus: what to look for in the sources, under 12 words. Never state an answer or a fact.
- format: marker when the question is about an immunostain itself (what it stains, where it is positive or negative), not about one diagnosis; table for comparing 2+ items, including any \"X vs Y\"; bullets for lists; sentence for a single fact; else paragraph. Marker questions use source outlines.
- items: when comparing diagnoses, each one's full name, misspellings corrected; [] otherwise.`;

const COMPARES = /\b(compare|comparison|versus|vs\.?|table|differ|difference|distinguish)\b/i;
const YES_NO = /^\s*(is|are|does|do|can|could|should|was|were|has|have)\b/i;

/** A marker name in the question: CD99, TTF-1, S100, p63, SOX10… or desmin, calretinin. */
export function namesMarker(question: string): boolean {
  return (question.match(/[A-Za-z0-9][A-Za-z0-9-]*/g) ?? []).some(
    (w) => (/[a-z]/i.test(w) && /\d/.test(w)) || KNOWN_STAINS.has(w.toLowerCase())
  );
}

const SOURCES: AskSource[] = ["who", "outlines", "pubmed", "literature"];
const FORMATS: AnswerFormat[] = ["sentence", "bullets", "paragraph", "table", "marker"];
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
    items: [],
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
  const items = Array.isArray(j.items)
    ? j.items
        .filter((x): x is string => typeof x === "string")
        .map((x) => x.trim())
        .filter((x) => x.length >= 3 && x.length <= 80)
        .slice(0, 4)
    : [];
  let format = pick(j.format, FORMATS, base.format);
  // A table only for real comparisons. With `items` in the schema the planner
  // started tabulating yes/no questions ("Is CD117 positive in oncocytoma?" →
  // a table of "PPV: not stated" rows).
  // A yes/no question gets a direct answer unless a table was asked for: "Are
  // MEF2B and J chain useful in distinguishing NLPHL from CHL?" became a table.
  if (format === "table" && YES_NO.test(question) && !/\btable\b/i.test(question)) {
    format = "sentence";
  } else if (format === "table" && items.length < 2 && !COMPARES.test(question)) {
    format = "paragraph";
  } else if (format === "marker" && !namesMarker(question)) {
    // "Reed Sternberg cell markers" asks about a cell, not a marker: the
    // four marker groups came back as "Positive — normal tissue: None".
    format = "bullets";
  } else if (
    (format === "paragraph" || format === "bullets") &&
    /\b(vs\.?|versus)\b/i.test(question) &&
    !YES_NO.test(question)
  ) {
    // An explicit "X vs Y" reads best as a table ("necrotizing vs
    // non-necrotizing granuloma causes" came back as a paragraph).
    format = "table";
  }
  return { scope, source, fallback, query, focus, format, items };
}

/** What Dr. Albright says instead of searching, for out-of-scope questions. */
export const SCOPE_REPLY: Record<Exclude<PlanScope, "ok">, string> = {
  off_topic:
    "I can only help with pathology questions. Try asking about a diagnosis, stain or finding.",
  too_broad:
    "That covers a lot at once. Try up to four diagnoses at a time, e.g. a specific differential or IHC panel.",
};

/** The answer instruction for each format. */
export const FORMAT_INSTRUCTION: Record<AnswerFormat, string> = {
  sentence: "Answer in one or two sentences. No tables.",
  bullets:
    'Answer as short bullets ("- "). Group them under short bold labels on their own line ("**Label:**") that name what the group is, chosen from the question; skip labels if one group is enough. Keep each bullet to the item and its key detail. Never list an item in more than one group, and leave out items the sources do not mention. No tables.',
  paragraph:
    "Answer in a short paragraph of at most 4 short sentences; the first sentence answers the question directly. No tables.",
  // Marker questions get the four groups a pathologist looks for (the order
  // PathologyOutlines' stain pages use): asked "TTF-1 positive tumors", the
  // answer had wandered through thymic carcinoma and mucicarmine instead.
  marker:
    'Answer as short bullets ("- ") under these bold labels, in this order, each on its own line: "**Positive — normal tissue:**", "**Negative — normal tissue:**", "**Positive — tumors:**", "**Negative — tumors:**". One tissue or tumor per bullet with its key detail (pattern, % if given). Omit a label the sources say nothing about. No other labels, no tables.',
  table:
    "Answer as a compact Markdown table: at most 5 columns and 8 rows, cells under 10 words, no padding or alignment spaces (rows = items, columns = features). Cite in the cells too; write 'not stated' in any cell the sources do not cover, and in every cell for an item no source covers. Then one sentence that answers the question directly.",
};

/** The answer model's system prompt: shared rules plus the planned format. */
export function answerSystem(format: AnswerFormat): string {
  return `${ANSWER_RULES} ${FORMAT_INSTRUCTION[format]}`;
}
