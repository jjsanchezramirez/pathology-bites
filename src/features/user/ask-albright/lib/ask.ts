import "server-only";

import { getApiKey } from "@/shared/config/ai-keys";
import { callOpenAICompatText, streamOpenAICompatText } from "@/shared/services/openai-compat";
import {
  type PathTalkHit,
  searchPathTalk,
  searchPathTalkFigures,
} from "@/shared/services/pathtalk";
import { criteriaAnswer, pickCriteriaPage } from "./who-criteria";
import { searchImagesForDiagnosis } from "@/shared/services/image-search";
import { createServiceRoleClient } from "@/shared/services/service-role-client";
import { log } from "@/shared/utils/logging";
import {
  ANSWER_MAX_TOKENS,
  TABLE_MAX_TOKENS,
  MARKER_MAX_TOKENS,
  keepCutOff,
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
  comparisonFollowUps,
  hitTokenCap,
  tidyAnswer,
  dropUnaskedGaps,
  questionTerms,
  relevantExcerpt,
  heuristicSource,
} from "./router";
import {
  type AnswerFormat,
  answerSystem,
  CHAT_SYSTEM,
  PLANNER_HEDGE_MODEL,
  isJoke,
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
import { jokeAnswer } from "./jokes";
import {
  type AskVisual,
  DIAGRAM_INSTRUCTION,
  DIAGRAM_TOKENS,
  MAX_IMAGES,
  imageSubject,
  legendCovers,
  pickImages,
  shortCredit,
  shortLegend,
  splitDiagram,
} from "./visuals";
import { lookupMarkerAliases } from "./marker-aliases";
import { markerProfile } from "./kb-marker";
import { entityProfiles, warmEntityIndex } from "./kb-entity";
import {
  CostBudget,
  RERANK_COST_MODEL,
  costOf,
  estimateTokens,
  promptRoom,
  worstCase,
} from "./cost";
import {
  type AliasGroup,
  aliasPattern,
  compactTerm,
  sameMarkerNote,
  termAlternatives,
} from "./synonyms";
import { isFactRequest } from "./fact";
import { randomKbFact } from "./kb-fact";
import { guideFollowUps, matchGuide } from "./site-guide";
import { matchScoring, scoringCitations, scoringFollowUps } from "./scoring-guide";

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
  /** Wall-clock ms per stage, for telemetry (not shown). */
  timings?: AskTimings;
  /** What this answer cost in USD (never above COST_CAP_USD; 0 from cache). */
  costUsd?: number;
  /** The one visual the answer carries, if any (see visuals.ts for the cascade). */
  visual?: AskVisual;
}

export interface AskTimings {
  plan: number;
  search: number;
  searches: number;
  profile: number;
  /** Request start to the answer's first token: what the user waits for. */
  firstToken: number;
  answer: number;
  total: number;
}

/** What the streamed form of an answer emits, in order. */
export type AskEvent =
  /** Sources are known: citations and tables can render before the text. */
  | {
      type: "meta";
      source: AskSource;
      sourceLabel: string;
      citations: AskCitation[];
      tables: AskTable[];
      format: AnswerFormat;
      /** Images or a figure when already known; a diagram only arrives with `done`. */
      visual?: AskVisual;
    }
  | { type: "delta"; text: string }
  /** The text so far is being replaced (a cut-off answer retried as a paragraph). */
  | { type: "reset" }
  | { type: "done"; result: AskResult };

/** No new search starts after this (ms from the request): the hard case must start answering by ~10 s. */
const SEARCH_DEADLINE_MS = 5_000;
/**
 * The planner gives way to the heuristic plan rather than hold the answer. It
 * usually takes ~1 s; Workers AI occasionally stalls it past 4 s, and by 3 s
 * the first search has long finished.
 */
const PLANNER_TIMEOUT_MS = 3_000;
const PLANNER_MAX_TOKENS = 140;
/** Small talk is one to three sentences. */
const CHAT_MAX_TOKENS = 120;
/** gpt-oss reasons first: the caller raises its cap to 1024, so the worst case is held at that. */
const PLANNER_HELD_TOKENS = 1024;
/** When the planner hasn't answered by then, the hedge model is asked as well. */
const HEDGE_AFTER_MS = 1_500;
/** Knowledge-base profiles are short by design; cap each so one can't crowd out the passages. */
const PROFILE_CHARS = 900;
/** Passages are trimmed to this before one is dropped to fit the budget… */
const MIN_PASSAGE_CHARS = 700;
/** …and to this, as a last resort, before the answer gives up. */
const SHORTEST_PASSAGE_CHARS = 300;
/** The output cap may shrink to this to fit the budget (a short answer beats none). */
const MIN_OUTPUT_TOKENS = 200;

