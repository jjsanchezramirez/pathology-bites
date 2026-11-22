// The narration as a timeline row: one block per sentence. Elements tied to a
// sentence (auto timing) follow its block. Before the voice is recorded the
// blocks can be dragged to set when a sentence starts; the sentences after it
// follow. Once recorded, the voice sets the times and the blocks are locked.

"use client";

import { useRef } from "react";
import { useEditorStore } from "../model/store";
import { lineWindows } from "@/shared/lesson/auto-timing";
import type { Slide } from "../model/types";
import { snapToFrame } from "../utils/math";

export const NARRATION_ROW_HEIGHT = 24;

export function NarrationRow({ slide, widthPx }: { slide: Slide; widthPx: number }) {
  const lines = slide.narration?.lines ?? [];
  const windows = lineWindows(slide);
  const recorded =
    lines.length > 0 &&
    lines.every((l) => typeof l.start === "number" && typeof l.end === "number");
  const duration = Math.max(1, slide.duration);
  const drag = useRef<{ index: number; x: number; at: number } | null>(null);

  if (!lines.length) return null;

  function setAt(index: number, at: number) {
    const store = useEditorStore.getState();
    const s = store.lesson.slides.find((x) => x.id === slide.id);
    if (!s?.narration) return;
    store.updateSlide(slide.id, {
      narration: {
        ...s.narration,
        lines: s.narration.lines.map((l, i) => (i === index ? { ...l, at } : l)),
      },
    });
  }

  function onDown(index: number) {
    return (e: React.PointerEvent<HTMLDivElement>) => {
      if (recorded) return;
      e.stopPropagation();
      drag.current = { index, x: e.clientX, at: windows[index].start };
      useEditorStore.getState().beginDrag();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    };
  }
  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || widthPx <= 0) return;
    const dt = ((e.clientX - d.x) / widthPx) * duration;
    setAt(d.index, Math.max(0, snapToFrame(d.at + dt)));
  }
  function onUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    drag.current = null;
    useEditorStore.getState().endDrag();
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  }
  function resetAt(index: number) {
    const store = useEditorStore.getState();
    const s = store.lesson.slides.find((x) => x.id === slide.id);
    if (!s?.narration || s.narration.lines[index].at == null) return;
    store.updateSlide(slide.id, {
      narration: {
        ...s.narration,
        lines: s.narration.lines.map((l, i) => {
          if (i !== index) return l;
          const { at: _at, ...rest } = l;
          return rest;
        }),
      },
    });
  }

  return (
    <div
      className="relative border-b border-gray-200 bg-amber-50/60"
      style={{ height: NARRATION_ROW_HEIGHT }}
      title={
        recorded
          ? "Narration: times come from the recorded voice"
          : "Narration: drag a sentence to move it; elements tied to it follow. Double-click to put it back."
      }
    >
      {lines.map((line, i) => {
        const w = windows[i];
        const left = (w.start / duration) * 100;
        const width = Math.max(0.5, ((w.end - w.start) / duration) * 100);
        return (
          <div
            key={line.id}
            onPointerDown={onDown(i)}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onDoubleClick={() => resetAt(i)}
            className={[
              "absolute top-[3px] bottom-[3px] truncate rounded-sm px-1.5 text-[10px] leading-[18px] text-amber-950",
              recorded
                ? "cursor-default bg-amber-300/80"
                : "cursor-grab bg-amber-200 hover:bg-amber-300",
              line.at != null ? "ring-1 ring-amber-600" : "",
            ].join(" ")}
            style={{ left: `${left}%`, width: `${width}%` }}
          >
            {i + 1}. {line.text}
          </div>
        );
      })}
    </div>
  );
}
