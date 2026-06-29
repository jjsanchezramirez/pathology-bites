"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { VirtualSlide } from "@/shared/types/virtual-slides";
import {
  MIN_CHARS,
  SEARCH_WORD_LIMIT,
  TOP_MATCH_MIN_SCORE_WHO,
  TOP_MATCH_MIN_SCORE_OTHER,
  openGoogleImages,
  openVirtualSlides,
  openWsi,
} from "./fake-selection-highlight-utils";
import {
  type LocalRect,
  type CaretPos,
  type Granularity,
  type DragState,
  type FakeSelection,
  countWords,
  caretPosFromPoint,
  buildRange,
  expandToWordRange,
  paragraphRange,
  firstTextPos,
  lastTextPos,
  unionRanges,
  rangeToLocalRects,
  rangeCleanTextAndRects,
  targetMatchesSkip,
} from "./fake-selection-highlight-dom";
import {
  type SerializedHighlight,
  persistedHighlightsStore,
  serializeHighlight,
  resolveSerializedHighlight,
  rectsEqual,
} from "./fake-selection-highlight-persistence";
import {
  useDebouncedValue,
  useDelayedPresence,
  useTopMatches,
  useTopWsiMatch,
  useCoarsePointer,
  SearchActionsBar,
  ContextSelectionMenu,
  VIEWPORT_TOP_SAFE_PX,
} from "./fake-selection-highlight-parts";

// Re-exported for the /debug/image-search-highlight page (its scoring/word-limit copy).
export { SEARCH_WORD_LIMIT };
export const TOP_MATCH_MIN_SCORE_WHO_EXPORT = TOP_MATCH_MIN_SCORE_WHO;
export const TOP_MATCH_MIN_SCORE_OTHER_EXPORT = TOP_MATCH_MIN_SCORE_OTHER;

// Pointer-interaction tuning (the selection engine below).
const LONG_PRESS_MS = 350;
const LONG_PRESS_TOLERANCE_PX = 8;
const DRAG_THRESHOLD_PX = 3;
const MULTI_CLICK_MS = 350;
const MULTI_CLICK_RADIUS_PX = 12;

const MENU_APPEAR_DELAY_MS = 220;
const MENU_FADE_DURATION_MS = 120;
// Slide-corpus ranking sweeps tens of thousands of slides; debounce the selection text
// that feeds it so a drag (text changes every pointer-move frame) re-ranks only once the
// selection settles. Tuned just under the menu-appear delay so matches are ready as the
// bubble shows.
const MATCH_QUERY_DEBOUNCE_MS = 180;
const HIGHLIGHT_COLOR = "rgba(250, 204, 21, 0.5)";

type FakeSelectionHighlightProps = {
  allSlides: VirtualSlide[] | null;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  // When provided, the WSI match action opens the slide in the in-house viewer (inline)
  // instead of linking out — for repos the viewer can render. The host renders the modal.
  onViewSlide?: (slide: VirtualSlide) => void;
  // When provided, highlights are kept in a module-level store under this key and
  // re-anchored (by text + occurrence) when the component remounts — e.g. navigating
  // away from a quiz question and back.
  persistKey?: string;
};

export function FakeSelectionHighlight(props: FakeSelectionHighlightProps) {
  const coarsePointer = useCoarsePointer();
  if (coarsePointer) {
    return (
      <div className={props.className} style={props.style}>
        {props.children}
      </div>
    );
  }
  return <FakeSelectionHighlightImpl {...props} />;
}

