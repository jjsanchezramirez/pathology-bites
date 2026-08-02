// WHO/IARC uses Commonwealth spelling ("tumour", "leukaemia", "oesophagus");
// users type American, and the image library is captioned in American English.
// Normalizing both sides of a search to one form turns near-misses into hits —
// e.g. "stromal tumour" finds "stromal tumor" captions it otherwise never would.
//
// Replacements are word-stem anchored, not blind digraph swaps: a naive "oe"->"e"
// would corrupt "amoeboid"/"coelom", so we only rewrite known medical stems.

const SPELLING: [RegExp, string][] = [
  [/tumours?/g, "tumor"],
  [/leukaemias?/g, "leukemia"],
  [/oesophag/g, "esophag"],
  [/oestrogen/g, "estrogen"],
  [/haemangi/g, "hemangi"],
  [/haemat/g, "hemat"],
  [/haemorrh/g, "hemorrh"],
  [/paediatr/g, "pediatr"],
  [/coeliac/g, "celiac"],
  [/oedema/g, "edema"],
  [/anaemia/g, "anemia"],
  [/fibre/g, "fiber"],
];

// Marker names carry real Greek letters (β-catenin, TCRαβ, 34βE12, α1-antitrypsin)
// but nobody types them — people spell the letter out. A Greek character is also
// not alphanumeric, so it is dropped by tokenization entirely: "β-catenin" indexed
// as "catenin" never matched the query "beta-catenin" at all. Transliterating to
// the Latin name puts both sides in the same alphabet.
const GREEK: Record<string, string> = {
  α: "alpha",
  β: "beta",
  γ: "gamma",
  δ: "delta",
  ε: "epsilon",
  ζ: "zeta",
  η: "eta",
  θ: "theta",
  ι: "iota",
  κ: "kappa",
  λ: "lambda",
  μ: "mu",
  ν: "nu",
  ξ: "xi",
  π: "pi",
  ρ: "rho",
  σ: "sigma",
  τ: "tau",
  υ: "upsilon",
  φ: "phi",
  χ: "chi",
  ψ: "psi",
  ω: "omega",
};
const GREEK_RE = new RegExp(`[${Object.keys(GREEK).join("")}]`, "g");

/** Lowercase, transliterate Greek letters, and normalize Commonwealth→American
 *  spelling. Punctuation is left intact for a downstream tokenizer to handle. */
export function normalizeMedicalSpelling(s: string): string {
  // NB: no `.test()` guard — GREEK_RE is /g, and test() would advance lastIndex
  // and desync every subsequent call. replace() resets it on its own.
  let out = (s || "").toLowerCase().replace(GREEK_RE, (c) => GREEK[c] ?? c);
  for (const [re, to] of SPELLING) out = out.replace(re, to);
  return out;
}
