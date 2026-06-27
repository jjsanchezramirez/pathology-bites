/**
 * Unit tests for the pure helpers extracted from tags-management-grid.tsx.
 */
import { describe, it, expect } from "vitest";
import {
  sortTags,
  sortByLabel,
  getTagsPageNumbers,
  type Tag,
} from "@/features/admin/questions/components/metadata/tags/tags-utils";

function tag(p: Partial<Tag> & { id: string; name: string }): Tag {
  return { created_at: "2024-01-01T00:00:00Z", question_count: 0, ...p };
}

const sample: Tag[] = [
  tag({ id: "b", name: "Beta", question_count: 5, created_at: "2024-02-01T00:00:00Z" }),
  tag({ id: "a", name: "Alpha", question_count: 0, created_at: "2024-03-01T00:00:00Z" }),
  tag({ id: "c", name: "Gamma", question_count: 12, created_at: "2024-01-01T00:00:00Z" }),
];

describe("sortTags", () => {
  it("sorts alphabetically by name (default)", () => {
    expect(sortTags(sample, "name").map((t) => t.name)).toEqual(["Alpha", "Beta", "Gamma"]);
  });

  it("sorts by usage descending", () => {
    expect(sortTags(sample, "usage").map((t) => t.name)).toEqual(["Gamma", "Beta", "Alpha"]);
  });

  it("sorts by date newest first", () => {
    expect(sortTags(sample, "date").map((t) => t.id)).toEqual(["a", "b", "c"]);
  });

  it("sorts by date oldest first", () => {
    expect(sortTags(sample, "oldest").map((t) => t.id)).toEqual(["c", "b", "a"]);
  });

  it("'unused' filters to count===0 then sorts alphabetically", () => {
    const result = sortTags(
      [
        tag({ id: "a", name: "Alpha", question_count: 0 }),
        tag({ id: "b", name: "Beta", question_count: 3 }),
        tag({ id: "z", name: "Zeta", question_count: 0 }),
      ],
      "unused"
    );
    expect(result.map((t) => t.name)).toEqual(["Alpha", "Zeta"]);
  });

  it("does not mutate the input array", () => {
    const input = [...sample];
    sortTags(input, "usage");
    expect(input.map((t) => t.id)).toEqual(["b", "a", "c"]);
  });
});

describe("sortByLabel", () => {
  it("maps each sort key to its label", () => {
    expect(sortByLabel("name")).toBe("Alphabetical");
    expect(sortByLabel("usage")).toBe("Most Used");
    expect(sortByLabel("date")).toBe("Newest");
    expect(sortByLabel("oldest")).toBe("Oldest");
    expect(sortByLabel("unused")).toBe("Unused Only");
  });
});

describe("getTagsPageNumbers", () => {
  it("lists every page when total ≤ 5", () => {
    expect(getTagsPageNumbers(0, 5)).toEqual([0, 1, 2, 3, 4]);
  });

  it("shows a trailing ellipsis near the start", () => {
    expect(getTagsPageNumbers(0, 10)).toEqual([0, 1, 2, 3, "...", 9]);
  });

  it("shows a leading ellipsis near the end", () => {
    expect(getTagsPageNumbers(9, 10)).toEqual([0, "...", 6, 7, 8, 9]);
  });

  it("shows both ellipses in the middle", () => {
    expect(getTagsPageNumbers(5, 12)).toEqual([0, "...", 4, 5, 6, "...", 11]);
  });
});
