// Pure DOM helpers for the fake-selection-highlight tool: selection geometry
// (range → local rects), caret-from-point, word/paragraph range expansion, and
// the block-element / chrome-skipping walkers. No React. Unit-tested in isolation
// (see fake-selection-highlight-dom.test.ts).

export type LocalRect = { top: number; left: number; width: number; height: number };

export type FakeSelection = {
  range: Range;
  text: string;
  rects: LocalRect[];
  granularity: Granularity;
};

// Sub-ranges of `range` covering only text that is NOT inside a [data-no-highlight]
// element (each clamped to the range bounds). This is what lets a selection span an answer
// option's diagnosis while excluding chrome like the option letter ("C") or icons — otherwise
// selecting option C's "Colonic adenocarcinoma" would query "CColonic adenocarcinoma".
function selectableSegments(range: Range): Range[] {
  const anchor =
    range.commonAncestorContainer.nodeType === Node.TEXT_NODE
      ? range.commonAncestorContainer.parentNode
      : range.commonAncestorContainer;
  if (!anchor) return [range.cloneRange()];
  // Fast path (the common case — selecting within a single prose block like the stem or one
  // teaching-point paragraph): if the range contains no [data-no-highlight] chrome AND both
  // ends sit in the SAME block element, the raw range's `getClientRects()` yields tight line
  // rects in one call — skipping the per-text-node TreeWalker that otherwise runs every drag
  // frame over markdown's many <strong>/<em> nodes.
  // The same-block guard matters: `Range.getClientRects()` on a range spanning multiple blocks
  // also returns each fully-contained block's full-width border box, which paints the whole box
  // around the text (the reported glitch). Multi-block selections fall through to the walker,
  // which clips to one text node per segment and never produces those block boxes.
  const startBlock = getBlockAncestor(range.startContainer);
  if (
    anchor.nodeType === Node.ELEMENT_NODE &&
    startBlock !== null &&
    startBlock === getBlockAncestor(range.endContainer) &&
    !(anchor as Element).querySelector(NO_HIGHLIGHT_SELECTOR)
  ) {
    return [range.cloneRange()];
  }
  const walker = document.createTreeWalker(
    (anchor as Node) ?? range.commonAncestorContainer,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(n) {
        if (!n.textContent) return NodeFilter.FILTER_REJECT;
        if (!range.intersectsNode(n)) return NodeFilter.FILTER_REJECT;
        const el = (n as Text).parentElement;
        if (el && el.closest(NO_HIGHLIGHT_SELECTOR)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );
  const segs: Range[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const len = node.textContent ? node.textContent.length : 0;
    const start = node === range.startContainer ? range.startOffset : 0;
    const end = node === range.endContainer ? range.endOffset : len;
    if (end <= start) continue;
    const r = document.createRange();
    r.setStart(node, start);
    r.setEnd(node, end);
    segs.push(r);
  }
  // Nothing matched ⇒ the selection lies wholly inside [data-no-highlight] chrome (the feature
  // hint, option letters, strike buttons). Return no segments so it contributes no text/rects
  // and the selection clears — chrome must not be selectable or searchable.
  return segs;
}

function segmentsToLocalRects(segments: Range[], container: HTMLElement): LocalRect[] {
  const c = container.getBoundingClientRect();
  const rects: LocalRect[] = [];
  const seen = new Set<string>();
  for (const seg of segments) {
    for (const r of Array.from(seg.getClientRects())) {
      if (r.width <= 0 || r.height <= 0) continue;
      const top = r.top - c.top;
      const left = r.left - c.left;
      // Dedupe identical rects. Adjacent segments (and -webkit-box / line-clamp content like
      // the References row) can each report the same line box, which would stack overlays and
      // make the geometry look unstable frame-to-frame.
      const key = `${Math.round(top)}:${Math.round(left)}:${Math.round(r.width)}:${Math.round(r.height)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rects.push({ top, left, width: r.width, height: r.height });
    }
  }
  return rects;
}

export function rangeToLocalRects(range: Range, container: HTMLElement): LocalRect[] {
  return segmentsToLocalRects(selectableSegments(range), container);
}

// Text + rects from a SINGLE chrome-aware segment walk. The per-frame drag path needs
// both; computing them separately walked the range's text nodes twice each frame.
export function rangeCleanTextAndRects(
  range: Range,
  container: HTMLElement
): { text: string; rects: LocalRect[] } {
  const segments = selectableSegments(range);
  const text = segments.map((r) => r.toString()).join("");
  return { text, rects: segmentsToLocalRects(segments, container) };
}

export type CaretPos = { node: Node; offset: number };

export function caretPosFromPoint(x: number, y: number): CaretPos | null {
  const docAny = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  if (docAny.caretPositionFromPoint) {
    const pos = docAny.caretPositionFromPoint(x, y);
    return pos ? { node: pos.offsetNode, offset: pos.offset } : null;
  }
  if (document.caretRangeFromPoint) {
    const r = document.caretRangeFromPoint(x, y);
    return r ? { node: r.startContainer, offset: r.startOffset } : null;
  }
  return null;
}

export function buildRange(anchor: CaretPos, focus: CaretPos): Range | null {
  try {
    const r = document.createRange();
    let forward: boolean;
    if (anchor.node === focus.node) {
      forward = anchor.offset <= focus.offset;
    } else {
      const cmp = anchor.node.compareDocumentPosition(focus.node);
      forward = (cmp & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    }
    if (forward) {
      r.setStart(anchor.node, anchor.offset);
      r.setEnd(focus.node, focus.offset);
    } else {
      r.setStart(focus.node, focus.offset);
      r.setEnd(anchor.node, anchor.offset);
    }
    return r;
  } catch {
    return null;
  }
}

export function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

const BLOCK_TAGS = new Set([
  "P",
  "LI",
  "BLOCKQUOTE",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "DIV",
  "SECTION",
  "ARTICLE",
  "ASIDE",
  "HEADER",
  "FOOTER",
  "NAV",
  "MAIN",
  "TD",
  "TH",
  "TR",
  "FIGCAPTION",
  "FIGURE",
  "DD",
  "DT",
  "PRE",
  "ADDRESS",
  "DETAILS",
  "SUMMARY",
]);

export function getBlockAncestor(node: Node): Element | null {
  let cur: Node | null = node.nodeType === Node.ELEMENT_NODE ? node : node.parentNode;
  while (cur && cur.nodeType === Node.ELEMENT_NODE) {
    if (BLOCK_TAGS.has((cur as Element).tagName)) return cur as Element;
    cur = cur.parentNode;
  }
  return null;
}

export function expandToWordRange(pos: CaretPos): Range | null {
  if (pos.node.nodeType !== Node.TEXT_NODE) return null;
  const wordCh = /[\p{L}\p{N}_-]/u;
  const block = getBlockAncestor(pos.node);
  const walker = block ? document.createTreeWalker(block, NodeFilter.SHOW_TEXT) : null;

  let startNode = pos.node as Text;
  let startOffset = pos.offset;
  let scanNode: Text = pos.node as Text;
  let scanOffset = pos.offset;
  for (;;) {
    const t = scanNode.data;
    while (scanOffset > 0 && wordCh.test(t[scanOffset - 1])) scanOffset--;
    startNode = scanNode;
    startOffset = scanOffset;
    if (scanOffset > 0) break;
    if (!walker) break;
    walker.currentNode = scanNode;
    const prev = walker.previousNode() as Text | null;
    if (!prev) break;
    if (prev.data.length === 0 || !wordCh.test(prev.data[prev.data.length - 1])) break;
    scanNode = prev;
    scanOffset = prev.data.length;
  }

  let endNode = pos.node as Text;
  let endOffset = pos.offset;
  scanNode = pos.node as Text;
  scanOffset = pos.offset;
  if (walker) walker.currentNode = pos.node;
  for (;;) {
    const t = scanNode.data;
    while (scanOffset < t.length && wordCh.test(t[scanOffset])) scanOffset++;
    endNode = scanNode;
    endOffset = scanOffset;
    if (scanOffset < t.length) break;
    if (!walker) break;
    walker.currentNode = scanNode;
    const next = walker.nextNode() as Text | null;
    if (!next) break;
    if (next.data.length === 0 || !wordCh.test(next.data[0])) break;
    scanNode = next;
    scanOffset = 0;
  }

  if (startNode === endNode && startOffset === endOffset) return null;
  const r = document.createRange();
  r.setStart(startNode, startOffset);
  r.setEnd(endNode, endOffset);
  return r;
}

export function paragraphRange(pos: CaretPos): Range | null {
  const block = getBlockAncestor(pos.node);
  if (!block) return null;
  const r = document.createRange();
  r.selectNodeContents(block);
  return r;
}

// TreeWalker over the selectable text only — skips whitespace-only nodes and anything inside
// [data-no-highlight] chrome (the feature hint, option letters, strike buttons). Used by the
// drag-past-edge clamps so dragging below the card anchors on the last real content (e.g. a
// reference), never on the hint pill.
function selectableTextWalker(root: Node): TreeWalker {
  return document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (!n.textContent || !n.textContent.trim()) return NodeFilter.FILTER_REJECT;
      const el = (n as Text).parentElement;
      if (el && el.closest(NO_HIGHLIGHT_SELECTOR)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
}

export function firstTextPos(root: Node): CaretPos | null {
  const walker = selectableTextWalker(root);
  const node = walker.nextNode() as Text | null;
  return node ? { node, offset: 0 } : null;
}

export function lastTextPos(root: Node): CaretPos | null {
  const walker = selectableTextWalker(root);
  let last: Text | null = null;
  let n: Node | null;
  while ((n = walker.nextNode())) last = n as Text;
  return last ? { node: last, offset: last.data.length } : null;
}

export function unionRanges(a: Range, b: Range): Range {
  const out = a.cloneRange();
  if (a.compareBoundaryPoints(Range.START_TO_START, b) > 0) {
    out.setStart(b.startContainer, b.startOffset);
  }
  if (a.compareBoundaryPoints(Range.END_TO_END, b) < 0) {
    out.setEnd(b.endContainer, b.endOffset);
  }
  return out;
}

export type Granularity = "char" | "word" | "paragraph";

export type DragState = {
  granularity: Granularity;
  anchor: CaretPos;
  anchorRange?: Range;
  downX: number;
  downY: number;
  moved: boolean;
  pointerType: string;
};

// Selector that, when matched by a pointerdown / contextmenu target, makes the
// wrapper bail out entirely so the inner element receives the event normally.
// Used by callers that nest interactive widgets (answer buttons, etc.) inside
// the selection surface — without this, the wrapper hijacks right-click for its
// context menu, breaking strike-out toggles and other inner UX.
export const NO_HIGHLIGHT_SELECTOR = "[data-no-highlight]";

export function targetMatchesSkip(target: EventTarget | null): boolean {
  return !!(target as HTMLElement | null)?.closest?.(NO_HIGHLIGHT_SELECTOR);
}
