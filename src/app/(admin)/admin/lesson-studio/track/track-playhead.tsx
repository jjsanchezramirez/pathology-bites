// Vertical playhead line spanning the full track height. Drag to scrub viewTime.

"use client";

import { useCallback, useRef } from "react";
import { useEditorStore } from "../model/store";

interface TrackPlayheadProps {
  time: number;
  duration: number;
}

export function TrackPlayhead({ time, duration }: TrackPlayheadProps) {
  const dragRef = useRef(false);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    dragRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const parent = (e.currentTarget as HTMLElement).parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const t = (x / rect.width) * duration;
      useEditorStore.getState().setViewTime(t);
    },
    [duration]
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragRef.current = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  const pct = duration > 0 ? (time / duration) * 100 : 0;
  return (
    <div
      className="absolute top-0 z-10 h-full"
      style={{ left: `${pct}%`, marginLeft: -6, width: 12 }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-red-500"
        style={{ boxShadow: "0 0 4px rgba(239,68,68,0.6)" }}
      />
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 bg-red-500"
        style={{
          clipPath: "polygon(50% 100%, 0 0, 100% 0)",
        }}
      />
    </div>
  );
}
