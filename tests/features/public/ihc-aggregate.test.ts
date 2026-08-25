import { describe, it, expect } from "vitest";
import { aggregateMatrix, canonicalName } from "@/features/public/tools/ihc/aggregate";
import { scoreDiagnoses } from "@/features/public/tools/ihc/panel-engine";
import type { Matrix, Cell, Diagnosis } from "@/features/public/tools/ihc/types";

function dx(id: string, name: string, organ: string, book?: string): Diagnosis {
  return { id, name, organ, book };
}
function cell(d: string, m: string, polarity: Cell["polarity"], extra: Partial<Cell> = {}): Cell {
  return { d, m, polarity, pct: null, refs: [], ...extra };
}

/** The real shape of the complaint: one tumour, four chapter rows, four books. */
function mzlMatrix(): Matrix {
  return {
    version: 3,
    generatedAt: "",
    markers: ["cd20", "cd5", "cd10"].map((id) => ({ id, name: id.toUpperCase() })),
    diagnoses: [
      dx("mzl--female-genital", "Extranodal marginal zone lymphoma", "Female Genital", "FG"),
      dx("mzl--eye", "Extranodal marginal zone lymphoma", "Eye and Orbit", "Eye"),
      dx("mzl-malt--head-and-neck", "Extranodal marginal zone lymphoma of MALT", "Head and Neck", "HN"),
      dx("mzl-malt--breast", "Extranodal marginal zone lymphoma of MALT (MALT lymphoma)", "Breast", "Br"),
      dx("dlbcl--haem", "Diffuse large B-cell lymphoma", "Haematolymphoid", "Haem"),
    ],
    references: {},
    cells: [
      cell("mzl--female-genital", "cd20", "positive", { refs: ["1"], quote: "FG says CD20+" }),
      cell("mzl--female-genital", "cd5", "negative"),
      cell("mzl--eye", "cd20", "positive", { refs: ["2"], quote: "Eye says CD20+" }),
      cell("mzl--eye", "cd10", "negative"),
      cell("mzl-malt--head-and-neck", "cd20", "positive"),
      cell("mzl-malt--breast", "cd20", "positive"),
      cell("dlbcl--haem", "cd20", "positive"),
      cell("dlbcl--haem", "cd10", "positive"),
    ],
  };
}

describe("canonicalName", () => {
  it("folds a trailing parenthetical, punctuation and Commonwealth spelling", () => {
    expect(canonicalName("Acute myeloid leukaemia (AML)")).toBe(canonicalName("Acute myeloid leukemia"));
    expect(canonicalName("Follicular lymphoma, grade 1")).toBe("follicular lymphoma grade 1");
    // A parenthetical in the MIDDLE is part of the name and is NOT dropped.
    expect(canonicalName("Melanoma (in situ) of skin")).not.toBe("melanoma of skin");
  });
});

