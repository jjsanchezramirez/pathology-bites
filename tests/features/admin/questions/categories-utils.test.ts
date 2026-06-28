/**
 * Unit tests for the pure helpers extracted from categories-management.tsx.
 * These pin the hierarchy ordering and pagination-chip logic directly (the
 * component characterization test covers them transitively via the DOM).
 */
import { describe, it, expect } from "vitest";
import {
  getPageNumbers,
  organizeHierarchically,
  type Category,
} from "@/features/admin/questions/components/metadata/categories/categories-utils";

function cat(partial: Partial<Category> & { id: string; name: string }): Category {
  return { level: 1, created_at: "2024-01-01", ...partial };
}

describe("organizeHierarchically", () => {
  it("orders roots alphabetically with children nested + alphabetical (depth-first)", () => {
    const input: Category[] = [
      cat({ id: "b", name: "Beta" }),
      cat({ id: "a", name: "Alpha" }),
      cat({ id: "a2", name: "Alpha-Zebra", parent_id: "a", level: 2 }),
      cat({ id: "a1", name: "Alpha-Apple", parent_id: "a", level: 2 }),
      cat({ id: "b1", name: "Beta-Child", parent_id: "b", level: 2 }),
    ];
    expect(organizeHierarchically(input).map((c) => c.name)).toEqual([
      "Alpha",
      "Alpha-Apple",
      "Alpha-Zebra",
      "Beta",
      "Beta-Child",
    ]);
  });

  it("handles multiple levels of nesting", () => {
    const input: Category[] = [
      cat({ id: "root", name: "Root" }),
      cat({ id: "child", name: "Child", parent_id: "root", level: 2 }),
      cat({ id: "grand", name: "Grandchild", parent_id: "child", level: 3 }),
    ];
    expect(organizeHierarchically(input).map((c) => c.id)).toEqual(["root", "child", "grand"]);
  });

  it("returns an empty array for no categories", () => {
    expect(organizeHierarchically([])).toEqual([]);
  });

  it("treats a child whose parent is absent as not surfaced under a root", () => {
    // orphan (parent_id points nowhere) is never reached by buildHierarchy from roots
    const input: Category[] = [
      cat({ id: "r", name: "Root" }),
      cat({ id: "orphan", name: "Orphan", parent_id: "missing", level: 2 }),
    ];
    expect(organizeHierarchically(input).map((c) => c.id)).toEqual(["r"]);
  });
});

describe("getPageNumbers", () => {
  it("lists every page when there are 7 or fewer", () => {
    expect(getPageNumbers(0, 1)).toEqual([0]);
    expect(getPageNumbers(2, 7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("shows a trailing ellipsis near the start", () => {
    expect(getPageNumbers(0, 10)).toEqual([0, 1, "ellipsis", 9]);
  });

  it("shows a leading ellipsis near the end", () => {
    expect(getPageNumbers(9, 10)).toEqual([0, "ellipsis", 8, 9]);
  });

  it("shows both ellipses in the middle", () => {
    expect(getPageNumbers(5, 12)).toEqual([0, "ellipsis", 4, 5, 6, "ellipsis", 11]);
  });
});
