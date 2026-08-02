// Token-based ranked text search for the IHC tool's diagnosis and marker
// pickers. Replaces the old whole-string `.includes(query)` filter, which missed
// anything but a very specific query: it broke on word order ("thyroid papillary"
// vs "Papillary thyroid carcinoma"), on the commas/parentheses WHO bakes into
// names ("Follicular lymphoma, grade 1"), and on British spelling ("tumour",
// "leukaemia"). Same shape as the virtual-slide search engine — build an index
// once, rank a query against it — scaled down to the flat {name, aliases, organ}
// records here.
//
// Two things this handles that a plain tokenizer does not:
//
//   * Joined forms. Pathologists type "ki67", "ttf1", "cd20"; the data says
//     "Ki-67", "TTF-1". Tokenizing both sides gives ["ki","67"] vs ["ki67"] —
//     no overlap, so those queries returned NOTHING. Every field therefore also
//     carries a `joined` form with punctuation stripped, which they match exactly.
//
//   * Window acronyms. "clear cell rcc" mixes words with an acronym of a phrase
//     *inside* the name. Indexing the first-letter acronym of every contiguous
//     token window lets "rcc" match the "renal cell carcinoma" run of "Clear
//     cell renal cell carcinoma" while "clear" and "cell" match as words.
//
// Synonyms that cannot be derived from letters (CAIX = carbonic anhydrase IX,
// MIB-1 = Ki-67) are deliberately NOT handled here — those are data, and live in
// the marker SYNONYM map in build_ihc_matrix.mjs, reaching us as aliases.

import { tokenize } from "@/shared/utils/domain/virtual-slide-search";
import { normalizeMedicalSpelling as normalizeMedical } from "@/shared/utils/text/medical-spelling";

export { normalizeMedical };

export interface Searchable {
  id: string;
  name: string;
  aliases?: string[];
  organ?: string;
}

interface Field {
  norm: string;
  joined: string;
  tokens: string[];
  acronyms: Set<string>;
}

interface Entry<T> {
  item: T;
  name: Field;
  aliases: Field[];
  organ?: Field;
}

export interface TextIndex<T> {
  entries: Entry<T>[];
}

// Longest token run folded into an acronym. Windows of 1 are excluded — a single
// token's "acronym" is just its first letter, which would match everything.
const MAX_ACRONYM_WINDOW = 6;
const MIN_ACRONYM_LEN = 2;

function makeField(raw: string): Field {
  const norm = normalizeMedical(raw);
  const tokens = tokenize(norm);
  const acronyms = new Set<string>();
  for (let i = 0; i < tokens.length; i++) {
    for (let len = 2; len <= MAX_ACRONYM_WINDOW && i + len <= tokens.length; len++) {
      const acr = tokens
        .slice(i, i + len)
        .map((t) => t[0])
        .join("");
      if (acr.length >= MIN_ACRONYM_LEN) acronyms.add(acr);
    }
  }
  return { norm, joined: norm.replace(/[^a-z0-9]/g, ""), tokens, acronyms };
}

/**
 * Precompute normalized forms for every item. Build once per dataset, not per
 * keystroke — this is the expensive half; ranking is then a scan over
 * already-normalized fields.
 */
export function buildTextIndex<T extends Searchable>(items: T[]): TextIndex<T> {
  return {
    entries: items.map((item) => ({
      item,
      name: makeField(item.name),
      aliases: (item.aliases || []).map(makeField),
      organ: item.organ ? makeField(item.organ) : undefined,
    })),
  };
}

