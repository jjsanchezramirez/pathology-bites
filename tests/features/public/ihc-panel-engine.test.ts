import { describe, it, expect } from "vitest";
import {
  rankMarkersForPanel,
  pctTone,
  effVal,
  scoreDiagnoses,
  suggestNextMarker,
  minimalPanel,
  characteristicStains,
  relatedDiagnoses,
} from "@/features/public/tools/ihc/panel-engine";
import type { Matrix, Cell } from "@/features/public/tools/ihc/types";

function cell(d: string, m: string, polarity: "positive" | "negative", pct: number | null): Cell {
  return { d, m, polarity, pct, refs: [] };
}

function matrixOf(markerIds: string[], cells: Cell[]): Matrix {
  return {
    version: 1,
    generatedAt: "",
    markers: markerIds.map((id) => ({ id, name: id.toUpperCase() })),
    diagnoses: [
      { id: "a", name: "A", organ: "x" },
      { id: "b", name: "B", organ: "x" },
    ],
    references: {},
    cells,
  };
}

describe("effVal / pctTone", () => {
  it("uses % when present, polarity proxy otherwise", () => {
    expect(effVal(cell("a", "m", "positive", 90))).toBe(90);
    expect(effVal(cell("a", "m", "positive", null))).toBe(85);
    expect(effVal(cell("a", "m", "negative", null))).toBe(2);
  });
  it("tones by threshold", () => {
    expect(pctTone(cell("a", "m", "positive", 80))).toBe("pos");
    expect(pctTone(cell("a", "m", "positive", 30))).toBe("partial");
    expect(pctTone(cell("a", "m", "positive", 5))).toBe("neg");
    expect(pctTone(cell("a", "m", "positive", null))).toBe("pos");
  });
});

describe("rankMarkersForPanel", () => {
  it("ranks a fully-tested pos-vs-neg marker as the top discriminator", () => {
    const m = matrixOf(
      ["disc", "shared"],
      [
        cell("a", "disc", "positive", null), // 85
        cell("b", "disc", "negative", null), // 2  → spread 83
        cell("a", "shared", "positive", null),
        cell("b", "shared", "positive", null), // spread 0
      ]
    );
    const ranked = rankMarkersForPanel(m, ["a", "b"]);
    expect(ranked[0].marker.id).toBe("disc");
    expect(ranked[0].discriminates).toBe(true);
    expect(ranked[0].spread).toBe(83);
    // shared marker is fully tested but non-discriminating → not flagged, low spread
    const shared = ranked.find((r) => r.marker.id === "shared")!;
    expect(shared.discriminates).toBe(false);
    expect(shared.spread).toBe(0);
  });

  it("gives a one-sided marker (known in A, unstated in B) nonzero power, below full discriminators", () => {
    const m = matrixOf(
      ["disc", "oneSided", "shared"],
      [
        cell("a", "disc", "positive", null),
        cell("b", "disc", "negative", null), // full discriminator, spread 83
        cell("a", "oneSided", "negative", null), // known Neg in A only (effVal 2)
        cell("a", "shared", "positive", null),
        cell("b", "shared", "positive", null), // spread 0
      ]
    );
    const ranked = rankMarkersForPanel(m, ["a", "b"]);
    const one = ranked.find((r) => r.marker.id === "oneSided")!;
    // extremity |2-50| = 48, discounted ×(1/2) = 24  → informative but partial
    expect(one.spread).toBe(24);
    expect(one.discriminates).toBe(false);
    expect(one.testedCount).toBe(1);
    // ranks above the useless shared (power 0) marker, below the full discriminator
    const order = ranked.map((r) => r.marker.id);
    expect(order.indexOf("disc")).toBeLessThan(order.indexOf("oneSided"));
    expect(order.indexOf("oneSided")).toBeLessThan(order.indexOf("shared"));
  });

  it("skips markers untested across the whole differential", () => {
    const m = matrixOf(["ghost", "real"], [cell("a", "real", "positive", null)]);
    // 'ghost' has no cells → excluded entirely
    const ranked = rankMarkersForPanel(m, ["a", "b"]);
    expect(ranked.map((r) => r.marker.id)).toEqual(["real"]);
  });
});

// Larger fixture: 3 diagnoses, markers that separate them.
function clinicalMatrix(): Matrix {
  return {
    version: 1,
    generatedAt: "",
    markers: ["ck7", "ck20", "ttf1", "cdx2"].map((id) => ({ id, name: id.toUpperCase() })),
    diagnoses: [
      { id: "lung", name: "Lung adeno", organ: "thorax" },
      { id: "colon", name: "Colon adeno", organ: "gi" },
      { id: "ovary", name: "Ovarian", organ: "gyn" },
    ],
    references: {},
    cells: [
      cell("lung", "ck7", "positive", 90),
      cell("lung", "ck20", "negative", 5),
      cell("lung", "ttf1", "positive", 80),
      cell("colon", "ck7", "negative", 10),
      cell("colon", "ck20", "positive", 85),
      cell("colon", "cdx2", "positive", 95),
      cell("ovary", "ck7", "positive", 88),
      cell("ovary", "ck20", "negative", 8),
    ],
  };
}

