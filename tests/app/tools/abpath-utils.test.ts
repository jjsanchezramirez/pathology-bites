/**
 * Unit tests for the pure logic extracted from the ABPath page.
 */
import { describe, it, expect } from "vitest";
import {
  itemMatchesSearch,
  filterItems,
  applyDesignationFilter,
  buildCategories,
  computeStats,
  getABPathPageNumbers,
} from "@/app/(public)/tools/abpath/abpath-utils";
import type { ABPathItem, ABPathSection } from "@/shared/types/abpath";

const ALL = { showC: true, showAR: true, showF: true };

function item(p: Partial<ABPathItem> & { title: string }): ABPathItem {
  return p as ABPathItem;
}

describe("itemMatchesSearch", () => {
  it("matches on title or note, case-insensitive", () => {
    expect(itemMatchesSearch(item({ title: "Osteosarcoma" }), "sarc")).toBe(true);
    expect(itemMatchesSearch(item({ title: "X", note: "Bone tumor" }), "bone")).toBe(true);
    expect(itemMatchesSearch(item({ title: "X" }), "zzz")).toBe(false);
  });

  it("matches when a nested subitem matches", () => {
    const it = item({ title: "Parent", subitems: [item({ title: "Chondroblastoma" })] });
    expect(itemMatchesSearch(it, "chondro")).toBe(true);
  });

  it("empty search always matches", () => {
    expect(itemMatchesSearch(item({ title: "X" }), "")).toBe(true);
  });
});

describe("filterItems", () => {
  const items = [
    item({ title: "Core thing", designation: "C" }),
    item({ title: "AR thing", designation: "AR" }),
    item({ title: "Fellow thing", designation: "F" }),
    item({ title: "No designation" }),
  ];

  it("keeps items whose designation toggle is on (plus undesignated)", () => {
    const r = filterItems(items, "", { showC: true, showAR: false, showF: false });
    expect(r.map((i) => i.title)).toEqual(["Core thing", "No designation"]);
  });

  it("applies the search filter", () => {
    const r = filterItems(items, "fellow", ALL);
    expect(r.map((i) => i.title)).toEqual(["Fellow thing"]);
  });
});

describe("applyDesignationFilter", () => {
  const sections: ABPathSection[] = [
    {
      type: "ap",
      section: "1",
      title: "Bone",
      items: [
        item({ title: "Core", designation: "C" }),
        item({ title: "Fellow", designation: "F" }),
      ],
    } as ABPathSection,
  ];

  it("returns [] when all designations are off", () => {
    expect(applyDesignationFilter(sections, { showC: false, showAR: false, showF: false })).toEqual(
      []
    );
  });

  it("filters section items by designation", () => {
    const r = applyDesignationFilter(sections, { showC: true, showAR: false, showF: false });
    expect(r[0].items?.map((i) => i.title)).toEqual(["Core"]);
  });
});

describe("buildCategories", () => {
  it("builds value/label/title from each section", () => {
    const cats = buildCategories([{ type: "ap", section: "1", title: "Bone" } as ABPathSection]);
    expect(cats[0]).toEqual({ value: "AP_1", label: "AP 1: Bone", title: "Bone" });
  });
});

describe("computeStats", () => {
  const sections: ABPathSection[] = [
    {
      type: "ap",
      section: "1",
      title: "Bone",
      items: [
        item({ title: "a", designation: "C" }),
        item({ title: "b", designation: "C" }),
        item({ title: "c", designation: "AR" }),
        item({ title: "d", designation: "F" }),
      ],
    } as ABPathSection,
  ];

  it("counts visible vs all designated items + coverage %", () => {
    const stats = computeStats(sections, sections, ALL);
    expect(stats.totalAll).toBe(4); // 2C + 1AR + 1F
    expect(stats.totalVisible).toBe(4);
    expect(stats.cCount).toBe(2);
    expect(stats.totalPercentage).toBe(100);
  });

  it("reflects designation toggles in visible counts", () => {
    const stats = computeStats(sections, sections, { showC: true, showAR: false, showF: false });
    expect(stats.totalVisible).toBe(2); // only the 2 Core
    expect(stats.totalAll).toBe(4);
    expect(stats.totalPercentage).toBe(50);
  });
});

describe("getABPathPageNumbers", () => {
  it("lists all pages when ≤5", () => {
    expect(getABPathPageNumbers(1, 3)).toEqual([1, 2, 3]);
  });

  it("windows around the current page when >5", () => {
    expect(getABPathPageNumbers(5, 10)).toEqual([3, 4, 5, 6, 7]);
    expect(getABPathPageNumbers(1, 10)).toEqual([1, 2, 3, 4, 5]);
    expect(getABPathPageNumbers(10, 10)).toEqual([6, 7, 8, 9, 10]);
  });
});
