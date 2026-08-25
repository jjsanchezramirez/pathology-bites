import { describe, it, expect } from "vitest";
import {
  scoreDiagnoses,
  explainScore,
  outcomeProbs,
  profileForDiagnosis,
} from "@/features/public/tools/ihc/panel-engine";
import { compareMarkerNames } from "@/features/public/tools/ihc/marker-order";
import type { Matrix, Cell } from "@/features/public/tools/ihc/types";

function cell(d: string, m: string, polarity: Cell["polarity"], extra: Partial<Cell> = {}): Cell {
  return { d, m, polarity, pct: null, refs: [], ...extra };
}

describe("compareMarkerNames", () => {
  it("orders CD numbers numerically, not lexically", () => {
    const sorted = ["CD20", "CD3", "CD10", "CD5", "CD79a", "CD23"].sort(compareMarkerNames);
    expect(sorted).toEqual(["CD3", "CD5", "CD10", "CD20", "CD23", "CD79a"]);
  });
  it("orders keratins and p-proteins the way they are read", () => {
    expect(["CK20", "CK7", "CK5/6"].sort(compareMarkerNames)).toEqual(["CK5/6", "CK7", "CK20"]);
    expect(["p63", "p16", "p53", "p40"].sort(compareMarkerNames)).toEqual(["p16", "p40", "p53", "p63"]);
  });
  it("folds case and accents so no name strands outside its run", () => {
    expect(["Pax5", "PAX2", "pax8"].sort(compareMarkerNames)).toEqual(["PAX2", "Pax5", "pax8"]);
    // β transliterates to "beta", so it sorts among the B's — not after Z,
    // where its U+03B2 code point would otherwise strand it.
    const run = ["CD3", "β-catenin", "B-cell", "AE1/AE3"].sort(compareMarkerNames);
    expect(run.indexOf("β-catenin")).toBeGreaterThan(run.indexOf("AE1/AE3"));
    expect(run.indexOf("β-catenin")).toBeLessThan(run.indexOf("CD3"));
  });
  it("is total and stable — equal-ordering names never swap on re-sort", () => {
    const once = ["CD3", "CD3", "CD5"].sort(compareMarkerNames);
    expect(once.slice().sort(compareMarkerNames)).toEqual(once);
  });
});

describe("outcomeProbs", () => {
  it("gives a hedged call real mass on 'variable', a definite one much less", () => {
    const hedged = outcomeProbs(cell("a", "m", "positive", { certainty: "variable" }));
    const definite = outcomeProbs(cell("a", "m", "positive", { certainty: "definite" }));
    expect(hedged.variable).toBeGreaterThan(definite.variable);
    expect(definite.positive).toBeGreaterThan(hedged.positive);
  });
  it("peaks 'variable' at a mid-range reported percentage", () => {
    expect(outcomeProbs(cell("a", "m", "positive", { pct: 50 })).variable).toBeGreaterThan(
      outcomeProbs(cell("a", "m", "positive", { pct: 95 })).variable
    );
  });
  it("treats an index and a disputed call as making no claim at all", () => {
    for (const c of [
      cell("a", "m", "index", { pct: 3 }),
      cell("a", "m", "positive", { status: "review" }),
    ]) {
      const p = outcomeProbs(c);
      expect(p.positive).toBeCloseTo(1 / 3, 5);
      expect(p.negative).toBeCloseTo(1 / 3, 5);
    }
  });
});

/**
 * Ten entities all positive for a ubiquitous marker; one of them also positive
 * for a rare one. Matching the ubiquitous marker should be worth almost nothing.
 */
function baseRateMatrix(): Matrix {
  const diagnoses = Array.from({ length: 10 }, (_, i) => ({
    id: `d${i}`,
    name: `D${i}`,
    organ: "x",
  }));
  const cells: Cell[] = diagnoses.map((d) => cell(d.id, "common", "positive"));
  cells.push(cell("d0", "rare", "positive"));
  for (let i = 1; i < 10; i++) cells.push(cell(`d${i}`, "rare", "negative"));
  return {
    version: 1,
    generatedAt: "",
    markers: [
      { id: "common", name: "COMMON" },
      { id: "rare", name: "RARE" },
    ],
    diagnoses,
    references: {},
    cells,
  };
}

