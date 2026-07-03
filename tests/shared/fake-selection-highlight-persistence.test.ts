/**
 * Unit tests for the highlight persistence helpers extracted from
 * fake-selection-highlight.tsx. resolveSerializedHighlight depends on
 * getClientRects() (no layout in happy-dom), so its full round-trip is verified in
 * the browser; here we cover the text-index, match, and serialize logic.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  buildTextIndex,
  findAllMatches,
  matchToRange,
  serializeHighlight,
  rectsEqual,
} from "@/shared/components/common/fake-selection-highlight-persistence";

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("findAllMatches", () => {
  it("returns every (overlapping) start index", () => {
    expect(findAllMatches("abcabcabc", "abc")).toEqual([0, 3, 6]);
    expect(findAllMatches("aaa", "aa")).toEqual([0, 1]);
    expect(findAllMatches("xyz", "q")).toEqual([]);
    expect(findAllMatches("anything", "")).toEqual([]);
  });
});

describe("buildTextIndex", () => {
  it("normalizes runs of whitespace to single spaces", () => {
    const root = document.createElement("div");
    root.innerHTML = `<p>Hello   world</p>`;
    expect(buildTextIndex(root).text).toBe("Hello world");
  });

  it("skips [data-no-highlight] chrome while preserving the surrounding space", () => {
    const root = document.createElement("div");
    root.innerHTML = `<p>Hello <span data-no-highlight>SKIP</span> world</p>`;
    expect(buildTextIndex(root).text).toBe("Hello world");
  });

  it("maps each indexed character back to a (node, offset)", () => {
    const root = document.createElement("div");
    root.innerHTML = `<p>abc</p>`;
    const idx = buildTextIndex(root);
    expect(idx.text).toBe("abc");
    expect(idx.positions).toHaveLength(3);
    expect(idx.positions[0].offset).toBe(0);
  });
});

describe("matchToRange", () => {
  it("builds a Range covering the matched substring", () => {
    const root = document.createElement("div");
    root.innerHTML = `<p>abcdef</p>`;
    document.body.appendChild(root);
    const idx = buildTextIndex(root);
    const start = findAllMatches(idx.text, "cd")[0];
    expect(matchToRange(idx, start, 2)?.toString()).toBe("cd");
  });
});

describe("serializeHighlight", () => {
  it("returns occurrence 0 for unique text", () => {
    const root = document.createElement("div");
    root.innerHTML = `<p>a unique phrase here</p>`;
    document.body.appendChild(root);
    const idx = buildTextIndex(root);
    const start = findAllMatches(idx.text, "unique")[0];
    const range = matchToRange(idx, start, "unique".length)!;
    expect(serializeHighlight(root, range, "unique")).toEqual({
      cleanText: "unique",
      occurrence: 0,
    });
  });

  it("picks the occurrence nearest the range start when text repeats", () => {
    const root = document.createElement("div");
    root.innerHTML = `<p>cat dog cat dog cat</p>`;
    document.body.appendChild(root);
    const idx = buildTextIndex(root);
    const starts = findAllMatches(idx.text, "cat"); // [0, 8, 16]
    const secondRange = matchToRange(idx, starts[1], 3)!;
    expect(serializeHighlight(root, secondRange, "cat").occurrence).toBe(1);
  });
});

describe("rectsEqual", () => {
  const r = { top: 1, left: 2, width: 3, height: 4 };
  it("is true for identical rect lists", () => {
    expect(rectsEqual([r], [{ ...r }])).toBe(true);
    expect(rectsEqual([], [])).toBe(true);
  });
  it("is false on differing length or any differing field", () => {
    expect(rectsEqual([r], [])).toBe(false);
    expect(rectsEqual([r], [{ ...r, width: 99 }])).toBe(false);
  });
});
