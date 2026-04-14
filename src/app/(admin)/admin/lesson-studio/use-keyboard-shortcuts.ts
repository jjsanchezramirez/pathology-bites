// Global keyboard shortcuts for the editor:
//   ⌘Z / ⌘⇧Z — undo / redo
//   ⌘S — save (opens save dialog)
//   ⌘N — new lesson (with dirty-check confirm)
//   ⌘O — load lesson (with dirty-check confirm)
//   ⌘⇧A — choose audio (opens audio picker dialog)
//   Arrow keys (no selection) — step the playhead (⇧ = 10 frames)
//   Arrow keys (with selection) — nudge selected elements (⇧ = 10%)
//   Home / End — jump playhead to start / end of current slide
//   Delete / Backspace — remove selected elements
//   Escape — clear selection or exit preview mode
// Shortcuts are ignored when focus is in an input/textarea.

"use client";

import { useEffect, useRef } from "react";
import { useEditorStore, selectCurrentSlide } from "./model/store";
import { FRAME_DURATION, snapToFrame, clamp } from "./utils/math";
import type { SlideElement } from "./model/types";

/**
 * Return a patch that translates `el` by (dx, dy) percentage points. Waypoint
 * positions are shifted by the same delta so the motion path moves with the
 * element. Camera ops (zoom/pan) are ignored — arrow keys shouldn't drag
 * camera targets out from under the user. The `waypoints` key is only
 * included when the element actually has waypoints, to avoid writing an
 * explicit `undefined` into the element.
 */
function translateElementBy(
  el: SlideElement,
  dx: number,
  dy: number
): Partial<SlideElement> | null {
  if (el.kind === "arrow") {
    const patch: Partial<SlideElement> = {
      from: { x: el.from.x + dx, y: el.from.y + dy },
      to: { x: el.to.x + dx, y: el.to.y + dy },
    } as Partial<SlideElement>;
    if (el.waypoints && el.waypoints.length > 0) {
      (patch as { waypoints: typeof el.waypoints }).waypoints = el.waypoints.map((w) => ({
        time: w.time,
        from: { x: w.from.x + dx, y: w.from.y + dy },
        to: { x: w.to.x + dx, y: w.to.y + dy },
      }));
    }
    return patch;
  }
  if ("rect" in el) {
    const patch: Partial<SlideElement> = {
      rect: { ...el.rect, x: el.rect.x + dx, y: el.rect.y + dy },
    } as Partial<SlideElement>;
    if (el.waypoints && el.waypoints.length > 0) {
      (patch as { waypoints: typeof el.waypoints }).waypoints = el.waypoints.map((w) => ({
        time: w.time,
        rect: { ...w.rect, x: w.rect.x + dx, y: w.rect.y + dy },
      }));
    }
    return patch;
  }
  return null;
}

export interface KeyboardShortcutHandlers {
  onSave?: () => void;
  onNew?: () => void;
  onOpen?: () => void;
  onChooseAudio?: () => void;
}

export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers = {}) {
  // Hold handlers in a ref so the effect can run once and still call the
  // latest callbacks without re-binding the window listener.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const inEditableField =
        !!t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable);

      const meta = e.metaKey || e.ctrlKey;
      const store = useEditorStore.getState();

      // Meta-key shortcuts fire even when an input is focused (⌘S while
      // typing the title should still save).
      if (meta && e.key === "s") {
        e.preventDefault();
        handlersRef.current.onSave?.();
        return;
      }
      if (meta && e.key === "o") {
        e.preventDefault();
        handlersRef.current.onOpen?.();
        return;
      }
      // ⌘N is reserved by most browsers for a new window; we bind it
      // anyway but it may not fire in every environment.
      if (meta && e.key === "n") {
        e.preventDefault();
        handlersRef.current.onNew?.();
        return;
      }
      // ⌘⇧A — open audio picker. Match lowercase because Shift+A reports
      // "A" on most layouts.
      if (meta && e.shiftKey && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        handlersRef.current.onChooseAudio?.();
        return;
      }

      // Arrow keys: nudge the selected element(s) when something is selected,
      // otherwise scrub the playhead. Skipped when meta is held so ⌘←/⌘→
      // (browser nav) aren't hijacked. Nudging takes priority over the
      // editable-field guard: if a canvas element is selected, arrow keys
      // should move it even if a title/timecode input technically still
      // holds focus.
      const isArrow =
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight" ||
        e.key === "ArrowUp" ||
        e.key === "ArrowDown";

      if (!meta && isArrow) {
        const selection = store.selection;
        const hasSelection = !!selection.slideId && selection.elementIds.length > 0;

        if (hasSelection) {
          const slide = store.lesson.slides.find((s) => s.id === selection.slideId);
          if (!slide) return;
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
          const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
          // Bracket the moves in a drag session so multi-element nudges
          // coalesce into a single history entry.
          store.beginDrag();
          for (const elId of selection.elementIds) {
            const el = slide.elements.find((x) => x.id === elId);
            if (!el) continue;
            const patch = translateElementBy(el, dx, dy);
            if (patch) store.updateElement(slide.id, elId, patch);
          }
          store.endDrag();
          return;
        }

        // No selection → scrub playhead on ←/→ only (↑/↓ do nothing).
        // Only when not in an input so typing in the title doesn't scrub.
        if (!inEditableField && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
          const slide = selectCurrentSlide(store);
          if (!slide) return;
          e.preventDefault();
          const dir = e.key === "ArrowRight" ? 1 : -1;
          const frames = e.shiftKey ? 10 : 1;
          const next = snapToFrame(store.viewTime + dir * frames * FRAME_DURATION);
          store.setViewTime(clamp(next, 0, slide.duration));
          return;
        }
      }

      // All remaining shortcuts (undo/redo, delete, escape, home/end) are
      // suppressed while typing so inputs can handle their own behavior.
      if (inEditableField) return;
      if (!meta && (e.key === "Home" || e.key === "End")) {
        const slide = selectCurrentSlide(store);
        if (!slide) return;
        e.preventDefault();
        store.setViewTime(e.key === "Home" ? 0 : snapToFrame(slide.duration));
        return;
      }

      if (meta && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        store.undo();
        return;
      }
      if (meta && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        store.redo();
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && !meta) {
        if (store.selection.slideId && store.selection.elementIds.length > 0) {
          e.preventDefault();
          for (const id of store.selection.elementIds) {
            store.removeElement(store.selection.slideId, id);
          }
        }
        return;
      }
      if (e.key === "Escape") {
        if (store.mode === "preview") {
          store.setMode("edit");
        } else {
          store.clearSelection();
          if (store.tool !== "select") store.setTool("select");
        }
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
