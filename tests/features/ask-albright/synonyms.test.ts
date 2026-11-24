import { describe, it, expect } from "vitest";
import {
  aliasGroup,
  aliasPattern,
  markerCandidates,
  namesFromTerm,
  normalizeTerm,
  sameMarkerNote,
  termAlternatives,
} from "@/features/user/ask-albright/lib/synonyms";
import { rankPages } from "@/features/user/ask-albright/lib/rank";
import { buildAnswerPrompt } from "@/features/user/ask-albright/lib/router";

// Shaped like the real knowledge-base rows (markers + marker_synonyms).
const CD117 = {
  name: "CD117",
  gene_symbols: null,
  marker_synonyms: [{ term: "KIT" }, { term: "KIT (CD117)" }, { term: "KIT (CD117, c-KIT)" }],
};
const TTF1 = {
  name: "TTF-1",
  gene_symbols: null,
  marker_synonyms: [{ term: "TTF1" }, { term: "TTF1 (NKX2-1)" }],
};

describe("normalizeTerm / markerCandidates", () => {
  it("matches marker_synonyms.term_normalized", () => {
    expect(normalizeTerm("TTF1 (NKX2-1)")).toBe("ttf1 nkx2 1");
    expect(normalizeTerm("D2‑40")).toBe("d2 40");
  });
  it("pulls marker-ish words from a question", () => {
    expect(markerCandidates("Is CD117 or TTF-1 positive?")).toEqual([
      "is",
      "cd117",
      "or",
      "ttf 1",
      "positive",
    ]);
  });
});

describe("namesFromTerm / aliasGroup", () => {
  it("splits parenthetical synonyms and drops event names", () => {
    expect(namesFromTerm("KIT (CD117, c-KIT)")).toEqual(["KIT", "CD117", "c-KIT"]);
    expect(namesFromTerm("activating KIT mutations")).toEqual([]);
  });
  it("de-duplicates across name, synonyms and gene symbols", () => {
    expect(aliasGroup(CD117)).toEqual({ name: "CD117", aliases: ["CD117", "KIT", "c-KIT"] });
    expect(aliasGroup(TTF1).aliases).toEqual(["TTF-1", "NKX2-1"]);
  });
});

describe("aliasPattern", () => {
  it("matches however the alias is punctuated", () => {
    const re = new RegExp(aliasPattern("TTF-1"), "i");
    for (const s of ["TTF-1", "TTF1", "ttf 1"]) expect(re.test(s)).toBe(true);
  });
});

describe("termAlternatives + rankPages", () => {
  const groups = [aliasGroup(CD117)];

  it("matches a question term however it is punctuated (TTF1 vs TTF-1)", () => {
    expect(termAlternatives(["ttf1"], [aliasGroup(TTF1)]).get("ttf1")).toEqual(["ttf 1", "nkx2 1"]);
  });

  it("maps a question term to its synonyms", () => {
    const alts = termAlternatives(["cd117", "oncocytoma"], groups);
    expect(alts.get("cd117")).toEqual(["cd117", "kit", "c kit"]);
    expect(alts.has("oncocytoma")).toBe(false);
  });

  it("ranks a page that only says KIT as matching a question about CD117", () => {
    const pages = [
      { source: "outlines" as const, title: "a", href: "a", body: "oncocytoma overview", rank: 0 },
      { source: "who" as const, title: "b", href: "b", body: "oncocytoma: KIT +++", rank: 0 },
    ];
    const q = "Is CD117 positive in oncocytoma?";
    expect(rankPages(pages, q, "outlines")[0].href).toBe("a");
    expect(rankPages(pages, q, "outlines", termAlternatives(["cd117"], groups))[0].href).toBe("b");
  });

  it("does not match a synonym inside a longer word", () => {
    const pages = [
      { source: "outlines" as const, title: "a", href: "a", body: "a kitten", rank: 0 },
      { source: "who" as const, title: "b", href: "b", body: "nothing", rank: 0 },
    ];
    const ranked = rankPages(pages, "CD117", "who", termAlternatives(["cd117"], groups));
    expect(ranked[0].href).toBe("b");
  });
});

describe("sameMarkerNote", () => {
  it("states the equivalence once per marker, and is empty with none", () => {
    expect(sameMarkerNote([aliasGroup(CD117), aliasGroup(TTF1)])).toBe(
      "Same marker: CD117 = KIT = c-KIT; TTF-1 = NKX2-1."
    );
    expect(sameMarkerNote([])).toBe("");
  });
  it("goes between the sources and the question in the answer prompt", () => {
    const p = buildAnswerPrompt("Q?", [{ title: "T", text: "x" }], "Same marker: CD117 = KIT.");
    expect(p).toBe("Sources:\n[1] T: x\n\nSame marker: CD117 = KIT.\nQuestion: Q?");
  });
});