describe("scoreDiagnoses — likelihood ratio", () => {
  it("scores a ubiquitous match near zero and a rare match highly", () => {
    const m = baseRateMatrix();
    const common = explainScore(m, "d3", { common: "positive" })[0];
    const rare = explainScore(m, "d0", { rare: "positive" })[0];
    expect(Math.abs(common.bits)).toBeLessThan(0.3); // told us almost nothing
    expect(rare.bits).toBeGreaterThan(2); // a rare positive is real evidence
  });

  it("lets the rare marker decide the ranking the common one cannot", () => {
    const m = baseRateMatrix();
    const flat = scoreDiagnoses(m, { common: "positive" });
    // every entity explains COMMON+ equally, so nothing separates them
    expect(new Set(flat.map((r) => r.bits.toFixed(6))).size).toBe(1);
    const decided = scoreDiagnoses(m, { common: "positive", rare: "positive" });
    expect(decided[0].diagnosis.id).toBe("d0");
    expect(decided[0].bits).toBeGreaterThan(decided[1].bits + 1);
  });

  it("scores a marker WHO does not record as exactly zero, never against", () => {
    const m = baseRateMatrix();
    m.cells = m.cells.filter((c) => !(c.d === "d5" && c.m === "rare"));
    const row = explainScore(m, "d5", { rare: "positive" })[0];
    expect(row.bits).toBe(0);
    expect(row.agreement).toBe("neutral");
    expect(row.cell).toBeUndefined();
  });

  it("ranks a variable observation onto the entity WHO hedges about", () => {
    const m: Matrix = {
      version: 1,
      generatedAt: "",
      markers: [{ id: "cd43", name: "CD43" }],
      diagnoses: [
        { id: "clean", name: "Clean", organ: "x" },
        { id: "patchy", name: "Patchy", organ: "x" },
        { id: "neg", name: "Neg", organ: "x" },
      ],
      references: {},
      cells: [
        cell("clean", "cd43", "positive", { certainty: "definite" }),
        cell("patchy", "cd43", "positive", { certainty: "variable" }),
        cell("neg", "cd43", "negative", { certainty: "definite" }),
      ],
    };
    expect(scoreDiagnoses(m, { cd43: "variable" })[0].diagnosis.id).toBe("patchy");
    expect(scoreDiagnoses(m, { cd43: "positive" })[0].diagnosis.id).toBe("clean");
    expect(scoreDiagnoses(m, { cd43: "negative" })[0].diagnosis.id).toBe("neg");
    // and a variable observation is counted as partial, not as a conflict
    const patchy = scoreDiagnoses(m, { cd43: "variable" }).find((r) => r.diagnosis.id === "clean")!;
    expect(patchy.conflicts).toBe(0);
    expect(patchy.partial).toBe(1);
  });

  it("explainScore sums to the score it explains", () => {
    const m = baseRateMatrix();
    const obs = { common: "positive", rare: "positive" } as const;
    const top = scoreDiagnoses(m, obs)[0];
    const sum = explainScore(m, top.diagnosis.id, obs).reduce((s, r) => s + r.bits, 0);
    // `bits` carries the coverage discount; `rawBits` is what the breakdown adds up to.
    expect(sum).toBeCloseTo(top.rawBits, 6);
    expect(top.coverage).toBe(1);
    expect(top.bits).toBe(top.rawBits); // nothing missing → no discount
  });

  // Found on a real eight-marker leukaemia panel: entities WHO records for ONE
  // of the eight ("Adenomatoid tumour", "Spindle epithelial tumour with
  // thymus-like elements") were outranking the entity that explained six,
  // because an unrecorded marker costs nothing and one lucky match is free.
  it("discounts a candidate for the stains it says nothing about", () => {
    const m: Matrix = {
      version: 1,
      generatedAt: "",
      markers: ["a", "b", "c", "d"].map((id) => ({ id, name: id.toUpperCase() })),
      diagnoses: [
        { id: "broad", name: "Broad", organ: "x" },
        { id: "sparse", name: "Sparse", organ: "x" },
        { id: "filler1", name: "F1", organ: "x" },
        { id: "filler2", name: "F2", organ: "x" },
      ],
      references: {},
      cells: [
        // `broad` is characterised for all four and matches all four
        ...["a", "b", "c", "d"].map((mk) => cell("broad", mk, "positive")),
        // `sparse` is characterised for ONE, and matches it
        cell("sparse", "a", "positive"),
        // fillers make "a" less than universal so a match on it earns bits
        cell("filler1", "a", "negative"),
        cell("filler2", "a", "negative"),
        ...["b", "c", "d"].map((mk) => cell("filler1", mk, "negative")),
      ],
    };
    const obs = { a: "positive", b: "positive", c: "positive", d: "positive" } as const;
    const r = scoreDiagnoses(m, obs);
    const broad = r.find((x) => x.diagnosis.id === "broad")!;
    const sparse = r.find((x) => x.diagnosis.id === "sparse")!;
    expect(broad.coverage).toBe(1);
    expect(sparse.coverage).toBe(0.25);
    // the sparse candidate keeps its raw bits but is shrunk toward zero
    expect(sparse.bits).toBeLessThan(sparse.rawBits);
    expect(r[0].diagnosis.id).toBe("broad");
    // and the discount never flips a sign or zeroes a real match
    expect(sparse.bits).toBeGreaterThan(0);
  });
});

describe("profileForDiagnosis ordering", () => {
  it("groups by result, then orders markers naturally inside each group", () => {
    const m: Matrix = {
      version: 1,
      generatedAt: "",
      markers: ["cd20", "cd3", "cd5", "cd10"].map((id) => ({ id, name: id.toUpperCase() })),
      diagnoses: [{ id: "a", name: "A", organ: "x" }],
      references: {},
      cells: [
        cell("a", "cd20", "positive"),
        cell("a", "cd3", "negative"),
        cell("a", "cd5", "positive"),
        cell("a", "cd10", "negative"),
      ],
    };
    expect(profileForDiagnosis(m, "a").map((r) => r.marker.name)).toEqual([
      "CD5",
      "CD20", // positives, natural order
      "CD3",
      "CD10", // negatives, natural order
    ]);
  });
});