// One-edit typo tolerance for a single longer token (kept deliberately narrow, as
// in the slide engine, so we never confuse two real medical terms).
function within1Edit(a: string, b: string): boolean {
  if (a === b) return true;
  const dl = a.length - b.length;
  if (dl > 1 || dl < -1) return false;
  let i = 0,
    j = 0,
    edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
    } else {
      if (++edits > 1) return false;
      if (a.length > b.length) i++;
      else if (a.length < b.length) j++;
      else {
        i++;
        j++;
      }
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

interface Query {
  norm: string;
  joined: string;
  tokens: string[];
}

/** Score how well `q` matches one indexed field. 0 = no match. */
function scoreField(q: Query, f: Field): number {
  if (!f.norm) return 0;

  // Punctuation-insensitive whole-string comparisons. "ki67" -> "Ki-67" lands
  // here at 100; without the joined form it scored nothing at all.
  if (f.joined === q.joined || f.norm === q.norm) return 100;

  // A prefix match scores by how much of the field the query covers, so it can
  // outrank another entry's exact-alias hit only when it is nearly the whole
  // name. "glioblastoma" covers most of "Glioblastoma, IDH-wildtype" and should
  // beat the entry merely carrying "glioblastoma" as a historical alias; "fl"
  // covers almost none of "Florid duct hyperplasia" and must not beat the entry
  // whose alias is exactly FL.
  if (f.joined.startsWith(q.joined) || f.norm.startsWith(q.norm)) {
    return 90 + Math.round((8 * q.joined.length) / Math.max(f.joined.length, 1));
  }
  if (f.joined.includes(q.joined)) return 78;

  if (!q.tokens.length || !f.tokens.length) return 0;
  const fSet = new Set(f.tokens);

  // All query tokens present as exact words, any order.
  if (q.tokens.every((t) => fSet.has(t))) return 74;
  // All present as a prefix/substring of some word (partial typing).
  if (q.tokens.every((t) => f.tokens.some((ft) => ft.startsWith(t) || ft.includes(t)))) return 66;
  // All present once a token may also match an inner-phrase acronym — this is
  // what resolves "clear cell rcc".
  if (q.tokens.every((t) => fSet.has(t) || f.acronyms.has(t))) return 62;

  // Fraction of query tokens found — lets a long query still rank partial hits,
  // and single-token queries fall back to a one-edit typo tolerance.
  const found = q.tokens.filter(
    (t) =>
      f.tokens.some((ft) => ft.includes(t) || (t.length >= 5 && within1Edit(t, ft))) ||
      f.acronyms.has(t)
  ).length;
  if (found === q.tokens.length) return 58;
  if (q.tokens.length >= 2 && found >= Math.ceil(q.tokens.length * 0.6)) {
    return 38 + Math.round((22 * found) / q.tokens.length);
  }
  return 0;
}

const MIN_SCORE = 38;
const ALIAS_WEIGHT = 0.92;
const ORGAN_WEIGHT = 0.5;

export interface RankOptions {
  /** Item ids to omit (entries already picked). */
  exclude?: Iterable<string>;
  limit?: number;
}

/**
 * Rank indexed items by relevance. Name matches outweigh alias matches, which
 * outweigh organ matches. Ties break toward the shorter name — the more
 * canonical entry ("Seminoma" over "Seminoma with syncytiotrophoblasts").
 */
export function rankIndexed<T extends Searchable>(
  query: string,
  index: TextIndex<T>,
  { exclude, limit = 12 }: RankOptions = {}
): T[] {
  const norm = normalizeMedical(query.trim());
  if (!norm) return [];
  const q: Query = { norm, joined: norm.replace(/[^a-z0-9]/g, ""), tokens: tokenize(norm) };
  const ex = exclude instanceof Set ? exclude : new Set(exclude || []);

  const scored: { item: T; score: number }[] = [];
  for (const e of index.entries) {
    if (ex.has(e.item.id)) continue;
    let best = scoreField(q, e.name);
    for (const a of e.aliases) best = Math.max(best, scoreField(q, a) * ALIAS_WEIGHT);
    if (e.organ) best = Math.max(best, scoreField(q, e.organ) * ORGAN_WEIGHT);
    if (best >= MIN_SCORE) scored.push({ item: e.item, score: best });
  }

  scored.sort((a, b) => b.score - a.score || a.item.name.length - b.item.name.length);
  return scored.slice(0, limit).map((s) => s.item);
}

/** Convenience wrapper for one-off ranking over a raw list (tests, small sets). */
export function rankByText<T extends Searchable>(query: string, items: T[], limit = 12): T[] {
  return rankIndexed(query, buildTextIndex(items), { limit });
}
