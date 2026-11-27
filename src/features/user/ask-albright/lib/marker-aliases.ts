import "server-only";

import { createKbClient } from "@/shared/services/kb-client";
import { log } from "@/shared/utils/logging";
import { type AliasGroup, aliasGroup, markerCandidates } from "./synonyms";

type MarkerRow = {
  id: string;
  slug: string;
  name: string;
  gene_symbols: string[] | null;
  marker_synonyms: Array<{ term: string }> | null;
};

const SELECT = "id, slug, name, gene_symbols, marker_synonyms(term)";
const MAX_GROUPS = 6;
/**
 * Synonyms are a nicety: never let them hold a question. Without a limit, a
 * stalled connection kept one request waiting 616 s during a network drop.
 */
const LOOKUP_TIMEOUT_MS = 2500;

// Per instance; marker vocabulary changes rarely and a stale entry is harmless.
const cache = new Map<string, AliasGroup[]>();
const CACHE_MAX = 500;

/**
 * The protein markers a question names, each with every name it goes by.
 * Matches question words against marker names and against
 * marker_synonyms.term_normalized (both public-read). Never throws: synonyms
 * are an improvement, so a failed lookup just means none.
 */
export async function lookupMarkerAliases(question: string): Promise<AliasGroup[]> {
  const candidates = markerCandidates(question);
  if (candidates.length === 0) return [];
  const key = candidates.join("|");
  const hit = cache.get(key);
  if (hit) return hit;

  try {
    const sb = createKbClient();
    // Names are matched case-insensitively on the question's own spelling
    // ("TTF-1"); synonyms on the normalised form ("ttf 1").
    const words = [...new Set(question.match(/[A-Za-z0-9][A-Za-z0-9-]*/g) ?? [])].slice(0, 24);
    const [byName, bySynonym] = await Promise.all([
      sb
        .from("markers")
        .select(SELECT)
        .eq("kind", "protein")
        .or(words.map((w) => `name.ilike.${w}`).join(","))
        .limit(20)
        .abortSignal(AbortSignal.timeout(LOOKUP_TIMEOUT_MS)),
      sb
        .from("marker_synonyms")
        .select("marker_id")
        .in("term_normalized", candidates)
        .limit(100)
        .abortSignal(AbortSignal.timeout(LOOKUP_TIMEOUT_MS)),
    ]);
    if (byName.error) throw byName.error;
    if (bySynonym.error) throw bySynonym.error;

    const rows = new Map<string, MarkerRow>(
      ((byName.data ?? []) as MarkerRow[]).map((r) => [r.id, r])
    );
    const extraIds = [
      ...new Set((bySynonym.data ?? []).map((r: { marker_id: string }) => r.marker_id)),
    ].filter((id) => !rows.has(id));
    if (extraIds.length > 0) {
      const more = await sb
        .from("markers")
        .select(SELECT)
        .eq("kind", "protein")
        .in("id", extraIds.slice(0, 50))
        .order("id")
        .abortSignal(AbortSignal.timeout(LOOKUP_TIMEOUT_MS));
      if (more.error) throw more.error;
      for (const r of (more.data ?? []) as MarkerRow[]) rows.set(r.id, r);
    }

    const groups = [...rows.values()]
      .map(aliasGroup)
      // Single-name markers are kept too: marker questions need their id for
      // the knowledge-base profile (callers filter to >1 name for synonyms).
      .slice(0, MAX_GROUPS);
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
    cache.set(key, groups);
    return groups;
  } catch (err) {
    log.warn("[ask-albright] marker synonym lookup failed; continuing without", err);
    return [];
  }
}