function FakeSelectionHighlightImpl({
  allSlides,
  children,
  className,
  style,
  onViewSlide,
  persistKey,
}: FakeSelectionHighlightProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [selection, setSelection] = useState<FakeSelection | null>(null);
  const selectionRef = useRef<FakeSelection | null>(null);
  selectionRef.current = selection;
  const [active, setActive] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  // `range` is null while a restored highlight can't be re-anchored yet (its text not in
  // the DOM, e.g. an explanation highlight while the explanation is hidden); the sync
  // pass re-resolves it from `serialized` once the text reappears.
  const [highlights, setHighlights] = useState<
    Array<{
      id: number;
      range: Range | null;
      text: string;
      rects: LocalRect[];
      serialized: SerializedHighlight;
    }>
  >([]);
  const highlightIdRef = useRef(0);
  const restoredRef = useRef(false);
  const dragRef = useRef<DragState | null>(null);
  const longPressRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingRangeRef = useRef<{ range: Range; granularity: Granularity } | null>(null);
  const clickStreakRef = useRef<{ count: number; time: number; x: number; y: number } | null>(null);
  const { current: stableSelection, visible: menuVisible } = useDelayedPresence(
    selection,
    MENU_APPEAR_DELAY_MS,
    MENU_FADE_DURATION_MS
  );
  const liveQueryText = selection?.text ?? stableSelection?.text;
  const queryText = useDebouncedValue(liveQueryText, MATCH_QUERY_DEBOUNCE_MS);
  const topMatch = useTopWsiMatch(queryText, allSlides);
  const topMatches = useTopMatches(queryText, allSlides, 8);

  const toggleHighlight = useCallback(() => {
    const sel = selectionRef.current;
    if (!sel) return;
    setHighlights((prev) => {
      const overlapIds = new Set<number>();
      for (const h of prev) {
        if (!h.range || !h.range.startContainer.isConnected) continue;
        try {
          const aEndVsBStart = sel.range.compareBoundaryPoints(Range.START_TO_END, h.range);
          const aStartVsBEnd = sel.range.compareBoundaryPoints(Range.END_TO_START, h.range);
          if (aEndVsBStart > 0 && aStartVsBEnd < 0) overlapIds.add(h.id);
        } catch {
          // ranges no longer share a root — can't overlap
        }
      }
      if (overlapIds.size > 0) {
        return prev.filter((h) => !overlapIds.has(h.id));
      }
      const id = ++highlightIdRef.current;
      const serialized = containerRef.current
        ? serializeHighlight(containerRef.current, sel.range, sel.text)
        : { cleanText: sel.text, occurrence: 0 };
      return [
        ...prev,
        { id, range: sel.range.cloneRange(), text: sel.text, rects: [...sel.rects], serialized },
      ];
    });
  }, []);

  const commitRange = useCallback((range: Range, granularity: Granularity) => {
    const container = containerRef.current;
    if (!container) return;
    const { text: rawText, rects } = rangeCleanTextAndRects(range, container);
    const text = rawText.replace(/\s+/g, " ").trim();
    if (text.length < MIN_CHARS) {
      setSelection(null);
      return;
    }
    if (rects.length === 0) {
      // Valid text but no paintable rects this frame — a drag frame whose range momentarily
      // lands wholly in clipped/zero-area content (the References row uses line-clamp /
      // -webkit-box). Don't blink the selection out; advance range/text but keep the last good
      // rects until a frame with real geometry replaces them.
      setSelection((cur) => (cur ? { ...cur, range, text, granularity } : cur));
      return;
    }
    setSelection({ range, text, rects, granularity });
  }, []);

  const clearSelection = useCallback(() => {
    dragRef.current = null;
    setSelection(null);
    setActive(false);
    setContextMenu(null);
  }, []);

  const cancelLongPress = () => {
    if (longPressRef.current != null) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };

  const isInsideMenu = (node: EventTarget | null) =>
    !!(node as HTMLElement)?.closest?.("[data-fake-selection-menu], [data-context-menu]");

  const tickClickStreak = (e: React.PointerEvent): number => {
    const prev = clickStreakRef.current;
    const now = Date.now();
    const continuation =
      prev != null &&
      now - prev.time <= MULTI_CLICK_MS &&
      Math.hypot(e.clientX - prev.x, e.clientY - prev.y) <= MULTI_CLICK_RADIUS_PX;
    const count = continuation ? Math.min(prev!.count + 1, 3) : 1;
    clickStreakRef.current = { count, time: now, x: e.clientX, y: e.clientY };
    return count;
  };

  const extendSelectionToPos = (pos: CaretPos): Range | null => {
    const cur = selectionRef.current;
    if (!cur) return null;
    const cmp = cur.range.comparePoint(pos.node, pos.offset);
    if (cur.granularity === "word") {
      const focusWord = expandToWordRange(pos);
      return focusWord ? unionRanges(cur.range, focusWord) : cur.range.cloneRange();
    }
    if (cur.granularity === "paragraph") {
      const focusPara = paragraphRange(pos);
      return focusPara ? unionRanges(cur.range, focusPara) : cur.range.cloneRange();
    }
    const next = cur.range.cloneRange();
    if (cmp < 0) next.setStart(pos.node, pos.offset);
    else next.setEnd(pos.node, pos.offset);
    return next;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isInsideMenu(e.target)) return;
    if (targetMatchesSkip(e.target)) return;
    const isContextMouse = e.pointerType === "mouse" && (e.button !== 0 || e.ctrlKey);
    if (isContextMouse) return;
    const pos = caretPosFromPoint(e.clientX, e.clientY);
    if (!pos || !containerRef.current?.contains(pos.node)) {
      clearSelection();
      return;
    }

    setContextMenu(null);

    if (e.shiftKey && selectionRef.current) {
      const next = extendSelectionToPos(pos);
      if (next) commitRange(next, selectionRef.current.granularity);
      return;
    }

    const clickCount = tickClickStreak(e);

    if (clickCount >= 3) {
      const paraRange = paragraphRange(pos);
      if (paraRange) {
        commitRange(paraRange, "paragraph");
        dragRef.current = {
          granularity: "paragraph",
          anchor: pos,
          anchorRange: paraRange,
          downX: e.clientX,
          downY: e.clientY,
          moved: false,
          pointerType: e.pointerType,
        };
        setActive(true);
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
        return;
      }
    }

    if (clickCount === 2) {
      const wordRange = expandToWordRange(pos);
      if (wordRange) {
        commitRange(wordRange, "word");
        dragRef.current = {
          granularity: "word",
          anchor: pos,
          anchorRange: wordRange,
          downX: e.clientX,
          downY: e.clientY,
          moved: false,
          pointerType: e.pointerType,
        };
        setActive(true);
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
        return;
      }
    }

    setSelection(null);
    dragRef.current = {
      granularity: "char",
      anchor: pos,
      downX: e.clientX,
      downY: e.clientY,
      moved: false,
      pointerType: e.pointerType,
    };

    if (e.pointerType === "mouse" || e.pointerType === "pen") {
      setActive(true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    } else {
      cancelLongPress();
      longPressRef.current = window.setTimeout(() => {
        longPressRef.current = null;
        if (!dragRef.current) return;
        setActive(true);
        navigator.vibrate?.(8);
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      }, LONG_PRESS_MS);
    }
  };

  const resolvePos = (clientX: number, clientY: number): CaretPos | null => {
    const container = containerRef.current;
    if (!container) return null;
    const pos = caretPosFromPoint(clientX, clientY);
    if (pos && container.contains(pos.node)) return pos;
    const cRect = container.getBoundingClientRect();
    if (clientY < cRect.top) return firstTextPos(container);
    if (clientY > cRect.bottom) return lastTextPos(container);
    const clampedX = Math.max(cRect.left + 1, Math.min(cRect.right - 1, clientX));
    if (clampedX !== clientX) {
      const fallback = caretPosFromPoint(clampedX, clientY);
      if (fallback && container.contains(fallback.node)) return fallback;
    }
    return null;
  };

  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const autoScrollRafRef = useRef<number | null>(null);

  const commitFromPointer = (clientX: number, clientY: number) => {
    const drag = dragRef.current;
    if (!drag) return;
    const pos = resolvePos(clientX, clientY);
    if (!pos) return;
    let range: Range | null;
    if (drag.granularity === "word" && drag.anchorRange) {
      const focusWord = expandToWordRange(pos);
      range = focusWord ? unionRanges(drag.anchorRange, focusWord) : drag.anchorRange;
    } else if (drag.granularity === "paragraph" && drag.anchorRange) {
      const focusPara = paragraphRange(pos);
      range = focusPara ? unionRanges(drag.anchorRange, focusPara) : drag.anchorRange;
    } else {
      range = buildRange(drag.anchor, pos);
    }
    if (!range) return;
    pendingRangeRef.current = { range, granularity: drag.granularity };
    if (rafRef.current != null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      const pending = pendingRangeRef.current;
      pendingRangeRef.current = null;
      if (pending) commitRange(pending.range, pending.granularity);
    });
  };

  const stopAutoScroll = () => {
    if (autoScrollRafRef.current != null) {
      window.cancelAnimationFrame(autoScrollRafRef.current);
      autoScrollRafRef.current = null;
    }
  };

  const ensureAutoScroll = (dir: -1 | 1, speedPx: number) => {
    if (autoScrollRafRef.current != null) return;
    const tick = () => {
      const drag = dragRef.current;
      const lp = lastPointerRef.current;
      if (!drag || !lp) {
        autoScrollRafRef.current = null;
        return;
      }
      window.scrollBy(0, dir * speedPx);
      commitFromPointer(lp.x, lp.y);
      autoScrollRafRef.current = window.requestAnimationFrame(tick);
    };
    autoScrollRafRef.current = window.requestAnimationFrame(tick);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;

    const dx = e.clientX - drag.downX;
    const dy = e.clientY - drag.downY;
    const dist = Math.hypot(dx, dy);

    if (drag.pointerType === "touch" && !active) {
      if (dist > LONG_PRESS_TOLERANCE_PX) {
        cancelLongPress();
        dragRef.current = null;
      }
      return;
    }

    if (!active) return;

    if (!drag.moved && dist < DRAG_THRESHOLD_PX) return;
    drag.moved = true;

    if (e.pointerType !== "mouse") e.preventDefault();

    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    commitFromPointer(e.clientX, e.clientY);

    const EDGE = 60;
    const vh = window.innerHeight;
    if (e.clientY < EDGE) {
      const speed = Math.min(20, 4 + (EDGE - e.clientY) * 0.3);
      ensureAutoScroll(-1, speed);
    } else if (e.clientY > vh - EDGE) {
      const speed = Math.min(20, 4 + (e.clientY - (vh - EDGE)) * 0.3);
      ensureAutoScroll(1, speed);
    } else {
      stopAutoScroll();
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    cancelLongPress();
    stopAutoScroll();
    lastPointerRef.current = null;
    const drag = dragRef.current;
    if (drag) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      if (!drag.moved && !selection && drag.granularity === "char") {
        setActive(false);
      }
    }
    dragRef.current = null;
  };

  useEffect(() => {
    if (!active) return;
    const onMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerType !== "mouse") return;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      commitFromPointer(e.clientX, e.clientY);
    };
    const onUp = () => {
      if (dragRef.current?.pointerType !== "mouse") return;
      cancelLongPress();
      stopAutoScroll();
      lastPointerRef.current = null;
      dragRef.current = null;
      setActive(false);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    if (!selection) return;
    const onCopy = (e: ClipboardEvent) => {
      e.clipboardData?.setData("text/plain", selection.text);
      e.preventDefault();
    };
    document.addEventListener("copy", onCopy);
    return () => document.removeEventListener("copy", onCopy);
  }, [selection]);

  useEffect(() => {
    if (!stableSelection) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        clearSelection();
        return;
      }

      const cmd = e.metaKey || e.ctrlKey;
      if (!cmd || !e.shiftKey || e.altKey) return;

      const text = stableSelection.text;
      const wsiUrl = topMatch?.slide.case_url || topMatch?.slide.slide_url || "";
      const allowSearch = countWords(text) <= SEARCH_WORD_LIMIT;
      const key = e.key.toLowerCase();

      if (key === "g" && allowSearch) {
        e.preventDefault();
        openGoogleImages(text);
        clearSelection();
        return;
      }
      if (key === "v" && allowSearch) {
        e.preventDefault();
        openVirtualSlides(text);
        clearSelection();
        return;
      }
      if (key === "w" && allowSearch && wsiUrl) {
        e.preventDefault();
        openWsi(wsiUrl);
        clearSelection();
        return;
      }
      if (key === "h") {
        e.preventDefault();
        toggleHighlight();
        return;
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [stableSelection, topMatch, clearSelection, toggleHighlight]);

  useEffect(() => {
    if (!selection) return;
    const onDocDown = (e: MouseEvent) => {
      if (isInsideMenu(e.target)) return;
      if (!containerRef.current?.contains(e.target as Node)) {
        clearSelection();
      }
    };
    window.addEventListener("mousedown", onDocDown);
    return () => window.removeEventListener("mousedown", onDocDown);
  }, [selection, clearSelection]);

  // Restore persisted highlights on mount (after children have rendered), re-anchoring
  // each one by its text. Must run before the persist effect below ever writes, or the
  // initial empty state would wipe the store.
  useEffect(() => {
    if (persistKey) {
      const saved = persistedHighlightsStore.get(persistKey);
      const container = containerRef.current;
      if (saved && saved.length > 0 && container) {
        setHighlights(
          saved.map((s) => {
            const resolved = resolveSerializedHighlight(container, s);
            return {
              id: ++highlightIdRef.current,
              range: resolved?.range ?? null,
              text: s.cleanText,
              rects: resolved?.rects ?? [],
              serialized: s,
            };
          })
        );
      }
    }
    restoredRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!persistKey || !restoredRef.current) return;
    persistedHighlightsStore.set(
      persistKey,
      highlights.map((h) => h.serialized)
    );
  }, [highlights, persistKey]);

  // Re-sync overlay rects with reality whenever layout or content changes: window
  // resize, content resize (images loading), or DOM mutations (explanation appearing,
  // chrome toggling). Highlights whose ranges died are re-anchored from their
  // serialized form; ones whose text left the DOM stay stored but render nothing.
  const syncOverlays = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    // Never reconcile mid-drag. A cross-section drag triggers edge auto-scroll and lazy
    // image loads, which fire the Resize/Mutation observers; if syncOverlays runs while the
    // drag is live, `rangeToLocalRects` can transiently return [] during a layout flush and
    // `clearSelection()` fires — the selection visibly blinks out and back. The drag's own
    // commitFromPointer keeps the live selection rects current every frame, and highlights
    // don't change during a selection drag, so there is nothing to sync until pointer-up.
    if (dragRef.current) return;
    if (selectionRef.current) {
      const sel = selectionRef.current;
      const connected = sel.range.startContainer.isConnected && sel.range.endContainer.isConnected;
      if (!connected) {
        // Range's nodes left the DOM (content swapped out) — the selection is genuinely gone.
        clearSelection();
      } else {
        const rects = rangeToLocalRects(sel.range, container);
        // rects empty while still connected = clipped/zero-area content (References line-clamp);
        // keep the prior rects rather than clearing, so the selection doesn't blink.
        if (rects.length > 0 && !rectsEqual(rects, sel.rects)) {
          setSelection((cur) => (cur ? { ...cur, rects } : cur));
        }
      }
    }
    setHighlights((prev) => {
      if (prev.length === 0) return prev;
      let changed = false;
      const next = prev.map((h) => {
        const alive = h.range && h.range.startContainer.isConnected && !h.range.collapsed;
        const rects = alive ? rangeToLocalRects(h.range!, container) : [];
        if (rects.length > 0) {
          if (rectsEqual(rects, h.rects)) return h;
          changed = true;
          return { ...h, rects };
        }
        const resolved = resolveSerializedHighlight(container, h.serialized);
        if (resolved) {
          changed = true;
          return { ...h, range: resolved.range, rects: resolved.rects };
        }
        if (h.rects.length === 0 && h.range === null) return h;
        changed = true;
        return { ...h, range: null, rects: [] };
      });
      return changed ? next : prev;
    });
  }, [clearSelection]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    let raf: number | null = null;
    const schedule = () => {
      if (raf != null) return;
      raf = window.requestAnimationFrame(() => {
        raf = null;
        syncOverlays();
      });
    };
    // Observe the content layer only — the overlay rects are siblings, so our own
    // setState never re-triggers the observers (and rectsEqual bails regardless).
    const ro = new ResizeObserver(schedule);
    ro.observe(content);
    const mo = new MutationObserver(schedule);
    mo.observe(content, { childList: true, subtree: true, characterData: true });
    window.addEventListener("resize", schedule);
    return () => {
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", schedule);
      if (raf != null) window.cancelAnimationFrame(raf);
    };
  }, [syncOverlays]);

  // syncOverlays no-ops while a drag is live (see guard there), so reconcile once when the
  // drag ends — picks up any layout shift (lazy image, auto-scroll) that fired the observers
  // mid-drag and was skipped.
  useEffect(() => {
    if (active) return;
    const raf = window.requestAnimationFrame(syncOverlays);
    return () => window.cancelAnimationFrame(raf);
  }, [active, syncOverlays]);

  const onContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isInsideMenu(e.target)) {
      e.preventDefault();
      return;
    }
    if (targetMatchesSkip(e.target)) return;
    e.preventDefault();
    const pos = caretPosFromPoint(e.clientX, e.clientY);
    if (!pos || !containerRef.current?.contains(pos.node)) return;
    if (!selectionRef.current) {
      const word = expandToWordRange(pos);
      if (word) commitRange(word, "word");
    }
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    if (!contextMenu) return;
    const onDocDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("[data-context-menu]")) return;
      setContextMenu(null);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    window.addEventListener("mousedown", onDocDown);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("mousedown", onDocDown);
      window.removeEventListener("keydown", onEsc);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!contextMenu) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [contextMenu]);

  const menuRects = selection?.rects ?? stableSelection?.rects;
  const menuStyle: React.CSSProperties | undefined =
    stableSelection && menuRects && menuRects.length > 0
      ? (() => {
          const first = menuRects[0];
          // Approximate bar height + gap; if the bar would open into the fixed-navbar
          // band at the top of the viewport (it shares z-50 and loses), anchor it
          // below the selection's last line instead.
          const BAR_CLEARANCE_PX = 40;
          const containerTop = containerRef.current?.getBoundingClientRect().top ?? 0;
          const fitsAbove = containerTop + first.top - BAR_CLEARANCE_PX >= VIEWPORT_TOP_SAFE_PX;
          if (fitsAbove) {
            return {
              position: "absolute" as const,
              top: first.top - 8,
              left: first.left + first.width / 2,
              transform: "translate(-50%, -100%)",
            };
          }
          const last = menuRects[menuRects.length - 1];
          return {
            position: "absolute" as const,
            top: last.top + last.height + 8,
            left: last.left + last.width / 2,
            transform: "translate(-50%, 0)",
          };
        })()
      : undefined;

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={onContextMenu}
      style={{
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        cursor: "text",
        position: "relative",
        touchAction: active ? "none" : "pan-y",
      }}
    >
      {/* Content layer carries the caller's spacing/styling. The overlays below are positioned
          against this relative root but kept OUT of the content's flow, so a live selection's
          rects/menu can never nudge the card's height (the reported "grows a few px" glitch). */}
      <div ref={contentRef} className={className} style={style}>
        {children}
      </div>
      {highlights.map((h) =>
        h.rects.map((rect, i) => (
          <div
            key={`${h.id}-${i}`}
            aria-hidden="true"
            style={{
              position: "absolute",
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              background: HIGHLIGHT_COLOR,
              pointerEvents: "none",
              zIndex: 40,
              borderRadius: 2,
            }}
          />
        ))
      )}
      {/* One layer that fades in ONCE when the selection first appears. The individual rect
          divs inside carry no animation: during a drag the rect set changes shape/count every
          frame, and a per-rect mount animation replayed its 90ms fade on every remount —
          visible flicker, worst where rect counts churn (block boundaries, line wraps, the
          References row). Animating the stable wrapper instead keeps the one-time fade without
          the churn. */}
      {selection && (
        <div
          aria-hidden="true"
          className="fake-selection-layer"
          style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 30 }}
        >
          {selection.rects.map((rect, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
                background: "rgba(99, 102, 241, 0.18)",
                borderRadius: 2,
              }}
            />
          ))}
        </div>
      )}
      {stableSelection && menuStyle && (
        <div
          data-fake-selection-menu
          style={{
            ...menuStyle,
            opacity: contextMenu ? 0 : menuVisible ? 1 : 0,
            pointerEvents: contextMenu ? "none" : "auto",
            transition: `opacity ${MENU_FADE_DURATION_MS}ms ease-out`,
            zIndex: 50,
          }}
        >
          <SearchActionsBar
            text={stableSelection.text}
            topMatch={topMatch}
            topMatches={topMatches}
            onHighlight={toggleHighlight}
            onDismiss={clearSelection}
            onViewSlide={onViewSlide}
          />
        </div>
      )}
      {contextMenu && selection && (
        <ContextSelectionMenu
          x={contextMenu.x}
          y={contextMenu.y}
          text={selection.text}
          topMatch={topMatch}
          topMatches={topMatches}
          onHighlight={() => {
            toggleHighlight();
            setContextMenu(null);
          }}
          onViewSlide={
            onViewSlide
              ? (slide) => {
                  onViewSlide(slide);
                  setContextMenu(null);
                }
              : undefined
          }
          onClose={() => setContextMenu(null)}
        />
      )}
      <style jsx>{`
        .fake-selection-layer {
          animation: fake-selection-fade-in 90ms ease-out;
        }
        @keyframes fake-selection-fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
