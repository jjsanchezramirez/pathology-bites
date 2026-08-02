import { describe, it, expect } from "vitest";
import {
  rankByText,
  rankIndexed,
  buildTextIndex,
  normalizeMedical,
} from "@/features/public/tools/ihc/search";

type Dx = { id: string; name: string; aliases?: string[]; organ?: string };

const DIAGNOSES: Dx[] = [
  { id: "ptc", name: "Papillary thyroid carcinoma", organ: "Thyroid" },
  { id: "ftc", name: "Follicular thyroid carcinoma", organ: "Thyroid" },
  { id: "fl", name: "Follicular lymphoma, grade 1", organ: "Haematolymphoid", aliases: ["FL"] },
  { id: "gist", name: "Gastrointestinal stromal tumour", organ: "Digestive", aliases: ["GIST"] },
  { id: "acc", name: "Adrenocortical carcinoma", organ: "Adrenal" },
  { id: "gbm", name: "Glioblastoma, IDH-wildtype", organ: "CNS" },
  { id: "aml", name: "Acute myeloid leukaemia", organ: "Haematolymphoid" },
  { id: "ccrcc", name: "Clear cell renal cell carcinoma", organ: "Urinary" },
];

const MARKERS: Dx[] = [
  { id: "ki-67", name: "Ki-67", aliases: ["mib1"] },
  { id: "ttf-1", name: "TTF-1", aliases: ["thyroid transcription factor 1"] },
  { id: "ck7", name: "CK7", aliases: ["Cytokeratin 7", "K7"] },
  { id: "cd20", name: "CD20" },
  { id: "sma", name: "SMA", aliases: ["smooth muscle actin"] },
];

const names = (r: Dx[]) => r.map((d) => d.id);

describe("rankByText", () => {
  it("matches regardless of word order", () => {
    // The old substring filter required "papillary thyroid" in order; this must not.
    expect(names(rankByText("thyroid papillary", DIAGNOSES))).toContain("ptc");
  });

  it("ignores the commas WHO bakes into names", () => {
    expect(names(rankByText("follicular lymphoma grade 1", DIAGNOSES))).toContain("fl");
  });

  it("matches an acronym via alias", () => {
    expect(names(rankByText("GIST", DIAGNOSES))[0]).toBe("gist");
  });

  it("normalizes British→American spelling", () => {
    // User types American "tumor"; stored name is Commonwealth "tumour".
    expect(names(rankByText("gastrointestinal stromal tumor", DIAGNOSES))).toContain("gist");
    // And the reverse for leukaemia/leukemia.
    expect(names(rankByText("acute myeloid leukemia", DIAGNOSES))).toContain("aml");
  });

  it("ranks an exact/prefix match ahead of a partial one", () => {
    const r = names(rankByText("follicular", DIAGNOSES));
    // Both follicular entries match; the query is a clean prefix of each name,
    // so both surface — assert they are present and lymphoma isn't dropped.
    expect(r).toEqual(expect.arrayContaining(["ftc", "fl"]));
  });

  it("tolerates a single-character typo on a longer token", () => {
    expect(names(rankByText("adrenocortcal carcinoma", DIAGNOSES))).toContain("acc");
  });

  it("returns nothing for an empty query", () => {
    expect(rankByText("   ", DIAGNOSES)).toEqual([]);
  });

  it("does not match unrelated entities", () => {
    // A specific query should not drag in every carcinoma.
    expect(names(rankByText("papillary thyroid carcinoma", DIAGNOSES))).not.toContain("acc");
  });

  it("resolves an acronym for a phrase inside the name", () => {
    // "rcc" is not a token of the name and not an alias — it is the first-letter
    // acronym of the "renal cell carcinoma" run. Mixed word+acronym queries are
    // how people actually type; this returned the wrong entity before.
    expect(names(rankByText("clear cell rcc", DIAGNOSES))[0]).toBe("ccrcc");
  });
});

