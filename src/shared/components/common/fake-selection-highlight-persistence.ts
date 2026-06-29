// Highlight persistence: serialize a highlight independently of live DOM nodes
// (normalized text + which occurrence) and re-resolve it back to a Range after the
// DOM changes under it. Highlights survive unmount/remount (question navigation)
// via a module-level store. Unit-tested (see fake-selection-highlight-persistence.test.ts).

import {
  type LocalRect,
  NO_HIGHLIGHT_SELECTOR,
  rangeToLocalRects,
} from "./fake-selection-highlight-dom";

// A highlight serialized independently of live DOM nodes: its normalized text plus
// which occurrence of that text (within the container's chrome-free text) it covers.
// Re-resolution searches the same eligible-text space used for highlighting, so
// chrome appearing/disappearing (strike buttons, option letters) can't shift anchors.
export type SerializedHighlight = { cleanText: string; occurrence: number };

// Module-level, keyed by `persistKey`: highlights survive component unmount for the
// lifetime of the page. Intentionally not localStorage — highlights are study-session
// scratch, not durable data.
export const persistedHighlightsStore = new Map<string, SerializedHighlight[]>();

export type TextIndex = { text: string; positions: Array<{ node: Text; offset: number }> };

// Concatenated whitespace-normalized text of all non-chrome text nodes, with a
// per-character map back to (node, offset). Mirrors the `.replace(/\s+/g, " ").trim()`
// normalization applied to selection text, so stored highlight text matches exactly.
export function buildTextIndex(root: HTMLElement): TextIndex {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (!n.textContent) return NodeFilter.FILTER_REJECT;
      const el = (n as Text).parentElement;
      if (el && el.closest(NO_HIGHLIGHT_SELECTOR)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let text = "";
  const positions: TextIndex["positions"] = [];
  let pendingSpace: { node: Text; offset: number } | null = null;
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const t = n as Text;
    for (let i = 0; i < t.data.length; i++) {
      if (/\s/.test(t.data[i])) {
        if (text.length > 0 && !pendingSpace) pendingSpace = { node: t, offset: i };
      } else {
        if (pendingSpace) {
          text += " ";
          positions.push(pendingSpace);
          pendingSpace = null;
        }
        text += t.data[i];
        positions.push({ node: t, offset: i });
      }
    }
  }
  return { text, positions };
}

export function findAllMatches(haystack: string, needle: string): number[] {
  if (!needle) return [];
  const out: number[] = [];
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    out.push(idx);
    idx = haystack.indexOf(needle, idx + 1);
  }
  return out;
}

export function matchToRange(index: TextIndex, start: number, length: number): Range | null {
  const startPos = index.positions[start];
  const endPos = index.positions[start + length - 1];
  if (!startPos || !endPos) return null;
  try {
    const r = document.createRange();
    r.setStart(startPos.node, startPos.offset);
    r.setEnd(endPos.node, endPos.offset + 1);
    return r;
  } catch {
    return null;
  }
}

export function serializeHighlight(
  container: HTMLElement,
  range: Range,
  cleanText: string
): SerializedHighlight {
  const index = buildTextIndex(container);
  const matches = findAllMatches(index.text, cleanText);
  if (matches.length <= 1) return { cleanText, occurrence: 0 };
  // Normalized index of the range start = first indexed character at/after it.
  let startIdx = index.positions.length;
  for (let i = 0; i < index.positions.length; i++) {
    const p = index.positions[i];
    try {
      if (range.comparePoint(p.node, p.offset) >= 0) {
        startIdx = i;
        break;
      }
    } catch {
      // node detached mid-walk — skip
    }
  }
  let occurrence = 0;
  let best = Infinity;
  matches.forEach((m, i) => {
    const d = Math.abs(m - startIdx);
    if (d < best) {
      best = d;
      occurrence = i;
    }
  });
  return { cleanText, occurrence };
}

export function resolveSerializedHighlight(
  container: HTMLElement,
  s: SerializedHighlight
): { range: Range; rects: LocalRect[] } | null {
  const index = buildTextIndex(container);
  const matches = findAllMatches(index.text, s.cleanText);
  if (matches.length === 0) return null;
  const start = matches[Math.min(s.occurrence, matches.length - 1)];
  const range = matchToRange(index, start, s.cleanText.length);
  if (!range) return null;
  const rects = rangeToLocalRects(range, container);
  if (rects.length === 0) return null;
  return { range, rects };
}

export function rectsEqual(a: LocalRect[], b: LocalRect[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].top !== b[i].top ||
      a[i].left !== b[i].left ||
      a[i].width !== b[i].width ||
      a[i].height !== b[i].height
    ) {
      return false;
    }
  }
  return true;
}
