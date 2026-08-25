// Marker-vocabulary hygiene: what counts as a stain you can actually order,
// and folding the names that are one antibody wearing a pattern.
//
// Both problems have the same origin. The matrix's markers are extracted from
// WHO prose, and WHO prose does not restrict itself to naming antibodies. It
// writes "the tumour expresses neuroendocrine markers" and "abnormal
// cytoplasmic NPM1", and an extractor that pulls the subject of an expression
// claim yields a marker called `neuroendocrine markers` and three separate
// markers for NPM1. Both then show up in the picker as if they were stains, and
// they were: a real panel came back as CD34−, CD117−, Myeloperoxidase+, NPM1+,
// "Melanoma markers"+, "cytoplasmic NPM1"+, "abnormal cytoplasmic NPM1"+ —
// seven chips of which three were not stains and two were the same stain again.

import type { Cell, Marker, Matrix } from "./types";

/**
 * A CATEGORY PHRASE, not a stain: "neuroendocrine markers", "Melanoma markers",
 * "pan-B-cell antigens", "hormone stains".
 *
 * The test is a PLURAL category head. That is what separates the 40 phrases
 * from the real markers whose names legitimately end in the same word —
 * `S100 protein`, `MYC protein`, `ALK protein`, `C-reactive protein`,
 * `surfactant protein`, `Iron stain` are all singular and all real.
 *
 * These stay in the data and still render in a Reference profile, because
 * "positive for neuroendocrine markers" is a genuine WHO statement about the
 * entity. They are only withheld from the PICKER, where they are unusable: you
 * cannot run "neuroendocrine markers" on a slide, and entering one double-counts
 * with the synaptophysin and chromogranin you already entered.
 */
const CATEGORY_PHRASE = /\b(markers|antigens|stains|proteins)$/i;

export function isOrderableStain(marker: Marker): boolean {
  return !CATEGORY_PHRASE.test(marker.name.trim());
}

/** Drop category phrases — for the marker picker only, never for the data. */
export function orderableStains(markers: Marker[]): Marker[] {
  return markers.filter(isOrderableStain);
}

// Staining-pattern qualifiers WHO writes in front of a marker name. The pattern
// belongs in the cell's `pattern` field, which already exists for exactly this;
// carrying it in the marker NAME splits one antibody into several markers with
// one cell each and offers all of them in the picker.
const PATTERN_PREFIX =
  /^(abnormal|aberrant|cytoplasmic|nuclear|membranous|perinuclear|paranuclear|diffuse|focal|weak|strong|partial|dot-like|golgi)\s+/i;

/** Strip leading pattern words, returning the base name and what was stripped. */
function splitPattern(name: string): { base: string; pattern: string } {
  let rest = name;
  const words: string[] = [];
  let m = rest.match(PATTERN_PREFIX);
  while (m) {
    words.push(m[1].toLowerCase());
    rest = rest.slice(m[0].length);
    m = rest.match(PATTERN_PREFIX);
  }
  return { base: rest, pattern: words.join(" ") };
}

/**
 * Fold `cytoplasmic NPM1` and `abnormal cytoplasmic NPM1` into `NPM1`, moving
 * the qualifier into the cell's `pattern`.
 *
 * Only folds when the stripped name is ALREADY a marker in its own right, so a
 * marker that merely starts with one of these words is left alone. The
 * distinction the qualifier carries is not lost — cytoplasmic CD3 is a real and
 * different finding from surface CD3, and it still reads as "CD3, pattern:
 * cytoplasmic". It stops being a different *antibody*, which it never was.
 */
export function mergePatternMarkers(
  matrix: Matrix,
  poolDuplicates: (cells: Cell[], targetId: string) => Cell
): Matrix {
  const byName = new Map(matrix.markers.map((m) => [m.name.trim().toLowerCase(), m]));

  // old marker id -> { base marker id, qualifier }
  const fold = new Map<string, { to: string; pattern: string }>();
  for (const m of matrix.markers) {
    const { base, pattern } = splitPattern(m.name.trim());
    if (!pattern) continue;
    const target = byName.get(base.toLowerCase());
    if (!target || target.id === m.id) continue;
    fold.set(m.id, { to: target.id, pattern });
  }
  if (fold.size === 0) return matrix;

  // The folded names stay searchable as aliases of the survivor.
  const extraAliases = new Map<string, string[]>();
  for (const [fromId, { to }] of fold) {
    const from = matrix.markers.find((m) => m.id === fromId);
    if (!from) continue;
    extraAliases.set(to, [...(extraAliases.get(to) ?? []), from.name]);
  }
  const markers = matrix.markers
    .filter((m) => !fold.has(m.id))
    .map((m) => {
      const extra = extraAliases.get(m.id);
      return extra ? { ...m, aliases: [...new Set([...(m.aliases ?? []), ...extra])] } : m;
    });

  // Re-key the cells, then pool the (diagnosis, marker) pairs that now collide —
  // an entity stating both `CD3` and `cytoplasmic CD3` must end with one cell,
  // reconciled by the same rules any other duplicate evidence gets.
  const bucket = new Map<string, Cell[]>();
  for (const c of matrix.cells) {
    const f = fold.get(c.m);
    const cell = f ? { ...c, m: f.to, pattern: c.pattern ?? f.pattern } : c;
    const key = `${cell.d}|${cell.m}`;
    const list = bucket.get(key);
    if (list) list.push(cell);
    else bucket.set(key, [cell]);
  }
  const cells: Cell[] = [];
  for (const group of bucket.values()) {
    cells.push(group.length === 1 ? group[0] : poolDuplicates(group, group[0].d));
  }

  return { ...matrix, markers, cells };
}
