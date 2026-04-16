// Per-slide animation track. Shows element timing bars + a draggable playhead.
// Click on an empty row / the ruler area to seek; click on a bar to select it.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditorStore, selectCurrentSlide } from "../model/store";
import { TimeRuler } from "./time-ruler";
import { TrackBar } from "./track-bar";
import { TrackPlayhead } from "./track-playhead";
import type { SlideElement } from "../model/types";

const ROW_HEIGHT = 22;
const MAX_VISIBLE_ROWS = 8;

export function AnimationTrack() {
  const slide = useEditorStore(selectCurrentSlide);
  const viewTime = useEditorStore((s) => s.viewTime);
  const selectedIds = useEditorStore((s) => s.selection.elementIds);

  // Track the body's width (not the ruler) so drag-delta → seconds math
  // accounts for scrollbar width and any body-local padding.
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [widthPx, setWidthPx] = useState(0);

  const hasSlide = !!slide;
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidthPx(el.clientWidth));
    ro.observe(el);
    setWidthPx(el.clientWidth);
    return () => ro.disconnect();
  }, [hasSlide]);

  // Vertical drag-to-reorder state.
  // `reorderActive` is only used to trigger listener attach/detach (once per
  // drag). The mutable drag state lives in refs so listener swaps on every
  // pointermove can't drop the eventual pointerup.
  const [reorderActive, setReorderActive] = useState(false);
  const [reorder, setReorder] = useState<{
    fromIndex: number;
    targetIndex: number;
    pointerY: number;
  } | null>(null);
  const reorderRef = useRef<{
    slideId: string;
    fromIndex: number;
    targetIndex: number;
  } | null>(null);
  const slideRef = useRef(slide);
  slideRef.current = slide;

  const onReorderStart = useCallback(
    (elementId: string, pointerY: number) => {
      if (!slide) return;
      const idx = slide.elements.findIndex((x) => x.id === elementId);
      if (idx < 0) return;
      reorderRef.current = { slideId: slide.id, fromIndex: idx, targetIndex: idx };
      setReorder({ fromIndex: idx, targetIndex: idx, pointerY });
      setReorderActive(true);
    },
    [slide]
  );

  // Ruler scrub ref — must be before early return to satisfy hook ordering.
  const rulerScrubbing = useRef(false);

  useEffect(() => {
    if (!reorderActive) return;
    function onMove(e: PointerEvent) {
      const body = bodyRef.current;
      const drag = reorderRef.current;
      if (!body || !drag) return;
      const rect = body.getBoundingClientRect();
      const y = e.clientY - rect.top + body.scrollTop;
      // Snap only after the pointer passes the midpoint of an adjacent row.
      const raw = y / ROW_HEIGHT - 0.5;
      const n = slideRef.current?.elements.length ?? 0;
      const target = Math.max(0, Math.min(n - 1, Math.round(raw)));
      if (target === drag.targetIndex) return; // no change → skip setState
      drag.targetIndex = target;
      setReorder({ fromIndex: drag.fromIndex, targetIndex: target, pointerY: e.clientY });
    }
    function onUp() {
      const drag = reorderRef.current;
      if (drag && drag.fromIndex !== drag.targetIndex) {
        useEditorStore.getState().reorderElement(drag.slideId, drag.fromIndex, drag.targetIndex);
      }
      reorderRef.current = null;
      setReorder(null);
      setReorderActive(false);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [reorderActive]);

  if (!slide) {
    return (
      <div className="flex h-24 items-center justify-center border-t bg-gray-50 text-xs text-muted-foreground">
        No slide selected
      </div>
    );
  }

  const duration = Math.max(1, slide.duration);
  const rows: SlideElement[] = slide.elements;
  const bodyHeight = Math.min(rows.length, MAX_VISIBLE_ROWS) * ROW_HEIGHT;
  function seekFromPointer(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const t = (x / rect.width) * duration;
    useEditorStore.getState().setViewTime(t);
  }

  function onRulerPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    rulerScrubbing.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    seekFromPointer(e);
  }

  function onRulerPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!rulerScrubbing.current) return;
    seekFromPointer(e);
  }

  function onRulerPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    rulerScrubbing.current = false;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  }

  const playheadPct = duration > 0 ? (viewTime / duration) * 100 : 0;

  return (
    <div className="flex flex-col border-t bg-white">
      {/* Ruler with click-to-seek + drag-to-scrub */}
      <div
        className="relative cursor-col-resize"
        onPointerDown={onRulerPointerDown}
        onPointerMove={onRulerPointerMove}
        onPointerUp={onRulerPointerUp}
        onPointerCancel={onRulerPointerUp}
      >
        <TimeRuler duration={duration} />
        {/* Playhead indicator in ruler */}
        <div
          className="pointer-events-none absolute top-0 bottom-0"
          style={{ left: `${playheadPct}%` }}
        >
          <div
            className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 bg-red-500"
            style={{ clipPath: "polygon(50% 100%, 0 0, 100% 0)" }}
          />
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2 bg-red-500/50" />
        </div>
      </div>

      {/* Track body */}
      <div
        ref={bodyRef}
        className="relative overflow-y-auto overflow-x-hidden"
        style={{ height: Math.max(bodyHeight, 40) }}
      >
        {rows.length === 0 && (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            No elements on this slide
          </div>
        )}
        {rows.map((el, index) => {
          // If reordering, visually shift rows to preview the drop target.
          let visualIndex = index;
          if (reorder) {
            if (index === reorder.fromIndex) {
              visualIndex = reorder.targetIndex;
            } else if (
              reorder.fromIndex < reorder.targetIndex &&
              index > reorder.fromIndex &&
              index <= reorder.targetIndex
            ) {
              visualIndex = index - 1;
            } else if (
              reorder.fromIndex > reorder.targetIndex &&
              index < reorder.fromIndex &&
              index >= reorder.targetIndex
            ) {
              visualIndex = index + 1;
            }
          }
          const dragging = reorder?.fromIndex === index;
          return (
            <div
              key={el.id}
              className="absolute left-0 right-0 border-b border-gray-100"
              style={{
                height: ROW_HEIGHT,
                top: visualIndex * ROW_HEIGHT,
                transition: reorder && !dragging ? "top 120ms" : undefined,
                opacity: dragging ? 0.7 : 1,
                zIndex: dragging ? 10 : undefined,
              }}
            >
              <TrackBar
                element={el}
                slideId={slide.id}
                slideDuration={duration}
                selected={selectedIds.includes(el.id)}
                widthPx={widthPx}
                onReorderStart={onReorderStart}
              />
            </div>
          );
        })}
        <div
          style={{
            position: "relative",
            height: rows.length * ROW_HEIGHT,
            pointerEvents: "none",
          }}
        />
        <TrackPlayhead time={viewTime} duration={duration} />
      </div>
    </div>
  );
}
