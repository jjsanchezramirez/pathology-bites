/**
 * Unit tests for the pure DOM helpers extracted from fake-selection-highlight.tsx.
 * happy-dom does no layout, so getClientRects()-based geometry (rangeToLocalRects)
 * is exercised in the browser, not here — these cover the range/tree/string logic.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  countWords,
  getBlockAncestor,
  buildRange,
  expandToWordRange,
  paragraphRange,
  unionRanges,
} from "@/shared/components/common/fake-selection-highlight-dom";

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("countWords", () => {
  it("counts whitespace-separated tokens, ignoring extra spaces", () => {
    expect(countWords("renal cell carcinoma")).toBe(3);
    expect(countWords("   spaced   out   ")).toBe(2);
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
    expect(countWords("one")).toBe(1);
  });
});

describe("getBlockAncestor", () => {
  it("returns the nearest block-level ancestor, skipping inline wrappers", () => {
    document.body.innerHTML = `<div id="root"><p id="p">hi <strong id="s">there</strong></p></div>`;
    const strongText = document.getElementById("s")!.firstChild!;
    expect(getBlockAncestor(strongText)?.id).toBe("p");
  });

  it("returns null when no block ancestor exists", () => {
    // A detached inline-only chain (span > text), no block tag anywhere.
    const span = document.createElement("span");
    span.textContent = "loose";
    expect(getBlockAncestor(span.firstChild!)).toBeNull();
  });
});

describe("buildRange", () => {
  it("orders a same-node selection regardless of click direction", () => {
    const p = document.createElement("p");
    p.textContent = "abcdef";
    document.body.appendChild(p);
    const t = p.firstChild!;
    const forward = buildRange({ node: t, offset: 1 }, { node: t, offset: 4 });
    const backward = buildRange({ node: t, offset: 4 }, { node: t, offset: 1 });
    expect(forward?.toString()).toBe("bcd");
    expect(backward?.toString()).toBe("bcd");
  });

  it("orders a cross-node selection via document position", () => {
    document.body.innerHTML = `<p>AAA<span>BBB</span></p>`;
    const aaa = document.querySelector("p")!.firstChild!;
    const bbb = document.querySelector("span")!.firstChild!;
    expect(buildRange({ node: aaa, offset: 0 }, { node: bbb, offset: 3 })?.toString()).toBe(
      "AAABBB"
    );
  });
});

describe("expandToWordRange", () => {
  it("expands a caret inside a word to the whole word", () => {
    const p = document.createElement("p");
    p.textContent = "foo bar baz";
    document.body.appendChild(p);
    const t = p.firstChild!;
    expect(expandToWordRange({ node: t, offset: 1 })?.toString()).toBe("foo");
    expect(expandToWordRange({ node: t, offset: 5 })?.toString()).toBe("bar");
  });

  it("treats hyphens as part of a word (wordCh includes '-')", () => {
    const p = document.createElement("p");
    p.textContent = "her2-positive";
    document.body.appendChild(p);
    const t = p.firstChild!;
    expect(expandToWordRange({ node: t, offset: 2 })?.toString()).toBe("her2-positive");
  });
});

describe("paragraphRange", () => {
  it("selects the whole block's contents", () => {
    document.body.innerHTML = `<p id="p">hello <em>world</em></p>`;
    const emText = document.querySelector("em")!.firstChild!;
    expect(paragraphRange({ node: emText, offset: 1 })?.toString()).toBe("hello world");
  });
});

describe("unionRanges", () => {
  it("spans from the earliest start to the latest end", () => {
    const p = document.createElement("p");
    p.textContent = "abcdefgh";
    document.body.appendChild(p);
    const t = p.firstChild!;
    const r1 = document.createRange();
    r1.setStart(t, 1);
    r1.setEnd(t, 3); // "bc"
    const r2 = document.createRange();
    r2.setStart(t, 5);
    r2.setEnd(t, 7); // "fg"
    expect(unionRanges(r1, r2).toString()).toBe("bcdefg");
    // Order-independent.
    expect(unionRanges(r2, r1).toString()).toBe("bcdefg");
  });
});
