import "server-only";

import { getApiKey } from "@/shared/config/ai-keys";
import { callOpenAICompatText } from "@/shared/services/openai-compat";
import { type PathTalkHit, searchPathTalk } from "@/shared/services/pathtalk";
import { log } from "@/shared/utils/logging";
import {
  ANSWER_MAX_TOKENS,
  ANSWER_MODEL,
  ANSWER_SYSTEM,
  type AskSource,
  PASSAGES,
  ROUTER_MODEL,
  SOURCE_LABEL,
  SOURCE_TOOL,
  buildAnswerPrompt,
  buildRouterPrompt,
  heuristicSource,
  normalizeQuestion,
  parseRouterReply,
  questionTerms,
  relevantExcerpt,
} from "./router";
import {
  type SymbolTable,
  extractSymbolTables,
  relevantTables,
  tableToPromptLines,
} from "./tables";
import { mergeByHref, rankPages, type SourcedHit } from "./rank";

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
  /** Workers AI tokens this answer cost (0 when served from cache). */
  tokens: number;
  cached: boolean;
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

/** Step 1: pick a source with one tiny model call; fall back to keywords on any failure. */
export async function routeQuestion(
  question: string,
  apiKey: string
): Promise<{ source: AskSource; tokens: number }> {
  try {
    const res = await callOpenAICompatText(
      "cloudflare",
      ROUTER_MODEL,
      apiKey,
      buildRouterPrompt(question),
      { maxTokens: 2, temperature: 0, timeoutMs: 5_000 }
    );
    const source = parseRouterReply(res.content);
    const tokens = res.tokenUsage?.total_tokens ?? 0;
    if (source) return { source, tokens };
    log.warn(`[ask-albright] router replied off-format: ${JSON.stringify(res.content)}`);
    return { source: heuristicSource(question), tokens };
  } catch (err) {
    log.warn("[ask-albright] router call failed; using keyword fallback", err);
    return { source: heuristicSource(question), tokens: 0 };
  }
}

export class NoPassagesError extends Error {}

/** The whole pipeline: cache → route → retrieve → answer. */
export async function askAlbright(question: string): Promise<AskResult> {
  const key = normalizeQuestion(question);
  const hit = cacheGet(key);
  if (hit) return { ...hit, tokens: 0, cached: true };

  const apiKey = getApiKey("cloudflare");
  const { source, tokens: routerTokens } = await routeQuestion(question, apiKey);

  // Search all three corpora in parallel (free, ~1.5s total) and let term
  // coverage pick the pages; the router's choice only breaks ties. A corpus
  // that errors is skipped rather than failing the question.
  const sources = Object.keys(SOURCE_TOOL) as AskSource[];
  const settled = await Promise.allSettled(
    sources.map((src) => searchPathTalk(SOURCE_TOOL[src], question, { limit: PASSAGES }))
  );
  const found: SourcedHit[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      found.push(...r.value.map((h: PathTalkHit) => ({ ...h, source: sources[i] })));
    } else {
      log.warn(`[ask-albright] ${SOURCE_TOOL[sources[i]]} failed`, r.reason);
    }
  });
  if (settled.every((r) => r.status === "rejected"))
    throw new Error("All PathTalk searches failed");
  const hits = rankPages(mergeByHref(found), question, source).slice(0, PASSAGES);
  if (hits.length === 0) throw new NoPassagesError("No passages found for that question");

  // Tables come out of the prose before excerpting, then go back in as one
  // line per row: the flattened form is what made the model misread them. The
  // same panel often sits on two pages (entity + overview): show and send it once.
  const terms = questionTerms(question);
  const tables: AskTable[] = [];
  const tableKeys = new Set<string>();
  const passages = hits.map((h, i) => {
    const { tables: found, prose } = extractSymbolTables(h.body);
    let text = relevantExcerpt(prose, question);
    for (const t of relevantTables(found, terms)) {
      const key = JSON.stringify([t.headers, t.rows]);
      if (tableKeys.has(key)) continue;
      tableKeys.add(key);
      text += ` Table: ${tableToPromptLines(t, t.focusRows)}`;
      if (tables.length < MAX_TABLES) tables.push({ ...t, n: i + 1 });
    }
    return { title: h.title, text };
  });
  const res = await callOpenAICompatText(
    "cloudflare",
    ANSWER_MODEL,
    apiKey,
    buildAnswerPrompt(question, passages),
    { system: ANSWER_SYSTEM, maxTokens: ANSWER_MAX_TOKENS, temperature: 0.2, timeoutMs: 15_000 }
  );

  const result: AskResult = {
    answer: res.content.trim(),
    // The corpus the top-ranked passage came from (the router's pick only
    // breaks ties, so this can differ from it).
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
    tokens: routerTokens + (res.tokenUsage?.total_tokens ?? 0),
    cached: false,
  };
  cacheSet(key, result);
  return result;
}