describe("scoreDiagnoses", () => {
  it("ranks the matching diagnosis top and counts conflicts", () => {
    const m = clinicalMatrix();
    // CK7+ / CK20- / TTF1+ → lung
    const ranked = scoreDiagnoses(m, { ck7: "positive", ck20: "negative", ttf1: "positive" });
    expect(ranked[0].diagnosis.id).toBe("lung");
    expect(ranked[0].support).toBe(1);
    expect(ranked[0].conflicts).toBe(0);
    // colon conflicts on CK7 and CK20
    const colon = ranked.find((r) => r.diagnosis.id === "colon")!;
    expect(colon.conflicts).toBeGreaterThanOrEqual(2);
    expect(colon.support).toBeLessThan(ranked[0].support);
  });

  it("returns nothing without observations and ignores diagnoses with no data", () => {
    const m = clinicalMatrix();
    expect(scoreDiagnoses(m, {})).toEqual([]);
    // cdx2 only exists for colon → only colon scored
    const r = scoreDiagnoses(m, { cdx2: "positive" });
    expect(r.map((x) => x.diagnosis.id)).toEqual(["colon"]);
  });

  it("treats unknown markers as uninformative, not as evidence against", () => {
    const m = clinicalMatrix();
    // ovary has no TTF1 cell; observing TTF1+ shouldn't penalise it below its CK profile match
    const r = scoreDiagnoses(m, { ck7: "positive", ck20: "negative", ttf1: "positive" });
    const ovary = r.find((x) => x.diagnosis.id === "ovary")!;
    expect(ovary.conflicts).toBe(0); // CK7+/CK20- both match; TTF1 unknown
  });
});

const weighted = (...ids: string[]) => ids.map((id) => ({ id, weight: 1 }));

describe("suggestNextMarker", () => {
  it("suggests the marker that best splits the candidates", () => {
    const m = clinicalMatrix();
    // lung vs colon still ambiguous → CK20 (pos colon / neg lung) or CK7 splits them
    const s = suggestNextMarker(m, weighted("lung", "colon"), []);
    expect(s.length).toBeGreaterThan(0);
    expect(["ck7", "ck20"]).toContain(s[0].marker.id);
    expect(s[0].infoGain).toBeGreaterThan(0);
  });

  it("returns nothing for a single candidate", () => {
    expect(suggestNextMarker(clinicalMatrix(), weighted("lung"), [])).toEqual([]);
  });

  it("ignores a split between candidates that carry no weight", () => {
    const m = clinicalMatrix();
    // colon is the only entity with CDX2; with colon weightless, CDX2 cannot
    // be the top suggestion for separating what is actually still in play.
    const s = suggestNextMarker(
      m,
      [
        { id: "lung", weight: 1 },
        { id: "ovary", weight: 1 },
        { id: "colon", weight: 0 },
      ],
      []
    );
    expect(s.map((x) => x.marker.id)).not.toContain("cdx2");
  });
});

describe("minimalPanel", () => {
  it("picks the most-covering marker first and drops redundant ones", () => {
    const m = clinicalMatrix();
    // CK7 and CK20 each separate 2 of the 3 pairs (lung-colon, colon-ovary);
    // lung vs ovary is indistinguishable here (both CK7+/CK20-, TTF1 only in lung).
    const panel = minimalPanel(m, ["lung", "colon", "ovary"]);
    expect(panel[0].marker.id).toBe("ck7"); // first in marker order among the top coverers
    expect(panel[0].distinguishes).toBe(2);
    // CK20 is redundant once CK7 is chosen → not added
    expect(panel.map((p) => p.marker.id)).toEqual(["ck7"]);
  });

  it("adds a second marker when it resolves a pair the first didn't", () => {
    const m = clinicalMatrix();
    // give ovary a distinct TTF1 so lung/ovary becomes separable
    m.cells.push({ d: "ovary", m: "ttf1", polarity: "negative", pct: 5, refs: [] });
    const ids = minimalPanel(m, ["lung", "colon", "ovary"]).map((p) => p.marker.id);
    expect(ids[0]).toBe("ck7");
    expect(ids).toContain("ttf1"); // resolves lung vs ovary
  });
});

describe("characteristicStains", () => {
  it("returns a diagnosis's most extreme markers, and feeding them back ranks it top", () => {
    const m = clinicalMatrix();
    const stains = characteristicStains(m, "lung", 3);
    expect(stains.length).toBe(3);
    // the strongest (CK7 90%, CK20 5%, TTF1 80%) should be included, with correct polarity
    const byId = Object.fromEntries(stains.map((s) => [s.markerId, s.polarity]));
    expect(byId["ck7"]).toBe("positive");
    expect(byId["ck20"]).toBe("negative");
    // and using them as observations ranks lung first
    const obs = Object.fromEntries(stains.map((s) => [s.markerId, s.polarity]));
    expect(scoreDiagnoses(m, obs)[0].diagnosis.id).toBe("lung");
  });
});

describe("relatedDiagnoses", () => {
  it("returns diagnoses sharing markers with the seed", () => {
    const m = clinicalMatrix();
    const related = relatedDiagnoses(m, "lung", 2);
    expect(related).not.toContain("lung");
    // colon and ovary both share CK7/CK20 markers with lung
    expect(related.length).toBeGreaterThanOrEqual(1);
    expect(related.every((id) => ["colon", "ovary"].includes(id))).toBe(true);
  });
});
