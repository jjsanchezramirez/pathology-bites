/**
 * Unit tests for the pure helper extracted from the virtual slides page.
 */
import { describe, it, expect } from "vitest";
import { chunkLogosIntoRows } from "@/app/(public)/tools/virtual-slides/virtual-slides-utils";

const nums = (n: number) => Array.from({ length: n }, (_, i) => i);

describe("chunkLogosIntoRows", () => {
  it("uses 1 row for ≤6 logos", () => {
    expect(chunkLogosIntoRows(nums(6))).toHaveLength(1);
    expect(chunkLogosIntoRows(nums(6))[0]).toHaveLength(6);
  });

  it("uses 2 balanced rows for 7–12 logos", () => {
    const rows = chunkLogosIntoRows(nums(10));
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.length)).toEqual([5, 5]);
  });

  it("uses 3 balanced rows for >12 logos", () => {
    const rows = chunkLogosIntoRows(nums(13));
    expect(rows).toHaveLength(3);
    // 13 over 3 rows → ceil(13/3)=5 per row → [5,5,3]
    expect(rows.map((r) => r.length)).toEqual([5, 5, 3]);
    expect(rows.flat()).toEqual(nums(13));
  });

  it("returns one empty row for no logos", () => {
    expect(chunkLogosIntoRows([])).toEqual([[]]);
  });
});
