import "server-only";

import { getApiKey } from "@/shared/config/ai-keys";
import { callOpenAICompatText } from "@/shared/services/openai-compat";
import { type PathTalkHit, searchPathTalk } from "@/shared/services/pathtalk";
import { log } from "@/shared/utils/logging";
import {
  ANSWER_MAX_TOKENS,
  TABLE_MAX_TOKENS,
  ANSWER_MODEL,
  type AskSource,
  PASSAGES,
  PASSAGE_CHARS,
  COMPARE_MAX_SEARCHES,
  MAX_SEARCHES,
  RELEVANCE_MIN,
  RERANK_CHARS,
  SEARCH_LIMIT,
  SOURCE_LABEL,
  SOURCE_TOOL,
  buildAnswerPrompt,
  normalizeQuestion,
  splitFollowUps,
  hitTokenCap,
  tidyAnswer,
  dropUnaskedGaps,
  questionTerms,
  relevantExcerpt,
} from "./router";
import {
  type AnswerFormat,
  answerSystem,
  PLANNER_MODEL,
  PLANNER_SYSTEM,
  type Plan,
  type PlanScope,
  SCOPE_REPLY,
  fallbackPlan,
  parsePlan,
} from "./planner";
import {
  type SymbolTable,
  extractSymbolTables,
  relevantTables,
  tableToPromptLines,
} from "./tables";
import { type Page, mergeByHref, rankPages, keyTerms, type SourcedHit } from "./rank";
import { rerankScores } from "./rerank";
import { lookupMarkerAliases } from "./marker-aliases";
import { aliasPattern, sameMarkerNote, termAlternatives } from "./synonyms";

export interface AskCitation {
  n: number;
  title: string;
  href: string;
  /** Which corpus this passage came from; answers can mix them. */
  sourceLabel: string;
}

export interface AskTable extends SymbolTable {
  /** Citation number of the passage the table came from. */
  n: number;
  /** Rows the question names, highlighted in the UI (may be empty). */
  focusRows: string[];
}

/** At most this many tables per answer — they cost no tokens to show, but space in the card. */
const MAX_TABLES = 2;

export interface AskResult {
  answer: string;
  source: AskSource;
  sourceLabel: string;
  citations: AskCitation[];
  /** Symbol tables rebuilt from the passages (see tables.ts), for display. */
  tables: AskTable[];
  /** Suggested next questions, from the same answer call. */
  followUps: string[];
  /** Workers AI tokens this answer cost (0 when served from cache). */
  tokens: number;
  cached: boolean;
  /** Set when the question was declined without searching. */
  scope?: Exclude<PlanScope, "ok">;
  /** The answer shape the planner chose. */
  format?: AnswerFormat;
}

/** Whether the feature can run: kill switch on and Workers AI configured. */
export function isAskAlbrightAvailable(): boolean {
  if (process.env.ASK_ALBRIGHT_ENABLED === "false") return false;
  return getApiKey("cloudflare") !== "";
}

// ---------------------------------------------------------------------------
// Answer cache. In-memory, per instance — Fluid Compute keeps instances warm,
// so repeat questions (the same quiz item, the same classic differential) hit.
// Map insertion order doubles as LRU order.
// ---------------------------------------------------------------------------
const CACHE_MAX = 300;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; value: AskResult }>();

function cacheGet(key: string): AskResult | null {
  const hit = cache.get(key);
  if (!hit) return null;
  cache.delete(key);
  if (Date.now() - hit.at > CACHE_TTL_MS) return null;
  cache.set(key, hit);
  return hit.value;
}

function cacheSet(key: string, value: AskResult): void {
  cache.set(key, { at: Date.now(), value });
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
}

/** Test hook. */
export function clearAskCache(): void {
  cache.clear();
}

/** Step 1: plan the answer (scope, source, query, focus, format) in one small JSON call. */
export async function planQuestion(
  question: string,
  apiKey: string
): Promise<{ plan: Plan; tokens: number }> {
  try {
    const res = await callOpenAICompatText("cloudflare", PLANNER_MODEL, apiKey, question, {
      system: PLANNER_SYSTEM,
      maxTokens: 140,
      temperature: 0,
      timeoutMs: 8_000,
      jsonMode: true,
    });
    return { plan: parsePlan(res.content, question), tokens: res.tokenUsage?.total_tokens ?? 0 };
  } catch (err) {
    log.warn("[ask-albright] planner failed; searching as asked", err);
    return { plan: fallbackPlan(question), tokens: 0 };
  }
}

