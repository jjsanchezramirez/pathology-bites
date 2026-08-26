/**
 * The shared text-search core: one tokenizer, one stop-word list, one scorer.
 *
 * Sliced verbatim out of `entity-search.ts` when `/debug/kg-atlas` needed the
 * same ranking over a CLIENT-side index (entities + markers + both synonym
 * tables + merge redirects) instead of a server-side one. The alternative was a
 * second scorer, and a second implementation of a ranking rule is how the two
 * silently diverge — the same failure `term_normalized` already had when two
 * normalisers wrote one column.
 *
 * Deliberately dependency-free: no Supabase, no `process.env`, no I/O. That is
 * what lets it run in the browser. The two callers keep their own index shapes
 * and only share `Scorable`.
 */

/** Everything `scoreEntry` needs, precomputed once per row by the caller. */
export interface Scorable {
  nameLower: string;
  /** tokens of the name */
  tokenSet: Set<string>;
  /** raw lowercased synonym strings, for exact-alias matching */
  synonymSet: Set<string>;
  /** tokens of every synonym */
  synonymTokenSet: Set<string>;
}

export function tokenize(text: string): string[] {
  return (
    text
      .toLowerCase()
      .replace(/[-\/]/g, " ")
      .match(/[a-z0-9]+/g) || []
  );
}

export function scoreEntry(entry: Scorable, queryTokens: string[], queryLower: string): number {
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

export const STOP_WORDS = new Set([
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
