// Crosshair + label showing where a selected zoom/pan element will send the camera.
// Draggable: the user can drag the crosshair to adjust the target x/y.
//
// Positioned in CANVAS space (outside the camera-transformed layer) because the
// target is the authored target, independent of the current playhead's transform.

"use client";

import { useCallback, useRef } from "react";
import type { ZoomElement, PanElement, SlideElement } from "../model/types";
import { useEditorStore } from "../model/store";
import { clamp } from "../utils/math";

interface Props {
  element: ZoomElement | PanElement;
  slideId: string;
}

export function CameraTargetIndicator({ element, slideId }: Props) {
  const draggingRef = useRef(false);
  const startRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      draggingRef.current = true;
      startRef.current = {
        x: e.clientX,
        y: e.clientY,
        tx: element.to.x,
        ty: element.to.y,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      useEditorStore.getState().beginDrag();
    },
    [element.to.x, element.to.y]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current || !startRef.current) return;
      const parent = (e.currentTarget as HTMLElement).parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const dx = ((e.clientX - startRef.current.x) / rect.width) * 100;
      const dy = ((e.clientY - startRef.current.y) / rect.height) * 100;
      const nx = clamp(startRef.current.tx + dx, 0, 100);
      const ny = clamp(startRef.current.ty + dy, 0, 100);
      useEditorStore.getState().updateElement(slideId, element.id, {
        to: { ...element.to, x: nx, y: ny },
      } as Partial<SlideElement>);
    },
    [element.id, element.to, slideId]
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    startRef.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    useEditorStore.getState().endDrag();
  }, []);

  const color = element.kind === "zoom" ? "#0ea5e9" : "#14b8a6";
  const label = element.kind === "zoom" ? `Zoom ${element.to.scale.toFixed(2)}×` : "Pan target";

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="absolute z-30 flex flex-col items-center"
      style={{
        left: `${element.to.x}%`,
        top: `${element.to.y}%`,
        transform: "translate(-50%, -50%)",
        cursor: "grab",
        pointerEvents: "auto",
      }}
    >
      <div
        className="rounded-full border-2"
        style={{
          width: 26,
          height: 26,
          borderColor: color,
          background: "rgba(255,255,255,0.7)",
          backdropFilter: "blur(2px)",
          boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
        }}
      >
        <div
          className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: color }}
        />
      </div>
      <div
        className="mt-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
        style={{ background: color }}
      >
        {label}
      </div>
    </div>
  );
}
