import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function getEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`missing ${key}`);
  return v;
}

// ── Tokenizer (mirrors virtual-slide-search.ts) ──────────────────────────
function tokenize(text: string): string[] {
  return (
    text
      .toLowerCase()
      .replace(/[-\/]/g, " ")
      .match(/[a-z0-9]+/g) || []
  );
}

// ── Search index entry ──────────────────────────────────────────────────
interface EntityEntry {
  id: string;
  name: string;
  slug: string;
  organSystem: string | null;
  chapterName: string | null;
  tokens: string[];
  tokenSet: Set<string>;
  nameLower: string;
  synonyms: string[];
  synonymSet: Set<string>; // raw lowercased synonym strings for exact matching
  synonymTokens: string[];
  synonymTokenSet: Set<string>;
}

// ── Module-scope index ──────────────────────────────────────────────────
let index: EntityEntry[] | null = null;
let reverseIndex: Map<string, Set<number>> | null = null;

async function fetchAll<T>(
  // Not `ReturnType<typeof createClient>`: that is the no-argument
  // instantiation, whose schema generics collapse to `never`, so the client
  // actually constructed below does not satisfy it.
  supabase: SupabaseClient,
  table: string,
  columns: string,
  pageSize = 1000
): Promise<T[]> {
  const results: T[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    results.push(...(data as T[]));
    if (!data || data.length < pageSize) break;
    offset += pageSize;
  }
  return results;
}

async function buildIndex(): Promise<void> {
  const supabase = createClient(
    getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { persistSession: false },
    }
  );

  const entities = await fetchAll<{
    id: string;
    name: string;
    slug: string;
  }>(supabase, "entities", "id, name, slug");

  // Organ and chapter are per-VOLUME facts and live on entity_placements: one
  // tumour is placed in several volumes and has an organ in each. Search shows
  // one only when it is unambiguous — a tumour placed in nine volumes has no
  // single home, and naming one would be an arbitrary tie-break.
  const placements = await fetchAll<{
    entity_id: string;
    organ_system: string | null;
    chapter_name: string | null;
  }>(supabase, "entity_placements", "entity_id, organ_system, chapter_name");

  const placeMap = new Map<string, { organs: Set<string>; chapters: Set<string> }>();
  for (const p of placements) {
    let m = placeMap.get(p.entity_id);
    if (!m) placeMap.set(p.entity_id, (m = { organs: new Set(), chapters: new Set() }));
    if (p.organ_system) m.organs.add(p.organ_system);
    const c = p.chapter_name?.trim();
    if (c) m.chapters.add(c);
  }
  const sole = (set: Set<string> | undefined) => (set && set.size === 1 ? [...set][0] : null);

  const synonyms = await fetchAll<{ entity_id: string; term: string }>(
    supabase,
    "entity_synonyms",
    "entity_id, term"
  );

  // Group synonyms by entity
  const synMap = new Map<string, string[]>();
  for (const s of synonyms) {
    if (!synMap.has(s.entity_id)) synMap.set(s.entity_id, []);
    synMap.get(s.entity_id)!.push(s.term);
  }

  index = [];
  reverseIndex = new Map();

  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    const nameLower = e.name.toLowerCase();
    const tokens = tokenize(nameLower);
    const syns = synMap.get(e.id) ?? [];
    const synTokens = tokenize(syns.join(" ").toLowerCase());

    const entry: EntityEntry = {
      id: e.id,
      name: e.name,
      slug: e.slug,
      organSystem: sole(placeMap.get(e.id)?.organs),
      chapterName: sole(placeMap.get(e.id)?.chapters),
      tokens,
      tokenSet: new Set(tokens),
      nameLower,
      synonyms: syns,
      synonymSet: new Set(syns.map((s) => s.toLowerCase())),
      synonymTokens: synTokens,
      synonymTokenSet: new Set(synTokens),
    };
    index.push(entry);

    // Build reverse index: token → set of entity indices
    const allTokens = new Set([...tokens, ...synTokens]);
    for (const tok of allTokens) {
      if (!reverseIndex.has(tok)) reverseIndex.set(tok, new Set());
      reverseIndex.get(tok)!.add(i);

      // Prefix index for 4+ char tokens
      if (tok.length >= 4) {
        const prefix = tok.substring(0, 3);
        const pfxKey = `pfx:${prefix}`;
        if (!reverseIndex.has(pfxKey)) reverseIndex.set(pfxKey, new Set());
        reverseIndex.get(pfxKey)!.add(i);
      }
    }
  }
}

async function ensureIndex(): Promise<void> {
  if (!index) await buildIndex();
}

