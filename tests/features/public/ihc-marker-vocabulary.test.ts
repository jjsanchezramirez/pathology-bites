import { describe, it, expect } from "vitest";
import {
  isOrderableStain,
  orderableStains,
  mergePatternMarkers,
} from "@/features/public/tools/ihc/marker-vocabulary";
import { poolCells } from "@/features/public/tools/ihc/aggregate";
import type { Cell, Marker, Matrix } from "@/features/public/tools/ihc/types";

const marker = (id: string, name: string): Marker => ({ id, name });
const cell = (d: string, m: string, extra: Partial<Cell> = {}): Cell => ({
  d,
  m,
  polarity: "positive",
  pct: null,
  refs: [],
  ...extra,
});

describe("isOrderableStain", () => {
  // The distinction is a PLURAL category head. Every name below on the right is
  // a real marker whose name ends in the same word in the singular.
  it("rejects WHO's category phrases", () => {
    for (const n of [
      "Melanoma markers",
      "neuroendocrine markers",
      "melanocytic markers",
      "pan-B-cell antigens",
      "hormone stains",
      "cytotoxic proteins",
      "yolk sac tumour markers",
    ]) {
      expect(isOrderableStain(marker("x", n)), n).toBe(false);
    }
  });

  it("keeps real markers whose names end in the same words, singular", () => {
    for (const n of [
      "S100 protein",
      "MYC protein",
      "ALK protein",
      "C-reactive protein",
      "surfactant protein",
      "Iron stain",
      "RCC antigen",
      "CD34",
      "Myeloperoxidase",
    ]) {
      expect(isOrderableStain(marker("x", n)), n).toBe(true);
    }
  });

  it("filters a list without mutating it", () => {
    const all = [marker("a", "CD34"), marker("b", "Melanoma markers")];
    expect(orderableStains(all).map((m) => m.id)).toEqual(["a"]);
    expect(all).toHaveLength(2);
  });
});

describe("mergePatternMarkers", () => {
  const base = (): Matrix => ({
    version: 1,
    generatedAt: "",
    markers: [
      marker("npm1", "NPM1"),
      marker("cytoplasmic-npm1", "cytoplasmic NPM1"),
      marker("abnormal-cytoplasmic-npm1", "abnormal cytoplasmic NPM1"),
      marker("nuclear-factor-x", "nuclear factor X"), // no bare "factor X" marker
    ],
    diagnoses: [{ id: "d1", name: "D1", organ: "x" }],
    references: {},
    cells: [
      cell("d1", "cytoplasmic-npm1", { quote: "aberrant cytoplasmic NPM1" }),
      cell("d1", "abnormal-cytoplasmic-npm1"),
      cell("d1", "nuclear-factor-x"),
    ],
  });

  it("folds a pattern-qualified name into its base marker", () => {
    const m = mergePatternMarkers(base(), poolCells);
    expect(m.markers.filter((x) => /npm1/i.test(x.name))).toHaveLength(1);
    const npm1 = m.markers.find((x) => x.id === "npm1")!;
    // the folded spellings stay searchable
    expect(npm1.aliases).toContain("cytoplasmic NPM1");
    expect(npm1.aliases).toContain("abnormal cytoplasmic NPM1");
  });

  it("moves the qualifier into the cell's pattern, where the schema puts it", () => {
    const m = mergePatternMarkers(base(), poolCells);
    const cells = m.cells.filter((c) => c.m === "npm1");
    expect(cells).toHaveLength(1); // both folded onto one (diagnosis, marker) pair
    expect(cells[0].pattern).toBe("cytoplasmic");
    expect(cells[0].polarity).toBe("positive");
  });

  it("leaves a marker alone when the stripped name is not itself a marker", () => {
    const m = mergePatternMarkers(base(), poolCells);
    // "nuclear factor X" survives — there is no "factor X" to fold it into, and
    // inventing one would split a real marker on a word that looks like a pattern.
    expect(m.markers.some((x) => x.id === "nuclear-factor-x")).toBe(true);
    expect(m.cells.some((c) => c.m === "nuclear-factor-x")).toBe(true);
  });

  it("is a no-op when nothing folds", () => {
    const m: Matrix = { ...base(), markers: [marker("cd34", "CD34")], cells: [cell("d1", "cd34")] };
    expect(mergePatternMarkers(m, poolCells)).toBe(m);
  });
});
