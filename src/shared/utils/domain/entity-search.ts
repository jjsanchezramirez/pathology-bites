import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The tokenizer, the scorer and the stop-word list moved to text-search-core so
// /debug/kg-atlas could rank a CLIENT-side index with the SAME rules. Behaviour
// here is unchanged: the bodies were sliced out, not rewritten.
import { scoreEntry, STOP_WORDS, tokenize } from "./text-search-core";

function getEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`missing ${key}`);
  return v;
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
      // Postgres promises no row order between two queries, so LIMIT/OFFSET
      // paging without an ORDER BY returns OVERLAPPING pages: the marker index
      // once came back 5,262 rows deep with only 4,829 distinct, manufacturing
      // 463 phantom duplicates. Every one of these tables has an id.
      .order("id", { ascending: true })
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
    const score = scoreEntry(entry, tokens, q);
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
