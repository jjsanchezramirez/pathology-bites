// One ordering rule for marker names, used everywhere a list of markers is
// shown. It exists because the obvious `localeCompare` is wrong for the names
// pathologists actually read: it compares "CD10" < "CD20" < "CD3" < "CD5",
// because it sorts digit characters, not numbers. A CD panel listed that way
// looks shuffled to anyone who knows the cluster numbering, and that was the
// single most visible ordering complaint about this tool.
//
// The rule is a natural sort — split each name into alphabetic and numeric
// runs, compare runs pairwise, and compare numeric runs as numbers. So:
//
//   CD3 · CD5 · CD10 · CD20 · CD23 · CD79a      (not CD10 · CD20 · CD23 · CD3)
//   CK5/6 · CK7 · CK20                          (not CK20 · CK5/6 · CK7)
//   p16 · p40 · p53 · p63                       (already right, and stays right)
//
// Names are folded through the app's own `normalizeMedicalSpelling` first, so
// case cannot strand "Pax5" outside a run of lowercase names and a real Greek
// letter sorts as the word it is read as: "β-catenin" becomes "beta-catenin"
// and lands among the B's instead of after Z, where its U+03B2 code point would
// otherwise put it. (Rolling a private fold here would be a second normaliser —
// the exact thing TOOLING-INDEX warns about.)

import { normalizeMedicalSpelling } from "@/shared/utils/text/medical-spelling";

const NUM_RUN = /(\d+)/;

/** Split "CD79a" into ["cd", 79, "a"] — strings and numbers, in order. */
function chunks(name: string): (string | number)[] {
  return normalizeMedicalSpelling(name)
    .split(NUM_RUN)
    .filter((part) => part !== "")
    .map((part) => (/^\d+$/.test(part) ? Number(part) : part));
}

/**
 * Natural-order comparator for marker names. Stable and total: names that
 * compare equal chunk-for-chunk fall back to a plain string compare so the
 * order never depends on input order.
 */
export function compareMarkerNames(a: string, b: string): number {
  const ca = chunks(a);
  const cb = chunks(b);
  const n = Math.min(ca.length, cb.length);
  for (let i = 0; i < n; i++) {
    const x = ca[i];
    const y = cb[i];
    if (typeof x === "number" && typeof y === "number") {
      if (x !== y) return x - y;
    } else if (typeof x === "number") {
      // A number sorts before a word at the same position: "CD3" before "CDX2".
      return -1;
    } else if (typeof y === "number") {
      return 1;
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  if (ca.length !== cb.length) return ca.length - cb.length;
  return a.localeCompare(b);
}
