// The main editing surface. 16:9 aspect box, renders the current slide's
// background image and all SlideElements, with selection handles for the
// active selection. Pointer events route through useCanvasPointer.
//
// Camera transform (initialFraming + active zoom/pan at viewTime) is applied
// to a content wrapper so the editor preview matches player output when you
// scrub the playhead. Pointer hit-testing applies the inverse transform.

"use client";

import { useMemo, useRef } from "react";
import { useEditorStore, selectCurrentSlide } from "../model/store";
import { ElementRenderer } from "./element-renderer";
import { SelectionHandles } from "./selection-handles";
import { ArrowHandles } from "./arrow-handles";
import { CameraTargetIndicator } from "./camera-target-indicator";
import { useCanvasPointer } from "./use-canvas-pointer";
import { computeSlideAt, cameraToCss, rectAt } from "../model/runtime";
import { pointInRect } from "./geometry";
import type { SlideElement } from "../model/types";

export function EditorCanvas() {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const slide = useEditorStore(selectCurrentSlide);
  const selectedIds = useEditorStore((s) => s.selection.elementIds);
  const tool = useEditorStore((s) => s.tool);
  const viewTime = useEditorStore((s) => s.viewTime);

  const runtime = useMemo(
    () => (slide ? computeSlideAt(slide, viewTime) : null),
    [slide, viewTime]
  );

  const camera = runtime?.transform ?? { x: 0, y: 0, scale: 1 };

  const pointerHandlers = useCanvasPointer({ canvasRef, slide, camera, viewTime });

  // Double-click to inline-edit a text element (single click selects first).
  function onDoubleClick(e: React.MouseEvent) {
    if (!slide) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const canvasX = ((e.clientX - rect.left) / rect.width) * 100;
    const canvasY = ((e.clientY - rect.top) / rect.height) * 100;
    const s = camera.scale || 1;
    const pt = {
      x: (canvasX - 50 - camera.x) / s + 50,
      y: (canvasY - 50 - camera.y) / s + 50,
    };
    // Hit-test: find topmost text element under cursor.
    for (let i = slide.elements.length - 1; i >= 0; i--) {
      const el = slide.elements[i];
      if (el.kind !== "text") continue;
      // Use interpolated rect to match what the user sees.
      const r = rectAt(el, viewTime) ?? el.rect;
      if (pointInRect(pt, r)) {
        useEditorStore.getState().selectElements(slide.id, [el.id]);
        useEditorStore.getState().startEditing(el.id);
        return;
      }
    }
  }

  if (!slide) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black/5 text-sm text-muted-foreground">
        No slide selected
      </div>
    );
  }

  const selectedElements = slide.elements.filter((el) => selectedIds.includes(el.id));
  const singleSelection: SlideElement | null =
    selectedElements.length === 1 ? selectedElements[0] : null;

  return (
    <div className="flex h-full w-full items-center justify-center p-4">
      <div
        ref={canvasRef}
        className="relative select-none overflow-hidden bg-black shadow-lg"
        style={{
          aspectRatio: "16 / 9",
          width: "100%",
          maxHeight: "100%",
          cursor: tool === "select" ? "default" : "crosshair",
        }}
        onPointerDown={pointerHandlers.onPointerDown}
        onPointerMove={pointerHandlers.onPointerMove}
        onPointerUp={pointerHandlers.onPointerUp}
        onPointerCancel={pointerHandlers.onPointerUp}
        onDoubleClick={onDoubleClick}
      >
        {/* Camera-transformed content layer */}
        <div
          className="absolute inset-0"
          style={{
            transform: cameraToCss(camera),
            transformOrigin: "center center",
            transition: "none",
          }}
        >
          <div
            className="absolute inset-0"
            style={{ background: slide.backgroundColor ?? "#000" }}
          />

          {slide.elements.map((el) => (
            <ElementRenderer
              key={el.id}
              element={el}
              selected={selectedIds.includes(el.id)}
              runtimeOpacity={runtime?.elementOpacity[el.id] ?? 1}
              viewTime={viewTime}
            />
          ))}

          {singleSelection && renderHandlesFor(singleSelection, viewTime)}
        </div>

        {/* Camera target overlay (camera elements don't live in content space) */}
        {singleSelection && (singleSelection.kind === "zoom" || singleSelection.kind === "pan") && (
          <CameraTargetIndicator element={singleSelection} slideId={slide.id} />
        )}
      </div>
    </div>
  );
}

function renderHandlesFor(el: SlideElement, viewTime: number) {
  if (el.kind === "arrow") {
    return <ArrowHandles arrow={el} viewTime={viewTime} />;
  }
  if ("rect" in el) {
    // Use the interpolated rect at viewTime so handles track animated elements.
    const r = rectAt(el, viewTime) ?? el.rect;
    return <SelectionHandles rect={r} />;
  }
  return null;
}
