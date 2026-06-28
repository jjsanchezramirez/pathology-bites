/**
 * Unit tests for the pure cell-counter logic + export builders.
 */
import { describe, it, expect } from "vitest";
import {
  calculateMEratio,
  assignCellKey,
  applyCount,
  applyUndo,
  resolveKeyAction,
} from "@/app/(public)/tools/cell-counter/cell-counter-utils";
import {
  buildPlainTextTabbed,
  buildPlainTextExport,
  buildRtfDocument,
} from "@/app/(public)/tools/cell-counter/cell-export";
import type { CellType, CounterState } from "@/app/(public)/tools/cell-counter/cell-counter-data";

function cell(p: Partial<CellType> & { name: string; key: string }): CellType {
  return { id: p.key, count: 0, color: "bg-x", ...p };
}

function state(cellTypes: CellType[], extra: Partial<CounterState> = {}): CounterState {
  return {
    cellTypes,
    settings: { countLimit: 100, enableLimit: true, enableUndo: true, maxUndoHistory: 50 },
    undoHistory: [],
    isComplete: false,
    totalCount: 0,
    presetType: "bone-marrow",
    savedPresets: [],
    ...extra,
  };
}

describe("calculateMEratio", () => {
  it("returns null unless bone-marrow preset", () => {
    expect(calculateMEratio("peripheral-blood", [])).toBeNull();
  });

  it("returns null when there are no erythroid cells", () => {
    expect(
      calculateMEratio("bone-marrow", [cell({ name: "Blast", key: "t", count: 5 })])
    ).toBeNull();
  });

  it("computes myeloid:erythroid ratio", () => {
    const r = calculateMEratio("bone-marrow", [
      cell({ name: "Blast", key: "t", count: 6 }),
      cell({ name: "Eosinophil", key: "n", count: 2 }),
      cell({ name: "Nucleated erythroid", key: "p", count: 4 }),
    ]);
    expect(r).toEqual({ myeloidCount: 8, erythroidCount: 4, ratio: "2.00" });
  });
});

describe("assignCellKey", () => {
  it("uses the requested key (lowercased) when given", () => {
    expect(assignCellKey("Blast", "T", [])).toBe("t");
  });

  it("auto-assigns the name's first letter when free", () => {
    expect(assignCellKey("Blast", "", ["k"])).toBe("b");
  });

  it("falls back to the first free key when the first letter is taken", () => {
    expect(assignCellKey("Blast", "", ["b"])).toBe("a");
  });
});

describe("applyCount", () => {
  it("increments and records undo history", () => {
    const s = applyCount(state([cell({ name: "Blast", key: "t" })]), "t", 1);
    expect(s.cellTypes[0].count).toBe(1);
    expect(s.undoHistory).toHaveLength(1);
  });

  it("does not decrement below zero", () => {
    const s = state([cell({ name: "Blast", key: "t", count: 0 })]);
    expect(applyCount(s, "t", -1)).toBe(s); // unchanged
  });

  it("is a no-op for an unknown key", () => {
    const s = state([cell({ name: "Blast", key: "t" })]);
    expect(applyCount(s, "zzz", 1)).toBe(s);
  });
});

describe("applyUndo", () => {
  it("restores the previous cell snapshot", () => {
    const snapshot = [cell({ name: "Blast", key: "t", count: 0 })];
    const s = state([cell({ name: "Blast", key: "t", count: 1 })], { undoHistory: [snapshot] });
    const r = applyUndo(s);
    expect(r.cellTypes[0].count).toBe(0);
    expect(r.undoHistory).toHaveLength(0);
  });
});

describe("resolveKeyAction", () => {
  const cells = [cell({ name: "Blast", key: "t" })];
  const ev = (over: Partial<KeyboardEvent>) =>
    ({ key: "", shiftKey: false, ctrlKey: false, metaKey: false, ...over }) as KeyboardEvent;

  it("increments a matching key", () => {
    expect(resolveKeyAction(ev({ key: "t" }), cells)).toEqual({ type: "increment", key: "t" });
  });

  it("decrements on Shift + matching key", () => {
    expect(resolveKeyAction(ev({ key: "t", shiftKey: true }), cells)).toEqual({
      type: "decrement",
      key: "t",
    });
  });

  it("maps undo (Ctrl+Z, Backspace) and reset (Ctrl+R) and stop (Escape)", () => {
    expect(resolveKeyAction(ev({ key: "z", ctrlKey: true }), cells)).toEqual({ type: "undo" });
    expect(resolveKeyAction(ev({ key: "Backspace" }), cells)).toEqual({ type: "undo" });
    expect(resolveKeyAction(ev({ key: "r", metaKey: true }), cells)).toEqual({ type: "reset" });
    expect(resolveKeyAction(ev({ key: "Escape" }), cells)).toEqual({ type: "stop" });
  });

  it("returns null for unhandled keys", () => {
    expect(resolveKeyAction(ev({ key: "q" }), cells)).toBeNull();
    expect(resolveKeyAction(ev({ key: "z" }), cells)).toBeNull(); // no modifier
  });
});

describe("export builders", () => {
  const cells = [
    { name: "Blast", count: 4 },
    { name: "Lymphocyte", count: 1 },
  ];

  it("buildPlainTextTabbed has header, rows, total, and optional M:E", () => {
    const out = buildPlainTextTabbed(cells, 5, {
      myeloidCount: 4,
      erythroidCount: 1,
      ratio: "4.00",
    });
    expect(out.split("\n")[0]).toBe("Cell Type\tCount\tPercentage");
    expect(out).toContain("Blast\t4\t80.00%");
    expect(out).toContain("Total Count\t5\t100%");
    expect(out).toContain("M:E Ratio\t4.00:1\t(4:1)");
  });

  it("buildPlainTextExport pads columns and appends the total footer", () => {
    const out = buildPlainTextExport(cells, 5, null);
    expect(out).toContain("Blast");
    expect(out).toContain("80.0%");
    expect(out).toContain("Total Count:");
  });

  it("buildRtfDocument produces a well-formed RTF table (escapes intact)", () => {
    const out = buildRtfDocument(cells, 5, null);
    expect(out.startsWith("{\\rtf1\\ansi\\ansicpg1252")).toBe(true);
    expect(out.endsWith("}")).toBe(true);
    expect(out).toContain("\\trowd"); // table row defs present
    expect(out).toContain("\\cell");
    expect(out).toContain("Blast");
  });
});