export class NoPassagesError extends Error {}

interface Candidate {
  page: Page;
  pageTables: SymbolTable[];
  prose: string;
  score: number;
}

/** Search one corpus and turn its hits into scored candidates (best first). */
async function searchCorpus(
  source: AskSource,
  query: string,
  question: string,
  expanded: string,
  alternatives: Map<string, string[]>
): Promise<{ candidates: Candidate[]; failed: boolean }> {
  let hits: PathTalkHit[] = [];
  let failed = false;
  try {
    hits = await searchPathTalk(SOURCE_TOOL[source], query, {
      limit: SEARCH_LIMIT,
      timeoutMs: 12_000,
    });
  } catch (err) {
    failed = true;
    log.warn(
      `[ask-albright] ${SOURCE_TOOL[source]} failed: ${err instanceof Error ? err.message : err}`
    );
  }
  const pages = rankPages(
    mergeByHref(hits.map((h): SourcedHit => ({ ...h, source }))),
    question,
    source,
    alternatives
  );
  const candidates = pages.map((page) => {
    const { tables: pageTables, prose } = extractSymbolTables(page.body);
    return { page, pageTables, prose, score: 0 };
  });
  // A cross-encoder reads each excerpt against the question: the score both
  // orders the pages and says whether this corpus answered at all.
  try {
    const scores = await rerankScores(
      query,
      candidates.map((c) => `${c.page.title}. ${relevantExcerpt(c.prose, expanded, RERANK_CHARS)}`)
    );
    candidates.forEach((c, i) => (c.score = scores[i]));
    candidates.sort((a, b) => b.score - a.score);
  } catch (err) {
    log.warn("[ask-albright] rerank failed; using term-coverage order", err);
    candidates.forEach((c) => (c.score = RELEVANCE_MIN)); // unknown: don't trigger a fallback search
  }
  return { candidates, failed };
}

/**
 * The specific names a question is about: ones with a digit (TRPS1, CD117,
 * MEF2B, BCL2) or a known marker name from the knowledge base (KIT), each with
 * all its synonyms. Plain acronyms like RCC or NLPHL are often written out in
 * full, so they are left out.
 */
function subjectsOf(question: string, aliasGroups: Array<{ aliases: string[] }>): string[][] {
  const known = new Set(aliasGroups.flatMap((g) => g.aliases.map((a) => a.toLowerCase())));
  return (question.match(/[A-Za-z0-9][A-Za-z0-9-]*/g) ?? [])
    .filter(
      (w) => (/[a-z]/i.test(w) && /\d/.test(w) && w.length >= 3) || known.has(w.toLowerCase())
    )
    .map(
      (w) =>
        aliasGroups.find((g) => g.aliases.some((a) => a.toLowerCase() === w.toLowerCase()))
          ?.aliases ?? [w]
    );
}

function names(text: string, subject: string[]): boolean {
  return subject.some((n) =>
    new RegExp(`(^|[^a-z0-9])${aliasPattern(n)}($|[^a-z0-9])`, "i").test(text)
  );
}

/**
 * True when no candidate names one of the question's subjects. The reranker
 * alone can't see this: for "Is TRPS1 sensitive for TNBC?" it scored a
 * GATA3-in-TNBC paper 0.85, so the corpus that had "TRPS1 … 86%" was skipped.
 */
const ITEM_STOP = new Set(["the", "and", "with", "type", "not", "otherwise", "specified", "nos"]);

/**
 * Whether a page is about a compared diagnosis: most of the diagnosis's words
 * (≥70%, ≥3 letters) appear in the page TITLE. Titles, not bodies — a CHL page
 * names NLPHL in its differential, which would wrongly count as covering it.
 */
export function coversItem(title: string, item: string): boolean {
  const words = (item.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
    (w) => w.length >= 3 && !ITEM_STOP.has(w)
  );
  if (words.length === 0) return false;
  const t = title.toLowerCase();
  const hit = words.filter((w) => new RegExp(`(^|[^a-z0-9])${w}`).test(t)).length;
  return hit / words.length >= 0.7;
}

function missesSubject(candidates: Candidate[], subjects: string[][]): boolean {
  if (subjects.length === 0 || candidates.length === 0) return false;
  const text = candidates.map((c) => `${c.page.title} ${c.page.body}`).join(" ");
  return subjects.some((sub) => !names(text, sub));
}