describe("aggregateMatrix", () => {
  it("collapses same-named chapter rows into one tumour and lists every organ", () => {
    const { matrix, stats } = aggregateMatrix(mzlMatrix());
    const names = matrix.diagnoses.map((d) => d.name);
    // 5 chapter rows -> 3 tumours: MZL, MZL of MALT (+ its parenthetical twin), DLBCL
    expect(matrix.diagnoses).toHaveLength(3);
    expect(stats.before).toBe(5);
    expect(stats.after).toBe(3);
    const mzl = matrix.diagnoses.find((d) => d.name === "Extranodal marginal zone lymphoma")!;
    expect(mzl.organs).toEqual(["Eye and Orbit", "Female Genital"]);
    expect(mzl.books).toEqual(["Eye", "FG"]);
    expect(mzl.memberIds).toHaveLength(2);
    // the parenthetical restatement folded into the plain name, not a 4th entry
    expect(names).toContain("Extranodal marginal zone lymphoma of MALT");
    expect(names).not.toContain("Extranodal marginal zone lymphoma of MALT (MALT lymphoma)");
  });

  it("pools evidence rather than picking one book", () => {
    const { matrix } = aggregateMatrix(mzlMatrix());
    const mzl = matrix.diagnoses.find((d) => d.name === "Extranodal marginal zone lymphoma")!;
    const cd20 = matrix.cells.find((c) => c.d === mzl.id && c.m === "cd20")!;
    expect(cd20.refs.sort()).toEqual(["1", "2"]);
    expect(cd20.quotes).toEqual(["FG says CD20+", "Eye says CD20+"]);
    expect(cd20.sourceCount).toBe(2);
    // markers stated in only one of the merged books are kept, not lost
    const markers = matrix.cells.filter((c) => c.d === mzl.id).map((c) => c.m).sort();
    expect(markers).toEqual(["cd10", "cd20", "cd5"]);
  });

  it("marks a positive/negative disagreement between volumes as unsettled", () => {
    const m = mzlMatrix();
    m.cells.push(cell("mzl--eye", "cd5", "positive"));
    const { matrix } = aggregateMatrix(m);
    const mzl = matrix.diagnoses.find((d) => d.name === "Extranodal marginal zone lymphoma")!;
    const cd5 = matrix.cells.find((c) => c.d === mzl.id && c.m === "cd5")!;
    expect(cd5.conflicted).toBe(true);
    expect(cd5.status).toBe("review");
  });

  it("case-weights pooled percentages", () => {
    const m = mzlMatrix();
    m.cells = [
      cell("mzl--female-genital", "cd20", "positive", { pct: 100, n: 90 }),
      cell("mzl--eye", "cd20", "positive", { pct: 50, n: 10 }),
    ];
    const { matrix } = aggregateMatrix(m);
    const mzl = matrix.diagnoses.find((d) => d.name === "Extranodal marginal zone lymphoma")!;
    const cd20 = matrix.cells.find((c) => c.d === mzl.id && c.m === "cd20")!;
    expect(cd20.pct).toBe(95); // (100*90 + 50*10) / 100, not the 75 a plain mean gives
    expect(cd20.n).toBe(100);
  });

  it("applies the graph's curated merge map across differing names", () => {
    const m = mzlMatrix();
    const { matrix, stats } = aggregateMatrix(m, {
      "mzl-malt--head-and-neck": "mzl--female-genital",
      "mzl-malt--breast": "mzl--female-genital",
    });
    expect(stats.redirectsApplied).toBe(2);
    // now every MZL row is one tumour; only DLBCL remains beside it
    expect(matrix.diagnoses).toHaveLength(2);
    const mzl = matrix.diagnoses.find((d) => d.name.startsWith("Extranodal"))!;
    expect(mzl.memberIds).toHaveLength(4);
    // the folded spellings stay searchable as aliases
    expect(mzl.aliases).toContain("Extranodal marginal zone lymphoma of MALT");
  });

  it("stops the duplicate differential the complaint was about", () => {
    const raw = mzlMatrix();
    const obs = { cd20: "positive", cd5: "negative", cd10: "negative" } as const;
    const before = scoreDiagnoses(raw, obs).filter((r) => r.diagnosis.name.startsWith("Extranodal"));
    expect(before.length).toBe(4); // one per chapter — the bug

    const { matrix } = aggregateMatrix(raw);
    const after = scoreDiagnoses(matrix, obs).filter((r) =>
      r.diagnosis.name.startsWith("Extranodal")
    );
    expect(after.length).toBe(2); // one per genuinely distinct WHO name
  });

  // Both of the following were found by running the aggregation over the real
  // 14,382-cell matrix, and both were wrong in the first cut. They are the two
  // rules most likely to be "simplified" back into bugs later.
  describe("pooling rules learned from the live data", () => {
    it("does not let a hedged minority unsettle a call four volumes state flatly", () => {
      // Verbatim shape of extranodal MZL's CD5: four volumes "typically
      // negative", one "a small subset (< 4%) expresses CD5". They agree.
      const m = mzlMatrix();
      m.cells = [
        cell("mzl--female-genital", "cd5", "negative", { certainty: "definite" }),
        cell("mzl--eye", "cd5", "positive", { certainty: "variable" }),
      ];
      const { matrix } = aggregateMatrix(m);
      const mzl = matrix.diagnoses.find((d) => d.name === "Extranodal marginal zone lymphoma")!;
      const cd5 = matrix.cells.find((c) => c.d === mzl.id && c.m === "cd5")!;
      expect(cd5.polarity).toBe("negative");
      expect(cd5.conflicted).toBeUndefined(); // a qualification, not a contradiction
      expect(cd5.certainty).toBe("variable"); // but the exception is not hidden
      expect(cd5.status).not.toBe("review");
    });

    it("still marks a definite-vs-definite disagreement as a real conflict", () => {
      const m = mzlMatrix();
      m.cells = [
        cell("mzl--female-genital", "cd5", "negative", { certainty: "definite" }),
        cell("mzl--eye", "cd5", "positive", { certainty: "definite" }),
      ];
      const { matrix } = aggregateMatrix(m);
      const mzl = matrix.diagnoses.find((d) => d.name === "Extranodal marginal zone lymphoma")!;
      const cd5 = matrix.cells.find((c) => c.d === mzl.id && c.m === "cd5")!;
      expect(cd5.conflicted).toBe(true);
      expect(cd5.status).toBe("review");
    });

    it("takes certainty from the majority, not from any single mis-scoped hedge", () => {
      // WHO's "express CD20, CD79a, and PAX5; usually IgM; occasionally IgG…"
      // makes the extraction tag CD20 `variable` although the hedge belongs to
      // the immunoglobulin clause. Two flat statements outvote one such row.
      const m = mzlMatrix();
      m.cells = [
        cell("mzl--female-genital", "cd20", "positive", { certainty: "definite" }),
        cell("mzl--eye", "cd20", "positive", { certainty: "definite" }),
        cell("mzl-malt--head-and-neck", "cd20", "positive", { certainty: "variable" }),
      ];
      const { matrix } = aggregateMatrix(m, { "mzl-malt--head-and-neck": "mzl--female-genital" });
      const mzl = matrix.diagnoses.find((d) => d.name.startsWith("Extranodal"))!;
      const cd20 = matrix.cells.find((c) => c.d === mzl.id && c.m === "cd20")!;
      expect(cd20.certainty).toBe("definite");
      // …and the reverse majority is still honoured (a tie goes to definite,
      // so this needs a genuine hedged majority, not 1-1)
      const m2 = mzlMatrix();
      m2.cells = [
        cell("mzl--female-genital", "cd20", "positive", { certainty: "definite" }),
        cell("mzl--eye", "cd20", "positive", { certainty: "variable" }),
        cell("mzl-malt--head-and-neck", "cd20", "positive", { certainty: "variable" }),
      ];
      const r2 = aggregateMatrix(m2, { "mzl-malt--head-and-neck": "mzl--female-genital" }).matrix;
      const e2 = r2.diagnoses.find((d) => d.name.startsWith("Extranodal"))!;
      expect(r2.cells.find((c) => c.d === e2.id && c.m === "cd20")!.certainty).toBe("variable");
    });

    it("does not let one disputed extraction unsettle four confirmations", () => {
      const m = mzlMatrix();
      m.cells = [
        cell("mzl--female-genital", "cd10", "negative", { status: "confirmed" }),
        cell("mzl--eye", "cd10", "negative", { status: "review" }),
      ];
      const { matrix } = aggregateMatrix(m);
      const mzl = matrix.diagnoses.find((d) => d.name === "Extranodal marginal zone lymphoma")!;
      expect(matrix.cells.find((c) => c.d === mzl.id && c.m === "cd10")!.status).toBe("confirmed");
    });

    it("never pools a percentage reported for the polarity it did not land on", () => {
      const m = mzlMatrix();
      m.cells = [
        cell("mzl--female-genital", "cd5", "negative", { certainty: "definite" }),
        cell("mzl--eye", "cd5", "positive", { certainty: "variable", pct: 4 }),
      ];
      const { matrix } = aggregateMatrix(m);
      const mzl = matrix.diagnoses.find((d) => d.name === "Extranodal marginal zone lymphoma")!;
      // 4% is the rate of the POSITIVE subset; carrying it onto a negative call
      // would read as "negative in 4% of cases", which no source said.
      expect(matrix.cells.find((c) => c.d === mzl.id && c.m === "cd5")!.pct).toBeNull();
    });
  });

  it("is a pure function — the input matrix is untouched", () => {
    const raw = mzlMatrix();
    const before = JSON.stringify(raw);
    aggregateMatrix(raw, { "mzl--eye": "mzl--female-genital" });
    expect(JSON.stringify(raw)).toBe(before);
  });

  it("survives a cyclic merge map instead of hanging", () => {
    const { matrix } = aggregateMatrix(mzlMatrix(), {
      "mzl--eye": "mzl--female-genital",
      "mzl--female-genital": "mzl--eye",
    });
    expect(matrix.diagnoses.length).toBeGreaterThan(0);
  });
});