// ── Scoring (mirrors virtual-slide-search tiers) ────────────────────────
function scoreEntity(entry: EntityEntry, queryTokens: string[], queryLower: string): number {
  let score = 0;

  // Tier 1: Exact name match
  if (entry.nameLower === queryLower) return 100;

  // Tier 2: Exact synonym match (e.g., "NEC" → "Neuroendocrine carcinoma")
  if (entry.synonymSet.has(queryLower)) return 95;

  // Tier 3: Name contains exact phrase (word-boundary aware)
  const phraseRe = new RegExp(queryLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (phraseRe.test(entry.nameLower)) {
    score = 90;
  }

  // Tier 4: All query tokens match entity name tokens
  if (score === 0 && queryTokens.length > 1) {
    const allInName = queryTokens.every((t) => entry.tokenSet.has(t));
    if (allInName) score = 80;
  }

  // Tier 5: All query tokens match name OR synonyms
  if (score === 0 && queryTokens.length > 1) {
    const allInAny = queryTokens.every(
      (t) => entry.tokenSet.has(t) || entry.synonymTokenSet.has(t)
    );
    if (allInAny) score = 75;
  }

  // Tier 6: Partial word matches in name (proportional)
  if (score === 0) {
    const matched = queryTokens.filter((t) => entry.tokenSet.has(t)).length;
    if (matched > 0) {
      score = 50 + (matched / queryTokens.length) * 20;
    }
  }

  // Tier 7: Partial word matches including synonyms
  if (score === 0) {
    const matched = queryTokens.filter(
      (t) => entry.tokenSet.has(t) || entry.synonymTokenSet.has(t)
    ).length;
    if (matched > 0) {
      score = 40 + (matched / queryTokens.length) * 15;
    }
  }

  // Tier 8: Prefix matching (4+ char query tokens only)
  if (score === 0) {
    let prefixHits = 0;
    for (const t of queryTokens) {
      if (t.length < 4) continue;
      const pfx = t.substring(0, 3);
      if (entry.tokenSet.has(pfx) || entry.synonymTokenSet.has(pfx)) {
        prefixHits++;
      }
    }
    if (prefixHits > 0) score = 20 + prefixHits * 5;
  }

  return score;
}

// ── Stop words (too common to be useful for matching) ───────────────────
const STOP_WORDS = new Set([
  "the",
  "of",
  "in",
  "and",
  "or",
  "with",
  "for",
  "to",
  "a",
  "an",
  "not",
  "no",
]);

// ── Public API ──────────────────────────────────────────────────────────
export interface EntitySearchResult {
  id: string;
  name: string;
  slug: string;
  organSystem: string | null;
  chapterName: string | null;
  score: number;
}

export async function searchEntities(query: string): Promise<EntitySearchResult[]> {
  await ensureIndex();
  if (!index || !reverseIndex) return [];

  const q = query.toLowerCase().trim();
  const tokens = tokenize(q).filter((t) => !STOP_WORDS.has(t) && t.length > 1);
  if (tokens.length === 0) return [];

  // Collect candidate indices via reverse index (intersection for multi-word)
  const candidateSets: Set<number>[] = [];
  for (const tok of tokens) {
    const hits = new Set<number>();

    // Exact token match
    const exact = reverseIndex.get(tok);
    if (exact) exact.forEach((i) => hits.add(i));

    // Prefix match — only for 4+ char tokens to avoid noise ("nec" → "neck", "necrotizing")
    if (tok.length >= 4) {
      const pfx = reverseIndex.get(`pfx:${tok.substring(0, 3)}`);
      if (pfx) pfx.forEach((i) => hits.add(i));
    }

    if (hits.size === 0 && tokens.length > 1) continue; // skip unmatched words in multi-word
    candidateSets.push(hits);
  }

  // Intersect for multi-word, union for single-word
  let candidateIndices: Set<number>;
  if (candidateSets.length === 1) {
    candidateIndices = candidateSets[0];
  } else {
    candidateIndices = new Set(candidateSets[0]);
    for (let i = 1; i < candidateSets.length; i++) {
      candidateIndices = new Set([...candidateIndices].filter((idx) => candidateSets[i].has(idx)));
    }
    // Fallback: if intersection is empty, use union
    if (candidateIndices.size === 0) {
      candidateIndices = new Set();
      for (const s of candidateSets) s.forEach((i) => candidateIndices.add(i));
    }
  }

  // Score candidates
  const results: EntitySearchResult[] = [];
  for (const idx of candidateIndices) {
    const entry = index[idx];
    const score = scoreEntity(entry, tokens, q);
    if (score > 0) {
      results.push({
        id: entry.id,
        name: entry.name,
        slug: entry.slug,
        organSystem: entry.organSystem,
        chapterName: entry.chapterName,
        score,
      });
    }
  }

  // Sort by score descending, then name alphabetically
  results.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return results.slice(0, 15);
}
