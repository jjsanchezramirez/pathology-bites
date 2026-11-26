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
export type PlanScope = "ok" | "chat" | "off_topic" | "too_broad";
/**
 * The one visual an answer may carry — the cascade (ask.ts resolves it):
 *   diagram → a Mermaid flowchart of the answer's steps; if it fails, a published figure
 *   images  → the site's own image library;              if none match, a published figure
 *   none    → nothing (most questions; no extra lookups)
 */
export type PlanVisual = "diagram" | "images" | "none";

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
  /** Which visual, if any (see PlanVisual). */
  visual: PlanVisual;
}

/**
 * Planner model. gpt-oss-20b (Nov 2026): 0.6–1.1 s against mistral-small's
 * 1.2–3 s on the same prompt (the plan holds up the answer's first token), and
 * ~40% cheaper. mistral-small made sound scope/source calls too; llama-8b
 * invented labels.
 */
export const PLANNER_MODEL = "@cf/openai/gpt-oss-20b";
/** Asked too when the planner is slow (see planQuestion): a different model, so a stall in one rarely hits both. */
export const PLANNER_HEDGE_MODEL = "@cf/mistralai/mistral-small-3.1-24b-instruct";

export const PLANNER_SYSTEM = `You plan answers for a pathology Q&A tool. Reply with JSON only:
{"scope":"ok"|"chat"|"off_topic"|"too_broad","source":"who"|"outlines"|"pubmed"|"literature","fallback":"who"|"outlines"|"pubmed"|"literature","query":"...","focus":"...","format":"sentence"|"bullets"|"paragraph"|"table"|"marker","items":["..."],"visual":"diagram"|"images"|"none"}
- scope: chat only for greetings, thanks or small talk with no pathology in it; any question about a disease, finding, stain or test is ok. off_topic only if clearly not about pathology or medicine and not small talk. A bare term, eponym, named algorithm, score, classification or test (a person's name followed by "algorithm", "criteria", "classification") is ok: assume the pathology meaning. too_broad only if it asks about 5 or more diagnoses at once, or for a whole organ system or field (\"explain all of soft tissue pathology\"). Comparing 2-4 diagnoses (e.g. a three-way IHC table) is ok.
- source: who = WHO classification, definitions, grading, diagnostic criteria; outlines = textbook morphology, immunostains, differentials, IHC panels; pubmed = study results, sensitivity/specificity, percentages, outcomes; literature = newer or detailed findings. fallback: the next best, different from source.
- query: 3-8 search words: diagnosis, marker, gene or feature names (expand abbreviations, correct misspellings, keep marker names). For a marker question: the marker name plus \"immunostain\".
- focus: what to look for in the sources, under 12 words. Never state an answer or a fact.
- format: marker when the question is about an immunostain itself (what it stains, where it is positive or negative), not about one diagnosis; table for comparing 2+ items, including any \"X vs Y\"; bullets for lists; sentence for a single fact; else paragraph. Marker questions use source outlines.
- visual: diagram when the question asks for a stepwise algorithm, decision tree, workup or classification scheme; images when it asks what something looks like (histology, gross, cytology, morphology); none otherwise (most questions).
- items: when comparing diagnoses, each one's full name, misspellings corrected; [] otherwise.`;

const VISUALS: PlanVisual[] = ["diagram", "images", "none"];

/** The visual clear wording asks for (it overrides the planner); none when the wording isn't clear. */
function heuristicVisual(question: string): PlanVisual {
  if (/\b(algorithm|work-?up|flow ?chart|decision tree|approach to|stepwise)\b/i.test(question))
    return "diagram";
  if (
    /\b(look(s)? like|appearance|histolog(y|ic)|morpholog(y|ic)|gross|cytolog(y|ic))\b/i.test(
      question
    )
  )
    return "images";
  return "none";
}

const COMPARES = /\b(compare|comparison|versus|vs\.?|table|differ|difference|distinguish)\b/i;
const YES_NO = /^\s*(is|are|does|do|can|could|should|was|were|has|have)\b/i;

/** A marker name in the question: CD99, TTF-1, S100, p63, SOX10… or desmin, calretinin. */
export function namesMarker(question: string): boolean {
  return (question.match(/[A-Za-z0-9][A-Za-z0-9-]*/g) ?? ([] as string[])).some(
    (w) => (/[a-z]/i.test(w) && /\d/.test(w)) || KNOWN_STAINS.has(w.toLowerCase())
  );
}

const SOURCES: AskSource[] = ["who", "outlines", "pubmed", "literature"];
const FORMATS: AnswerFormat[] = ["sentence", "bullets", "paragraph", "table", "marker"];
const SCOPES: PlanScope[] = ["ok", "chat", "off_topic", "too_broad"];