/** Whether the feature can run: kill switch on and Workers AI configured. */
export function isAskAlbrightAvailable(): boolean {
  // Off unless explicitly enabled (read at call time so tests can toggle it).
  if (process.env.NEXT_PUBLIC_ASK_ALBRIGHT_ENABLED !== "true") return false;
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
  apiKey: string,
  budget: CostBudget = new CostBudget()
): Promise<{ plan: Plan; tokens: number }> {
  // A hedged request: Workers AI usually plans in ~1 s but now and then stalls
  // one call past 3 s. If the first hasn't answered by HEDGE_AFTER_MS, the
  // hedge model is asked too and the first good plan wins; the other is
  // aborted (and, since it may still bill, kept at its worst case).
  const calls: Array<{ controller: AbortController }> = [];
  const attempt = async (model: string): Promise<{ plan: Plan; tokens: number }> => {
    const held = worstCase(
      model,
      estimateTokens(PLANNER_SYSTEM + question),
      /gpt-oss/.test(model) ? PLANNER_HELD_TOKENS : PLANNER_MAX_TOKENS
    );
    if (!budget.hold(held)) throw new Error("planner does not fit the cost budget");
    const controller = new AbortController();
    calls.push({ controller });
    try {
      const res = await callOpenAICompatText("cloudflare", model, apiKey, question, {
        system: PLANNER_SYSTEM,
        maxTokens: PLANNER_MAX_TOKENS,
        temperature: 0,
        signal: controller.signal,
        jsonMode: true,
      });
      budget.settle(held, costOf(model, res.tokenUsage));
      return { plan: parsePlan(res.content, question), tokens: res.tokenUsage?.total_tokens ?? 0 };
    } catch (err) {
      budget.settle(held, held);
      throw err;
    }
  };
  let hedgeTimer: ReturnType<typeof setTimeout> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    // any(): the first plan that arrives; race(): …unless the deadline comes first.
    return await Promise.race([
      Promise.any([
        attempt(PLANNER_MODEL),
        new Promise<{ plan: Plan; tokens: number }>((resolve, reject) => {
          hedgeTimer = setTimeout(
            () => attempt(PLANNER_HEDGE_MODEL).then(resolve, reject),
            HEDGE_AFTER_MS
          );
        }),
      ]),
      new Promise<never>((_, reject) => {
        deadline = setTimeout(() => reject(new Error("planner timeout")), PLANNER_TIMEOUT_MS);
      }),
    ]);
  } catch (err) {
    log.warn("[ask-albright] planner failed; searching as asked", err);
    return { plan: fallbackPlan(question), tokens: 0 };
  } finally {
    clearTimeout(hedgeTimer);
    clearTimeout(deadline);
    for (const c of calls) c.controller.abort();
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
  alternatives: Map<string, string[]>,
  { timeoutMs = 8_000, budget }: { timeoutMs?: number; budget?: CostBudget } = {}
): Promise<{ candidates: Candidate[]; failed: boolean }> {
  let hits: PathTalkHit[] = [];
  let failed = false;
  try {
    hits = await searchPathTalk(SOURCE_TOOL[source], query, {
      limit: SEARCH_LIMIT,
      timeoutMs,
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
    const texts = candidates.map(
      (c) => `${c.page.title}. ${relevantExcerpt(c.prose, expanded, RERANK_CHARS)}`
    );
    // Reranking is ~$0.000003 a search; recorded so the ledger is complete.
    budget?.settle(
      0,
      costOf(RERANK_COST_MODEL, {
        prompt_tokens: estimateTokens(query) * texts.length + estimateTokens(texts.join(" ")),
      })
    );
    const scores = await rerankScores(query, texts);
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
  return (question.match(/[A-Za-z0-9][A-Za-z0-9-]*/g) ?? ([] as string[]))
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
  const words = (item.toLowerCase().match(/[a-z0-9]+/g) ?? ([] as string[])).filter(
    (w) => w.length >= 3 && !ITEM_STOP.has(w)
  );
  if (words.length === 0) return false;
  const t = title.toLowerCase();
  const hit = words.filter((w) => new RegExp(`(^|[^a-z0-9])${w}`).test(t)).length;
  if (hit / words.length >= 0.7) return true;
  // PathologyOutlines shortens some titles: its PMBL page is titled just
  // "primary mediastinal", which holds 2 of the 5 words above — so the right
  // page was refused and the gray-zone page took PMBL's column. A title of 2+
  // words that all appear in the item names it too.
  const tw = (t.match(/[a-z0-9]+/g) ?? ([] as string[])).filter(
    (w) => w.length >= 3 && !ITEM_STOP.has(w)
  );
  return (
    tw.length >= 2 &&
    tw.some((w) => !GENERIC_TITLE_WORDS.has(w)) &&
    tw.every((w) => words.some((iw) => iw.startsWith(w)))
  );
}

/** Words that name no diagnosis on their own ("large cell", "B cell lymphoma"). */
const GENERIC_TITLE_WORDS = new Set([
  "cell",
  "cells",
  "large",
  "small",
  "lymphoma",
  "carcinoma",
  "sarcoma",
  "tumor",
  "tumour",
  "neoplasm",
  "disease",
]);

function maxTokensFor(format: AnswerFormat): number {
  if (format === "marker") return MARKER_MAX_TOKENS;
  return format === "table" ? TABLE_MAX_TOKENS : ANSWER_MAX_TOKENS;
}

/** The knowledge-base profile of the marker the question names (first match with an id). */
function markerProfileFor(question: string, aliasGroups: AliasGroup[]) {
  const words = new Set(
    (question.match(/[A-Za-z0-9][A-Za-z0-9-]*/g) ?? []).map((w) => compactTerm(w))
  );
  const marker =
    aliasGroups.find((g) => g.id && g.aliases.some((a) => words.has(compactTerm(a)))) ??
    aliasGroups.find((g) => g.id);
  return marker ? markerProfile(marker) : Promise.resolve(null);
}

function missesSubject(candidates: Candidate[], subjects: string[][]): boolean {
  if (subjects.length === 0 || candidates.length === 0) return false;
  const text = candidates.map((c) => `${c.page.title} ${c.page.body}`).join(" ");
  return subjects.some((sub) => !names(text, sub));
}

interface Passage {
  title: string;
  text: string;
}

/**
 * Passage texts that fit `roomTokens` (estimated as the budget estimates them) in total, giving way in this order:
 * shorter excerpts (centred on the question) down to MIN_PASSAGE_CHARS, then
 * the rebuilt tables, then whole passages from the end, then the knowledge-base
 * profiles, then excerpts down to SHORTEST_PASSAGE_CHARS. Null when not even
 * one shortest passage fits. `pages` are the first pages.length of `chosen`,
 * in order. Pure, given the candidates.
 */
export function fitPassages(
  chosen: Array<{ title: string; prose: string; tableText: string }>,
  profiles: Passage[],
  expanded: string,
  roomTokens: number
): { pages: Passage[]; profiles: Passage[] } | null {
  // "[n] title: text\n" — measured exactly as the prompt is built.
  const size = (ps: Passage[]) =>
    ps.reduce((n, p, i) => n + estimateTokens(`[${i + 1}] ${p.title}: ${p.text}\n`), 0);
  const build = (items: typeof chosen, limit: number, withTables: boolean) =>
    items.map((c) => ({
      title: c.title,
      text: relevantExcerpt(c.prose, expanded, limit) + (withTables ? c.tableText : ""),
    }));
  const attempt = (extras: Passage[], minLimit: number) => {
    for (let keep = chosen.length; keep >= 1; keep--) {
      const items = chosen.slice(0, keep);
      for (const withTables of [true, false]) {
        for (let limit = PASSAGE_CHARS; limit >= minLimit; limit -= 300) {
          const pages = build(items, limit, withTables);
          if (size(pages) + size(extras) <= roomTokens) return { pages, profiles: extras };
        }
      }
    }
    return null;
  };
  if (chosen.length === 0)
    return profiles.length && size(profiles) <= roomTokens ? { pages: [], profiles } : null;
  return (
    attempt(profiles, MIN_PASSAGE_CHARS) ??
    attempt([], MIN_PASSAGE_CHARS) ??
    attempt([], SHORTEST_PASSAGE_CHARS)
  );
}

/** A published figure about the question, as a linked card; null when none is clearly about it. */
async function figureFor(query: string, question: string): Promise<AskVisual | null> {
  try {
    const figures = await searchPathTalkFigures(query, { limit: 5 });
    const terms = keyTerms(`${question} ${query}`).filter((t) => t.length >= 3);
    const f = figures.find((x) => legendCovers(x.legend, terms));
    return f ? { kind: "figure", legend: shortLegend(f.legend), href: f.href, doi: f.doi } : null;
  } catch (err) {
    log.warn("[ask-albright] figure search failed; no figure", err);
    return null;
  }
}

/**
 * The visual lookups for a plan (no model calls): own images, else a figure,
 * for image questions; the fallback figure for diagram questions, in case the
 * model's diagram doesn't come through.
 */
async function lookupVisual(plan: Plan, question: string): Promise<AskVisual | null> {
  if (plan.visual === "none") return null;
  if (plan.visual === "images") {
    try {
      const subject = imageSubject(plan.items, plan.query);
      // Over-fetch, then keep only images whose title names the subject.
      const found = subject
        ? pickImages(
            await searchImagesForDiagnosis(
              subject,
              plan.items.slice(1),
              12,
              createServiceRoleClient() as never
            ),
            [subject, ...plan.items.slice(1)],
            question
          )
        : [];
      if (found.length) {
        return {
          kind: "images",
          images: found.slice(0, MAX_IMAGES).map((im) => ({
            url: im.url,
            alt: im.alt_text ?? im.description ?? subject,
            credit: shortCredit(im.source_ref),
          })),
        };
      }
    } catch (err) {
      log.warn("[ask-albright] image lookup failed; trying a figure", err);
    }
  }
  return figureFor(plan.query, question);
}

/**
 * A reply that needed no model call (site guide, random fact): sources first,
 * then the whole text. Marked as small talk, so it is neither saved to history
 * nor rated, and costs nothing.
 */
function* instantReply(
  t0: number,
  reply: { answer: string; citations: AskCitation[]; followUps: string[] },
  /** Shown only per citation; the reply-level label is kept honest for telemetry. */
  sourceLabel: string = SOURCE_LABEL.who
): Generator<AskEvent> {
  const ms = Date.now() - t0;
  yield {
    type: "meta",
    source: "who",
    sourceLabel,
    citations: reply.citations,
    tables: [],
    format: "sentence",
  };
  yield {
    type: "done",
    result: {
      answer: reply.answer,
      source: "who",
      sourceLabel,
      citations: reply.citations,
      tables: [],
      followUps: reply.followUps,
      tokens: 0,
      cached: false,
      scope: "chat",
      format: "sentence",
      costUsd: 0,
      timings: {
        plan: 0,
        search: 0,
        searches: 0,
        profile: 0,
        firstToken: ms,
        answer: 0,
        total: ms,
      },
    },
  };
}

/**
 * The pipeline, streamed: cache → plan (with a first search started
 * alongside it) → more searches only on a miss, never past the deadline →
 * knowledge-base profiles → passages trimmed to the cost budget → the answer,
 * token by token.
 */
export async function* askAlbrightStream(
  question: string,
  /** noCache: always answer fresh and don't store it (the dev eval uses this). */
  { noCache = false }: { noCache?: boolean } = {}
): AsyncGenerator<AskEvent> {
  // Jokes come from the curated list: no planner, no search, no model, no cache.
  if (isJoke(question)) {
    yield {
      type: "done",
      result: {
        answer: jokeAnswer(),
        source: "outlines",
        sourceLabel: SOURCE_LABEL.outlines,
        citations: [],
        tables: [],
        followUps: [],
        tokens: 0,
        cached: false,
        scope: "chat",
        format: "sentence",
        costUsd: 0,
      },
    };
    return;
  }

  // 0. Answers that need no model call, before the cache (each "tell me
  // something" gets a new fact) — both fall through to the planner if empty:
  //   a how-to about the site itself → its site-guide entry (site-guide.ts);
  //   "tell me something" → one cited WHO sentence from the knowledge base (fact.ts).
  const guide = matchGuide(question);
  if (guide) {
    yield* instantReply(
      Date.now(),
      {
        answer: guide.answer,
        citations: [{ n: 1, title: guide.title, href: guide.href, sourceLabel: "Pathology Bites" }],
        followUps: guideFollowUps(guide),
      },
      "Pathology Bites"
    );
    return;
  }
  // HER2 / PD-L1 scoring rules: cited, curated, no model call (scoring-guide.ts).
  const scoring = matchScoring(question);
  if (scoring) {
    yield* instantReply(Date.now(), {
      answer: scoring.answer,
      citations: scoringCitations(scoring),
      followUps: scoringFollowUps(scoring),
    });
    return;
  }
  if (isFactRequest(question)) {
    const t0 = Date.now();
    const fact = await randomKbFact();
    if (fact) {
      yield* instantReply(t0, fact);
      return;
    }
  }

  const key = normalizeQuestion(question);
  const hit = noCache ? null : cacheGet(key);
  if (hit) {
    yield { type: "done", result: { ...hit, tokens: 0, cached: true, costUsd: 0 } };
    return;
  }

  const apiKey = getApiKey("cloudflare");
  const t0 = Date.now();
  const since = () => Date.now() - t0;
  const budget = new CostBudget();
  const timings: AskTimings = {
    plan: 0,
    search: 0,
    searches: 0,
    profile: 0,
    firstToken: 0,
    answer: 0,
    total: 0,
  };
  warmEntityIndex();

  // The plan and a first search run side by side: the search guesses the
  // corpus from the question's words (heuristicSource) and searches the
  // question itself, plus any marker synonyms. When the planner agrees on the
  // corpus, the answer starts ~1 s sooner; when not, the planned corpus is
  // searched next, as before.
  const aliasPromise = lookupMarkerAliases(question);
  const planPromise = planQuestion(question, apiKey, budget).then((r) => {
    timings.plan = since();
    return r;
  });
  const guessSource = heuristicSource(question);
  const firstSearch = aliasPromise.then((groups) => {
    const syn = groups.filter((g) => g.aliases.length > 1);
    const q = syn.length
      ? `${question} (${syn.map((g) => g.aliases.join(" / ")).join("; ")})`
      : question;
    return searchCorpus(
      guessSource,
      q,
      question,
      `${question} ${syn.flatMap((g) => g.aliases).join(" ")}`,
      termAlternatives(keyTerms(question), syn),
      { timeoutMs: SEARCH_DEADLINE_MS, budget }
    );
  });
  const [{ plan, tokens: planTokens }, aliasGroups] = await Promise.all([
    planPromise,
    aliasPromise,
  ]);

  // 1a. Small talk: a short in-character reply, no sources (the first search is discarded).
  if (plan.scope === "chat") {
    void firstSearch.catch(() => {});
    const held = worstCase(ANSWER_MODEL, estimateTokens(CHAT_SYSTEM + question), CHAT_MAX_TOKENS);
    if (!budget.hold(held)) throw new Error("chat does not fit the cost budget");
    yield {
      type: "meta",
      source: plan.source,
      sourceLabel: SOURCE_LABEL[plan.source],
      citations: [],
      tables: [],
      format: "sentence",
    };
    let reply = "";
    let usage: { prompt_tokens?: number; completion_tokens?: number; neurons?: number } | undefined;
    try {
      for await (const chunk of streamOpenAICompatText(
        "cloudflare",
        ANSWER_MODEL,
        apiKey,
        question,
        {
          system: CHAT_SYSTEM,
          maxTokens: CHAT_MAX_TOKENS,
          temperature: 0.4,
          timeoutMs: 15_000,
        }
      )) {
        if ("delta" in chunk) {
          if (!timings.firstToken) timings.firstToken = since();
          reply += chunk.delta;
          yield { type: "delta", text: chunk.delta };
        } else usage = chunk.usage;
      }
    } finally {
      budget.settle(held, usage ? costOf(ANSWER_MODEL, usage) : held);
    }
    yield {
      type: "done",
      result: {
        answer: reply.trim(),
        source: plan.source,
        sourceLabel: SOURCE_LABEL[plan.source],
        citations: [],
        tables: [],
        followUps: [],
        tokens: planTokens + (usage?.prompt_tokens ?? 0) + (usage?.completion_tokens ?? 0),
        cached: false,
        scope: "chat",
        format: "sentence",
        costUsd: budget.spent,
        timings: { ...timings, total: since() },
      },
    };
    return;
  }

  // 1b. Scope: decline off-topic or sprawling questions (the first search is discarded).
  if (plan.scope !== "ok") {
    void firstSearch.catch(() => {});
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
      costUsd: budget.spent,
      timings: { ...timings, total: since() },
    };
    // Not cached: a wrong decline ("Hans algorithm" read as off-topic) must
    // not stick for 24 h. The route doesn't save declines to history either.
    yield { type: "done", result: declined };
    return;
  }

  // Knowledge-base profiles start now, alongside any further search: the
  // marker's IHC profile for marker questions, otherwise the profile of each
  // diagnosis the question names (the planner spells abbreviations out).
  const profileStart = Date.now();
  const markerPromise =
    plan.format === "marker" ? markerProfileFor(question, aliasGroups) : Promise.resolve(null);
  const entityPromise =
    plan.format === "marker"
      ? Promise.resolve([])
      : entityProfiles(
          `${question} ${plan.items.join(" ")}`,
          plan.items.length >= 2 ? Math.min(plan.items.length, 3) : 2
        );
  const visualPromise = lookupVisual(plan, question);
  const profilesPromise = Promise.all([markerPromise, entityPromise]).then(([m, e]) => {
    timings.profile = Date.now() - profileStart;
    return [...(m ? [m] : []), ...e];
  });

  // Marker synonyms from the knowledge base (CD117 = KIT…): added to the
  // search, matched when ranking and excerpting, and stated to the model.
  const synonymGroups = aliasGroups.filter((g) => g.aliases.length > 1);
  const aliasWords = [...new Set(synonymGroups.flatMap((g) => g.aliases))];
  const searchQuery = synonymGroups.length
    ? `${plan.query} (${synonymGroups.map((g) => g.aliases.join(" / ")).join("; ")})`
    : plan.query;
  const expanded = `${question} ${plan.focus} ${aliasWords.join(" ")}`;
  const alternatives = termAlternatives(keyTerms(question), synonymGroups);
  const searchTimeout = () => Math.max(1_500, SEARCH_DEADLINE_MS + 3_000 - since());
  const pastDeadline = () => since() >= SEARCH_DEADLINE_MS;

  // 2. Searches. The first one is in; the planned corpus, then the fallbacks,
  // are searched only while the results still miss (low relevance, or the
  // question's marker named nowhere), at most MAX_SEARCHES, and none started
  // past the deadline.
  const subjects = subjectsOf(question, aliasGroups);
  const searched: AskSource[] = [guessSource];
  const first = await firstSearch;
  let candidates: Candidate[] = first.candidates;
  let anyFailed = first.failed;
  const order = [
    ...new Set<AskSource>([plan.source, plan.fallback, "outlines", "pubmed", "who", "literature"]),
  ].filter((src) => src !== guessSource);
  for (const src of order) {
    if (searched.length >= MAX_SEARCHES || pastDeadline()) break;
    if (
      (candidates[0]?.score ?? -Infinity) >= RELEVANCE_MIN &&
      !missesSubject(candidates, subjects)
    )
      break;
    searched.push(src);
    const found = await searchCorpus(src, searchQuery, question, expanded, alternatives, {
      timeoutMs: searchTimeout(),
      budget,
    });
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
    // The missing diagnoses are searched side by side: each is its own query.
    const todo = missing().slice(0, Math.max(0, COMPARE_MAX_SEARCHES - searched.length));
    if (todo.length && !pastDeadline()) {
      const found = await Promise.all(
        todo.map((item) => {
          searched.push(plan.source);
          return searchCorpus(
            plan.source,
            `${item} ${extra}`.trim(),
            question,
            expanded,
            alternatives,
            { timeoutMs: searchTimeout(), budget }
          );
        })
      );
      for (const f of found) {
        anyFailed ||= f.failed;
        candidates = [...candidates, ...f.candidates];
      }
      candidates.sort((a, b) => b.score - a.score);
    }
  }
  timings.search = since() - timings.plan;
  timings.searches = searched.length;
  const profiles = await profilesPromise;
  if (candidates.length === 0 && profiles.length === 0) {
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

  // 3. Read: whole passages centred on the question, rebuilt tables sent as
  // one line per row, then trimmed to what the budget leaves for the prompt.
  const terms = questionTerms(expanded);
  const tableKeys = new Set<string>();
  const tablesFor = chosen.map((c, i) => {
    const kept: AskTable[] = [];
    for (const t of relevantTables(c.pageTables, terms)) {
      const tkey = JSON.stringify([t.headers, t.rows]);
      if (tableKeys.has(tkey)) continue;
      tableKeys.add(tkey);
      kept.push({ ...t, n: i + 1 });
    }
    return kept;
  });
  // Criteria come straight from a WHO passage that lists them (both groups,
  // WHO's words, no model call); with none, the old paragraph.
  const whoCriteria =
    plan.format === "criteria"
      ? pickCriteriaPage(
          candidates.map((c) => c.page),
          `${question} ${plan.query}`
        )
      : null;
  const format: AnswerFormat =
    plan.format === "criteria" && !whoCriteria ? "paragraph" : plan.format;
  const wantsDiagram = plan.visual === "diagram";
  const systemFor = (fmt: AnswerFormat) =>
    wantsDiagram ? `${answerSystem(fmt)} ${DIAGRAM_INSTRUCTION}` : answerSystem(fmt);
  const outFor = (fmt: AnswerFormat) => maxTokensFor(fmt) + (wantsDiagram ? DIAGRAM_TOKENS : 0);
  const system = systemFor(format);
  const note = sameMarkerNote(synonymGroups);
  const overhead = estimateTokens(system + buildAnswerPrompt(question, [], note, plan.focus));
  const profilePassages = profiles.map((p) => ({
    title: p.title,
    text: p.text.slice(0, PROFILE_CHARS),
  }));
  const fitInputs = chosen.map((c, i) => ({
    title: c.page.title,
    prose: c.prose,
    tableText: tablesFor[i].map((t) => ` Table: ${tableToPromptLines(t, t.focusRows)}`).join(""),
  }));
  // Full output cap first; if even the shortest passage won't fit beside it,
  // a smaller cap (a shorter answer) before giving up.
  let maxOut = outFor(format);
  let fitted: ReturnType<typeof fitPassages> = null;
  for (;;) {
    const roomTokens = promptRoom(ANSWER_MODEL, budget.remaining, maxOut) - overhead;
    fitted = roomTokens > 0 ? fitPassages(fitInputs, profilePassages, expanded, roomTokens) : null;
    if (fitted || maxOut <= MIN_OUTPUT_TOKENS) break;
    maxOut = Math.max(MIN_OUTPUT_TOKENS, Math.floor(maxOut * 0.7));
  }
  if (!fitted) throw new Error("answer does not fit the cost budget");
  // Citations follow the passages that survived the trim, in prompt order.
  // By position, never by title: two pages can share one (a diagnosis from two corpora).
  const usedPages = chosen.slice(0, fitted.pages.length);
  const usedProfiles = profiles.slice(0, fitted.profiles.length);
  const passages: Passage[] = [...fitted.pages, ...fitted.profiles];
  // One visual per answer: when this one gets a diagram, images or a figure,
  // the rebuilt source tables still inform the model but are not shown.
  let tables =
    plan.visual === "none"
      ? usedPages
          .flatMap((c, i) => tablesFor[chosen.indexOf(c)].map((t) => ({ ...t, n: i + 1 })))
          .slice(0, MAX_TABLES)
      : [];
  let citations: AskCitation[] = [
    ...usedPages.map((c, i) => ({
      n: i + 1,
      title: c.page.title,
      href: c.page.href,
      sourceLabel: SOURCE_LABEL[c.page.source],
    })),
    ...usedProfiles.map((p, i) => ({
      n: usedPages.length + i + 1,
      title: p.title,
      href: p.href,
      sourceLabel: "Pathology Bites",
    })),
  ];
  if (whoCriteria) {
    const { page } = whoCriteria;
    citations = [
      { n: 1, title: page.title, href: page.href, sourceLabel: SOURCE_LABEL[page.source] },
    ];
    tables = [];
  }
  const top = whoCriteria?.page.source ?? usedPages[0]?.page.source ?? plan.source;

  // 4. Answer in the planned format, streamed. Its worst case (this prompt
  // plus its full output cap) is held against the budget before it starts.
  const prompt = buildAnswerPrompt(question, passages, note, plan.focus);
  // Images (or their fallback figure) usually resolved during the searches:
  // send them with the sources rather than after the text. Never wait long.
  const early =
    plan.visual === "images"
      ? await Promise.race([
          visualPromise,
          new Promise<null>((r) => setTimeout(() => r(null), 800)),
        ])
      : null;
  yield {
    type: "meta",
    source: top,
    sourceLabel: SOURCE_LABEL[top],
    citations,
    tables,
    format,
    ...(early ? { visual: early } : {}),
  };

  const tAnswer = Date.now();
  let answerTokens = 0;
  const streamAnswer = async function* (
    fmt: AnswerFormat,
    cap: number
  ): AsyncGenerator<string, { text: string; completion?: number }> {
    const sys = systemFor(fmt);
    const held = worstCase(ANSWER_MODEL, estimateTokens(sys + prompt), cap);
    if (!budget.hold(held)) throw new Error("answer does not fit the cost budget");
    let text = "";
    let usage: { prompt_tokens?: number; completion_tokens?: number; neurons?: number } | undefined;
    try {
      for await (const chunk of streamOpenAICompatText("cloudflare", ANSWER_MODEL, apiKey, prompt, {
        system: sys,
        maxTokens: cap,
        // 0: the same question gives the same answer (graded answers differed
        // from the owner's reruns at 0.2).
        temperature: 0,
        // The whole stream: a long table on a slow minute ran past 20 s.
        timeoutMs: 40_000,
      })) {
        if ("delta" in chunk) {
          if (!timings.firstToken) timings.firstToken = since();
          text += chunk.delta;
          yield chunk.delta;
        } else usage = chunk.usage;
      }
    } finally {
      budget.settle(held, usage ? costOf(ANSWER_MODEL, usage) : held);
      answerTokens += (usage?.prompt_tokens ?? 0) + (usage?.completion_tokens ?? 0);
    }
    return { text, completion: usage?.completion_tokens };
  };

  let finalFormat = format;
  let content = "";
  let completion: number | undefined;
  if (whoCriteria) {
    content = criteriaAnswer(whoCriteria.criteria, 1);
    timings.firstToken = since();
    yield { type: "delta", text: content };
  } else {
    const gen = streamAnswer(format, maxOut);
    for (;;) {
      const step = await gen.next();
      if (step.done === true) {
        content = step.value.text;
        completion = step.value.completion;
        break;
      }
      yield { type: "delta", text: step.value };
    }
  }
  // An answer that used its whole budget was cut off. A cut list or table is
  // mostly fine — keep it minus the partial last line. Only when nothing
  // usable came back (the model once padded a table header with spaces to the
  // cap and wrote no row) retry once as a paragraph, if the budget allows.
  if (hitTokenCap(completion, maxOut) && format !== "paragraph") {
    const kept = keepCutOff(tidyAnswer(content));
    if (kept) {
      log.warn(`[ask-albright] ${format} answer hit the token cap; kept it minus the last line`);
      content = kept;
    } else if (
      budget.remaining >=
      worstCase(ANSWER_MODEL, estimateTokens(systemFor("paragraph") + prompt), outFor("paragraph"))
    ) {
      log.warn(`[ask-albright] ${format} answer hit the token cap with nothing usable; retrying`);
      yield { type: "reset" };
      const gen = streamAnswer("paragraph", outFor("paragraph"));
      for (;;) {
        const step = await gen.next();
        if (step.done === true) {
          content = step.value.text;
          break;
        }
        yield { type: "delta", text: step.value };
      }
      finalFormat = "paragraph";
    }
  }
  timings.answer = Date.now() - tAnswer;
  timings.total = since();

  log.info(
    `[ask-albright] ms=${JSON.stringify(timings)} cost=$${budget.spent.toFixed(6)} plan ${plan.source}/${format} q="${plan.query}" items=${plan.items.join("|") || "-"} searched=${searched.join("+")} visual=${plan.visual} top=${chosen[0]?.score.toFixed(2)} markers=${aliasGroups.map((g) => g.name).join(",") || "none"} kb=${profiles.length}`
  );

  // The diagram comes off before anything else touches the text (tidyAnswer
  // would collapse its indentation; the follow-ups split would swallow it).
  const { text: answerText, code: diagram } = splitDiagram(content);
  if (wantsDiagram && !diagram)
    log.warn("[ask-albright] diagram asked for but none usable; figure instead");
  const visual: AskVisual | null = diagram
    ? { kind: "diagram", code: diagram }
    : await Promise.race([
        visualPromise,
        new Promise<null>((r) => setTimeout(() => r(null), 2_000)),
      ]);
  const result: AskResult = {
    ...(({ answer, followUps }) => ({
      answer: dropUnaskedGaps(answer),
      // Tables rarely carry the model's follow-ups; offer the unasked aspects instead.
      followUps:
        followUps.length || finalFormat !== "table" ? followUps : comparisonFollowUps(question),
    }))(splitFollowUps(tidyAnswer(answerText))),
    source: top,
    sourceLabel: SOURCE_LABEL[top],
    // Links come from retrieval, never from the model, so they cannot be invented.
    citations,
    tables,
    tokens: planTokens + answerTokens,
    cached: false,
    format: finalFormat,
    timings,
    costUsd: budget.spent,
    ...(visual ? { visual } : {}),
  };
  // A degraded answer (a search errored) must not be served for 24h: next ask retries.
  if (!noCache && !anyFailed) cacheSet(key, result);
  yield { type: "done", result };
}

/** The whole answer at once (the JSON route and the eval use this). */
export async function askAlbright(
  question: string,
  opts: { noCache?: boolean } = {}
): Promise<AskResult> {
  for await (const ev of askAlbrightStream(question, opts)) {
    if (ev.type === "done") return ev.result;
  }
  throw new Error("answer stream ended without a result");
}