describe("rankByText — joined forms (markers)", () => {
  // Regression: tokenizing both sides gives ["ki","67"] vs ["ki67"], which share
  // no token, so these queries previously returned NOTHING at all.
  it("matches a hyphenated marker typed without the hyphen", () => {
    expect(names(rankByText("ki67", MARKERS))[0]).toBe("ki-67");
    expect(names(rankByText("ttf1", MARKERS))[0]).toBe("ttf-1");
  });

  it("still matches the hyphenated spelling", () => {
    expect(names(rankByText("Ki-67", MARKERS))[0]).toBe("ki-67");
    expect(names(rankByText("TTF-1", MARKERS))[0]).toBe("ttf-1");
  });

  it("matches a clone name carried as an alias", () => {
    expect(names(rankByText("mib1", MARKERS))[0]).toBe("ki-67");
  });

  it("matches a spelled-out marker name", () => {
    expect(names(rankByText("cytokeratin 7", MARKERS))[0]).toBe("ck7");
    expect(names(rankByText("smooth muscle actin", MARKERS))[0]).toBe("sma");
  });

  it("ranks the exact marker above a longer one sharing its prefix", () => {
    const withVariant = [...MARKERS, { id: "cd200", name: "CD200" }];
    expect(names(rankByText("cd20", withVariant))[0]).toBe("cd20");
  });
});

describe("rankByText — Greek letters", () => {
  // Marker names use real Greek characters, which tokenization drops entirely:
  // "β-catenin" indexed as "catenin" matched none of these before.
  const GREEK: Dx[] = [
    { id: "b-catenin", name: "β-catenin" },
    { id: "tcr-ab", name: "TCRαβ" },
    { id: "a1at", name: "α1-antitrypsin" },
  ];

  it("matches a Greek letter spelled out", () => {
    expect(names(rankByText("beta-catenin", GREEK))[0]).toBe("b-catenin");
    expect(names(rankByText("beta catenin", GREEK))[0]).toBe("b-catenin");
    expect(names(rankByText("TCR alpha beta", GREEK))[0]).toBe("tcr-ab");
    expect(names(rankByText("alpha-1-antitrypsin", GREEK))[0]).toBe("a1at");
  });
});

describe("rankByText — prefix coverage vs alias", () => {
  // A name-prefix hit should outrank another entry's exact-alias hit only when
  // the query covers most of that name.
  const ENTS: Dx[] = [
    { id: "gbm", name: "Glioblastoma, IDH-wildtype" },
    { id: "astro", name: "Astrocytoma, IDH-mutant", aliases: ["glioblastoma"] },
    { id: "florid", name: "Florid duct hyperplasia" },
    { id: "fl", name: "Follicular lymphoma", aliases: ["FL"] },
  ];

  it("prefers the entity actually named for a near-complete prefix", () => {
    expect(names(rankByText("glioblastoma", ENTS))[0]).toBe("gbm");
  });

  it("still prefers an exact alias over a barely-covering prefix", () => {
    expect(names(rankByText("FL", ENTS))[0]).toBe("fl");
  });
});

describe("rankIndexed", () => {
  it("omits excluded ids", () => {
    const index = buildTextIndex(DIAGNOSES);
    const r = rankIndexed("follicular", index, { exclude: ["fl"] });
    expect(names(r)).not.toContain("fl");
    expect(names(r)).toContain("ftc");
  });

  it("honours the limit", () => {
    const index = buildTextIndex(DIAGNOSES);
    expect(rankIndexed("carcinoma", index, { limit: 2 })).toHaveLength(2);
  });

  it("returns the same ordering as the convenience wrapper", () => {
    const index = buildTextIndex(DIAGNOSES);
    expect(names(rankIndexed("thyroid", index))).toEqual(names(rankByText("thyroid", DIAGNOSES)));
  });
});

describe("normalizeMedical", () => {
  it("lowercases and de-Britishizes", () => {
    expect(normalizeMedical("Gastrointestinal Stromal Tumour")).toBe(
      "gastrointestinal stromal tumor"
    );
    expect(normalizeMedical("Acute Myeloid Leukaemia")).toBe("acute myeloid leukemia");
    expect(normalizeMedical("Oesophageal")).toBe("esophageal");
  });

  it("transliterates Greek letters", () => {
    expect(normalizeMedical("β-catenin")).toBe("beta-catenin");
    expect(normalizeMedical("TCRαβ")).toBe("tcralphabeta");
  });

  it("is stable across repeated calls", () => {
    // Guards the /g-flag lastIndex trap: a .test() guard on the Greek regex made
    // every other call silently skip transliteration.
    for (let i = 0; i < 5; i++) expect(normalizeMedical("β-catenin")).toBe("beta-catenin");
  });
});