/**
 * The pipeline: cache → plan → one search (a second only if the first missed)
 * → read whole passages → answer in the planned format.
 */
export async function askAlbright(
  question: string,
  /** noCache: always answer fresh and don't store it (the dev eval uses this). */
  { noCache = false }: { noCache?: boolean } = {}
): Promise<AskResult> {
  const key = normalizeQuestion(question);
  const hit = noCache ? null : cacheGet(key);
  if (hit) return { ...hit, tokens: 0, cached: true };

  const apiKey = getApiKey("cloudflare");
  const [{ plan, tokens: planTokens }, aliasGroups] = await Promise.all([
    planQuestion(question, apiKey),
    lookupMarkerAliases(question),
  ]);

  // 1. Scope: decline off-topic or sprawling questions without searching.
  if (plan.scope !== "ok") {
    const declined: AskResult = {
      answer: SCOPE_REPLY[plan.scope],
      source: plan.source,
      sourceLabel: SOURCE_LABEL[plan.source],
      citations: [],
      tables: [],
      followUps: [],
      tokens: planTokens,
      cached: false,
      scope: plan.scope,
    };
    if (!noCache) cacheSet(key, declined);
    return declined;
  }

  // Marker synonyms from the knowledge base (CD117 = KIT…): added to the
  // search, matched when ranking and excerpting, and stated to the model.
  const aliasWords = [...new Set(aliasGroups.flatMap((g) => g.aliases))];
  const searchQuery = aliasGroups.length
    ? `${plan.query} (${aliasGroups.map((g) => g.aliases.join(" / ")).join("; ")})`
    : plan.query;
  const expanded = `${question} ${plan.focus} ${aliasWords.join(" ")}`;
  const alternatives = termAlternatives(keyTerms(question), aliasGroups);

  // 2. One search in the planned corpus; the fallback corpus only when nothing
  // there reads as relevant (each search costs the user ~1 s).
  // Planned corpus first, then the planner's fallback, then the rest — but a
  // further search only while the results still miss (low relevance, or the
  // question's marker named nowhere), and never more than MAX_SEARCHES.
  const order = [
    ...new Set<AskSource>([plan.source, plan.fallback, "outlines", "pubmed", "who", "literature"]),
  ];
  const subjects = subjectsOf(question, aliasGroups);
  const searched: AskSource[] = [];
  let candidates: Candidate[] = [];
  let anyFailed = false;
  for (const src of order) {
    if (searched.length >= MAX_SEARCHES) break;
    if (
      searched.length > 0 &&
      (candidates[0]?.score ?? -Infinity) >= RELEVANCE_MIN &&
      !missesSubject(candidates, subjects)
    )
      break;
    searched.push(src);
    const found = await searchCorpus(src, searchQuery, question, expanded, alternatives);
    anyFailed ||= found.failed;
    candidates = [...candidates, ...found.candidates].sort((a, b) => b.score - a.score);
  }
  // Comparisons: every compared diagnosis needs its own page. One search
  // covered NLPHL and CHL but not PMBL, and the model filled the PMBL column
  // with invented "Negative"s. Search each missing one by name (planned corpus).
  const missing = () =>
    plan.items.filter((item) => !candidates.some((c) => coversItem(c.page.title, item)));
  if (plan.items.length >= 2) {
    const itemWords = new Set(plan.items.join(" ").toLowerCase().split(/\W+/));
    // Topic words only: drop the diagnoses themselves, including their
    // all-caps abbreviations (CHL, NLPHL…), but keep technique words.
    const TECHNIQUE = new Set(["IHC", "FISH", "PCR", "NGS", "ISH", "EBER", "WHO"]);
    const extra = plan.query
      .split(/\s+/)
      .filter((w) => !itemWords.has(w.toLowerCase()))
      .filter((w) => !/^[A-Z]{2,}$/.test(w) || TECHNIQUE.has(w))
      .join(" ");
    for (const item of missing()) {
      if (searched.length >= COMPARE_MAX_SEARCHES) break;
      searched.push(plan.source);
      const q = `${item} ${extra}`.trim();
      const found = await searchCorpus(plan.source, q, question, expanded, alternatives);
      anyFailed ||= found.failed;
      candidates = [...candidates, ...found.candidates].sort((a, b) => b.score - a.score);
    }
  }
  if (candidates.length === 0) {
    if (anyFailed) throw new Error("PathTalk search failed");
    throw new NoPassagesError("No passages found for that question");
  }
  // Passages that name every subject go first: the TRPS1 page (third, behind
  // a better-scored GATA3 paper) was read past and answered "not stated".
  const namesAll = (c: Candidate) =>
    subjects.every((sub) => names(`${c.page.title} ${c.page.body}`, sub)) ? 1 : 0;
  candidates.sort((a, b) => namesAll(b) - namesAll(a) || b.score - a.score);
  // One passage per compared diagnosis first (best-scored page about it), then
  // the best of the rest.
  const chosen: Candidate[] = [];
  for (const item of plan.items) {
    const best = candidates.find((c) => !chosen.includes(c) && coversItem(c.page.title, item));
    if (best) chosen.push(best);
  }
  const want = Math.max(PASSAGES, Math.min(plan.items.length, 4));
  for (const c of candidates) {
    if (chosen.length >= want) break;
    if (!chosen.includes(c)) chosen.push(c);
  }
  const hits = chosen.map((c) => c.page);

  // 3. Read: whole passages (up to PASSAGE_CHARS each, centred on the question
  // when longer), with rebuilt tables sent as one line per row.
  const terms = questionTerms(expanded);
  const tables: AskTable[] = [];
  const tableKeys = new Set<string>();
  const passages = chosen.map((c, i) => {
    let text = relevantExcerpt(c.prose, expanded, PASSAGE_CHARS);
    for (const t of relevantTables(c.pageTables, terms)) {
      const tkey = JSON.stringify([t.headers, t.rows]);
      if (tableKeys.has(tkey)) continue;
      tableKeys.add(tkey);
      text += ` Table: ${tableToPromptLines(t, t.focusRows)}`;
      if (tables.length < MAX_TABLES) tables.push({ ...t, n: i + 1 });
    }
    return { title: c.page.title, text };
  });

  // 4. Answer in the planned format, told what to look for.
  const prompt = buildAnswerPrompt(question, passages, sameMarkerNote(aliasGroups), plan.focus);
  const answerOnce = (format: AnswerFormat) =>
    callOpenAICompatText("cloudflare", ANSWER_MODEL, apiKey, prompt, {
      system: answerSystem(format),
      maxTokens: format === "table" || format === "marker" ? TABLE_MAX_TOKENS : ANSWER_MAX_TOKENS,
      // 0: the same question gives the same answer (graded answers differed
      // from the owner's reruns at 0.2).
      temperature: 0,
      timeoutMs: 20_000,
    });
  let res = await answerOnce(plan.format);
  let answerTokens = res.tokenUsage?.total_tokens ?? 0;
  let format = plan.format;
  // An answer that used its whole budget was cut off. Seen with tables: the
  // model padded the header with spaces until the cap and never wrote a row
  // ("Endometrial carcinoma vs endocervical adenocarcinoma"). Retry once as a
  // paragraph rather than show a fragment; this costs only on the rare miss.
  const cap = format === "table" || format === "marker" ? TABLE_MAX_TOKENS : ANSWER_MAX_TOKENS;
  if (hitTokenCap(res.tokenUsage?.completion_tokens, cap) && format !== "paragraph") {
    log.warn(`[ask-albright] ${format} answer hit the token cap; retrying as a paragraph`);
    res = await answerOnce("paragraph");
    answerTokens += res.tokenUsage?.total_tokens ?? 0;
    format = "paragraph";
  }

  log.info(
    `[ask-albright] plan ${plan.source}/${plan.format} q="${plan.query}" items=${plan.items.join("|") || "-"} searched=${searched.join("+")} top=${chosen[0]?.score.toFixed(2)} markers=${aliasGroups.map((g) => g.name).join(",") || "none"}`
  );

  const result: AskResult = {
    ...(({ answer, followUps }) => ({ answer: dropUnaskedGaps(answer), followUps }))(
      splitFollowUps(tidyAnswer(res.content))
    ),
    source: hits[0].source,
    sourceLabel: SOURCE_LABEL[hits[0].source],
    // Links come from retrieval, never from the model, so they cannot be invented.
    citations: hits.map((h, i) => ({
      n: i + 1,
      title: h.title,
      href: h.href,
      sourceLabel: SOURCE_LABEL[h.source],
    })),
    tables,
    tokens: planTokens + answerTokens,
    cached: false,
    format,
  };
  // A degraded answer (a search errored) must not be served for 24h: next ask retries.
  if (!noCache && !anyFailed) cacheSet(key, result);
  return result;
}
