/**
 * Marker synonyms for Ask Dr. Albright, from the knowledge base.
 *
 * Asked about "CD117", the answer left oncocytoma blank: the PathologyOutlines
 * panel calls that column "KIT", and nothing said they are one marker. The
 * knowledge base already knows (marker_synonyms: CD117 ↔ KIT ↔ c-KIT, TTF-1 ↔
 * NKX2-1, D2-40 ↔ podoplanin, AMACR ↔ P504S, melan-A ↔ MART1, EMA ↔ MUC1…), so
 * this reads it rather than keeping a second list. Protein (IHC) markers only:
 * the same names also label mutation/amplification markers ("KIT mutations"),
 * which would only add noise here.
 *
 * Pure helpers are exported for tests; `lookupMarkerAliases` is the DB read.
 */

/** Same normalisation as marker_synonyms.term_normalized: lowercase, punctuation → space. */
export function normalizeTerm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Separator-free key, so "TTF-1", "TTF1" and "ttf 1" are one name. */
export function compactTerm(s: string): string {
  return normalizeTerm(s).replace(/ /g, "");
}

export interface AliasGroup {
  /** The knowledge base's name for the marker. */
  name: string;
  /** Every short name it goes by, including `name`, de-duplicated. */
  aliases: string[];
}

const NOT_A_NAME =
  /mutation|amplification|fusion|rearrangement|translocation|deletion|loss|expression/i;

/**
 * Split stored terms like "KIT (CD117, c-KIT)" into usable names and keep the
 * short ones (≤2 words, ≤20 chars) that name the protein, not an event.
 */
export function namesFromTerm(term: string): string[] {
  return term
    .split(/[(),;/]/)
    .map((t) => t.replace(/‑/g, "-").trim())
    .filter((t) => t && t.length <= 20 && t.split(/\s+/).length <= 2 && !NOT_A_NAME.test(t));
}

export function aliasGroup(row: {
  name: string;
  gene_symbols?: string[] | null;
  marker_synonyms?: Array<{ term: string }> | null;
}): AliasGroup {
  const seen = new Map<string, string>();
  for (const n of [
    row.name,
    ...(row.gene_symbols ?? []),
    ...(row.marker_synonyms ?? []).flatMap((s) => namesFromTerm(s.term)),
  ]) {
    const key = compactTerm(n);
    if (key && !seen.has(key)) seen.set(key, n);
  }
  return { name: row.name, aliases: [...seen.values()] };
}

/** Candidate marker words in a question: "CD117", "TTF-1", "D2-40", "podoplanin"… */
export function markerCandidates(question: string): string[] {
  const words = question.match(/[A-Za-z0-9][A-Za-z0-9-]*/g) ?? [];
  const out = new Set<string>();
  for (const w of words) {
    const n = normalizeTerm(w);
    if (n.length >= 2 && !/^\d+$/.test(n)) out.add(n);
  }
  return [...out].slice(0, 24);
}

/** A regex fragment matching an alias however it is punctuated: "ttf 1" → ttf-1 / ttf1 / ttf 1. */
export function aliasPattern(alias: string): string {
  return normalizeTerm(alias)
    .split(" ")
    .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("[\\s-]?");
}

/**
 * Map each question key term to the alternatives it should also match. A term
 * maps when it is (the normalised form of) one of a group's aliases.
 */
export function termAlternatives(terms: string[], groups: AliasGroup[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const g of groups) {
    const norms = g.aliases.map(normalizeTerm);
    const keys = g.aliases.map(compactTerm);
    for (const t of terms) {
      if (keys.includes(compactTerm(t))) {
        out.set(t, [...new Set([...(out.get(t) ?? []), ...norms])]);
      }
    }
  }
  return out;
}

/** One prompt line, e.g. "Same marker: CD117 = KIT = c-KIT." (empty when nothing to say). */
export function sameMarkerNote(groups: AliasGroup[]): string {
  const lines = groups.filter((g) => g.aliases.length > 1).map((g) => g.aliases.join(" = "));
  return lines.length ? `Same marker: ${lines.join("; ")}.` : "";
}