/** Greetings and questions about the assistant or the site: chat, even when the planner fails. */
const CHAT =
  /^\s*(hi|hey|hello|hiya|yo|good (morning|afternoon|evening)|thanks|thank you|how are you|how's it going|what'?s up|what'?s on your mind|who (are you|made|built|developed|created|runs)|what are you|what'?s your name|what is your name|tell me about (yourself|you)|nice to meet you|good ?bye|bye)\b/i;

/**
 * Short small talk ("Hi", "How are you?") or a question about who made the
 * site. A greeting in front of a real question ("Hi, what does a granular cell
 * tumor look like?") is left to the planner.
 */
export function isChat(question: string): boolean {
  if (!CHAT.test(question)) return false;
  const words = question.trim().split(/\s+/).length;
  return words <= 6 || /^\s*who (made|built|developed|created|runs)\b/i.test(question);
}

/** The plan used when the planner call fails or returns junk: search as asked. */
export function fallbackPlan(question: string): Plan {
  const source = heuristicSource(question);
  return {
    scope: isChat(question) ? "chat" : "ok",
    source,
    fallback: source === "outlines" ? "pubmed" : "outlines",
    query: question,
    focus: "",
    format: /\b(compare|versus|vs\.?|table)\b/i.test(question) ? "table" : "paragraph",
    items: [],
    visual: heuristicVisual(question),
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
  // Chat is decided by wording alone, both ways: "Hi" is chat whatever the
  // planner says, and the planner can never make a question chat — it called
  // "What does diffuse large B-cell lymphoma look like?" chat, and the reply
  // answered pathology from memory, without sources.
  const picked = pick(j.scope, SCOPES, "ok");
  const scope = isChat(question) ? "chat" : picked === "chat" ? "ok" : picked;
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
  } else if (format === "marker" && YES_NO.test(question)) {
    // "Is CD117 positive in renal oncocytoma?" asks about one pairing, not the
    // stain's whole profile. gpt-oss-20b (the planner since Nov 2026) chose
    // the four-group marker format for these; its large output reserve left
    // the passages too little of the cost budget and one answer read
    // "CD117 is negative in renal oncocytoma".
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
  // Clear wording always decides ("algorithm", "looks like"): the planner said
  // "none" for "Hans algorithm for DLBCL". It only adds a visual for wording
  // the keywords miss.
  let visual = base.visual !== "none" ? base.visual : pick(j.visual, VISUALS, "none");
  // One visual per answer: a table, or a diagram, images or a figure — never
  // two. A question that asks for a table or a comparison keeps its table;
  // otherwise the visual wins and the table becomes bullets.
  if (visual !== "none" && format === "table") {
    if (COMPARES.test(question)) visual = "none";
    else format = "bullets";
  }
  return { scope, source, fallback, query, focus, format, items, visual };
}

/** What Dr. Albright says instead of searching, for out-of-scope questions. */
export const SCOPE_REPLY: Record<Exclude<PlanScope, "ok" | "chat">, string> = {
  off_topic:
    "I can only help with pathology questions. Try asking about a diagnosis, stain or finding.",
  too_broad:
    "That covers a lot at once. Try up to four diagnoses at a time, e.g. a specific differential or IHC panel.",
};

/**
 * Small talk. Facts here are only what the site's About page says (including
 * the founder credit the owner approved, Nov 2026: name, MD, hematopathology
 * fellow, no institution); anything else must not be made up.
 */
export const CHAT_SYSTEM =
  "You are Dr. Albright, the friendly pathology tutor on Pathology Bites, a free pathology education site with practice questions, explanations and study tools. It grew out of pathology residents sharing study materials; it was founded by Dr. Juan Jose Sanchez Ramirez, a hematopathology fellow, and is built with the pathology community. Reply in one to three short, warm sentences, in character, and end by inviting a pathology question. If asked who made you or the site, say the site was founded by Dr. Juan Jose Sanchez Ramirez and is built with the pathology community, that you are its assistant, and point to the About page. Never invent other facts about the site, its people or yourself, and never give advice about a real patient.";

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
    'Answer as short bullets ("- ") under these bold labels, in this order, each on its own line: "**Positive — normal tissue:**", "**Negative — normal tissue:**", "**Positive — tumors:**", "**Negative — tumors:**". One tissue or tumor per bullet with its key detail (pattern, % if given), and cite every bullet. At most 12 bullets per label, the tumors most often met in practice first. Omit a label the sources say nothing about. No other labels, no tables.',
  table:
    "Answer as a compact Markdown table: at most 5 columns and 8 rows, cells under 10 words, no padding or alignment spaces (rows = items, columns = features). Cite in the cells too; write 'not stated' in any cell the sources do not cover, and in every cell for an item no source covers. Then one sentence that answers the question directly.",
};

/** The answer model's system prompt: shared rules plus the planned format. */
export function answerSystem(format: AnswerFormat): string {
  return `${ANSWER_RULES} ${FORMAT_INSTRUCTION[format]}`;
}
