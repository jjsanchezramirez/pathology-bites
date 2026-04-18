// Renders a single SlideElement on the canvas, in edit mode.
// All coordinates are 0–100% of the canvas; consumers place this inside a
// relatively-positioned 16:9 box. Runtime position comes from the element's
// waypoints (if ≥2) interpolated at the current viewTime, otherwise from the
// element's static rect/points.

"use client";

import { useEffect, useRef } from "react";
import { useEditorStore } from "../model/store";
import type {
  SlideElement,
  ShapeElement,
  SpotlightElement,
  ArrowElement,
  TextElement,
  SvgElement,
  ImageElement,
  Rect,
  Point,
} from "../model/types";
import { rectAt, arrowPointsAt } from "../model/runtime";

export interface ElementRendererProps {
  element: SlideElement;
  selected: boolean;
  /** Opacity computed from viewTime (0–1). Authored opacity is multiplied in. */
  runtimeOpacity?: number;
  /** Current view time — used to interpolate waypoint-animated positions. */
  viewTime: number;
}

export function ElementRenderer({
  element,
  selected,
  runtimeOpacity = 1,
  viewTime,
}: ElementRendererProps) {
  // When an element is selected, keep it visually present even if its fade
  // window makes it fully transparent at the current viewTime.
  const o = selected ? Math.max(runtimeOpacity, 0.35) : runtimeOpacity;
  switch (element.kind) {
    case "shape": {
      const r = rectAt(element, viewTime) ?? element.rect;
      return <ShapeView el={element} selected={selected} opacity={o} rect={r} />;
    }
    case "spotlight": {
      const r = rectAt(element, viewTime) ?? element.rect;
      return <SpotlightView el={element} selected={selected} opacity={o} rect={r} />;
    }
    case "arrow": {
      const pts = arrowPointsAt(element, viewTime);
      return <ArrowView el={element} selected={selected} opacity={o} from={pts.from} to={pts.to} />;
    }
    case "text": {
      const r = rectAt(element, viewTime) ?? element.rect;
      return <TextView el={element} selected={selected} opacity={o} rect={r} />;
    }
    case "svg": {
      const r = rectAt(element, viewTime) ?? element.rect;
      return <SvgView el={element} selected={selected} opacity={o} rect={r} />;
    }
    case "image": {
      const r = rectAt(element, viewTime) ?? element.rect;
      return <ImageView el={element} selected={selected} opacity={o} rect={r} />;
    }
    case "camera":
      return null;
  }
}

function rectStyle(rect: Rect): React.CSSProperties {
  return {
    position: "absolute",
    left: `${rect.x}%`,
    top: `${rect.y}%`,
    width: `${rect.w}%`,
    height: `${rect.h}%`,
    transform: `rotate(${rect.rotation}deg)`,
    transformOrigin: "center",
    pointerEvents: "none",
  };
}

// ---- Shape -----------------------------------------------------------------

function ShapeView({
  el,
  selected,
  opacity,
  rect,
}: {
  el: ShapeElement;
  selected: boolean;
  opacity: number;
  rect: Rect;
}) {
  const borderRadius = el.shape === "circle" || el.shape === "oval" ? "50%" : "0";
  return (
    <div
      data-element-id={el.id}
      style={{
        ...rectStyle(rect),
        border: `${el.stroke.width}px ${el.stroke.style} ${el.stroke.color}`,
        borderRadius,
        background: el.fill ?? "transparent",
        boxShadow: el.shadow ? "0 1px 4px rgba(0,0,0,0.6)" : undefined,
        outline: selected ? "1px dashed rgba(59,130,246,0.9)" : undefined,
        outlineOffset: "2px",
        opacity,
      }}
    />
  );
}

// ---- Spotlight -------------------------------------------------------------

function SpotlightView({
  el,
  selected,
  opacity,
  rect,
}: {
  el: SpotlightElement;
  selected: boolean;
  opacity: number;
  rect: Rect;
}) {
  const borderRadius = el.shape === "circle" || el.shape === "oval" ? "50%" : "0";
  // Visual hint only in the editor — actual spotlight rendering happens in the
  // player via SVG masks. Here we just show the region outline and dim the rest.
  return (
    <>
      <div
        data-element-id={el.id}
        style={{
          ...rectStyle(rect),
          borderRadius,
          boxShadow: `0 0 0 9999px rgba(0,0,0,${el.dimOpacity * 0.5})`,
          outline: "2px solid rgba(255,220,100,0.9)",
          outlineOffset: "-1px",
          opacity,
        }}
      />
      {selected && null}
    </>
  );
}

// ---- Arrow -----------------------------------------------------------------

function ArrowView({
  el,
  selected,
  opacity,
  from,
  to,
}: {
  el: ArrowElement;
  selected: boolean;
  opacity: number;
  from: Point;
  to: Point;
}) {
  const markerId = `arrow-head-${el.id}`;
  // Marker scales with stroke-width by default (markerUnits="strokeWidth", which is
  // the SVG default). We size the marker so its tip sits at the line endpoint and
  // its base covers the last `headSize/strokeWidth` segment of the line.
  const headRatio = Math.max(2, el.headSize / el.strokeWidth);
  return (
    <svg
      data-element-id={el.id}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
        height: "100%",
        overflow: "visible",
        pointerEvents: "none",
        opacity,
      }}
    >
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="10"
          refY="5"
          markerWidth={headRatio}
          markerHeight={headRatio}
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={el.color} />
        </marker>
      </defs>
      <line
        x1={`${from.x}%`}
        y1={`${from.y}%`}
        x2={`${to.x}%`}
        y2={`${to.y}%`}
        stroke={el.color}
        strokeWidth={el.strokeWidth}
        strokeLinecap="butt"
        markerEnd={`url(#${markerId})`}
        filter={el.shadow !== false ? "drop-shadow(0 0.5px 2px rgba(0,0,0,0.8))" : undefined}
      />
      {selected && (
        <line
          x1={`${from.x}%`}
          y1={`${from.y}%`}
          x2={`${to.x}%`}
          y2={`${to.y}%`}
          stroke="rgba(59,130,246,0.8)"
          strokeWidth={el.strokeWidth + 3}
          strokeLinecap="round"
          strokeDasharray="4 3"
          fill="none"
        />
      )}
    </svg>
  );
}

// ---- Text ------------------------------------------------------------------

function TextView({
  el,
  selected,
  opacity,
  rect,
}: {
  el: TextElement;
  selected: boolean;
  opacity: number;
  rect: Rect;
}) {
  const editingId = useEditorStore((s) => s.editingElementId);
  const slideId = useEditorStore((s) => s.selection.slideId);
  const isEditing = editingId === el.id;
  const ref = useRef<HTMLDivElement | null>(null);

  // When entering edit mode, focus + select-all so the user can just type.
  useEffect(() => {
    if (!isEditing || !ref.current) return;
    const node = ref.current;
    node.focus();
    const range = document.createRange();
    range.selectNodeContents(node);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, [isEditing]);

  function commit() {
    const store = useEditorStore.getState();
    const text = ref.current?.innerText ?? "";
    if (slideId) {
      store.updateElement(slideId, el.id, { text } as Partial<TextElement>);
    }
    store.stopEditing();
  }

  return (
    <div
      ref={ref}
      data-element-id={el.id}
      contentEditable={isEditing}
      suppressContentEditableWarning
      onPointerDown={(e) => {
        if (isEditing) e.stopPropagation();
      }}
      onBlur={() => {
        if (isEditing) commit();
      }}
      onKeyDown={(e) => {
        if (!isEditing) return;
        if (e.key === "Escape") {
          e.preventDefault();
          commit();
        }
      }}
      style={{
        ...rectStyle(rect),
        display: "flex",
        alignItems: "center",
        justifyContent:
          el.align === "left" ? "flex-start" : el.align === "right" ? "flex-end" : "center",
        fontSize: `${el.fontSize * 1.67}cqw`,
        fontWeight: el.fontWeight === "bold" ? 700 : el.fontWeight === "semibold" ? 600 : 400,
        textAlign: el.align,
        outline: isEditing
          ? "2px solid rgba(59,130,246,0.9)"
          : selected
            ? "1px dashed rgba(59,130,246,0.9)"
            : undefined,
        outlineOffset: "2px",
        opacity,
        overflow: "hidden",
        pointerEvents: isEditing ? "auto" : "none",
        cursor: isEditing ? "text" : undefined,
        userSelect: isEditing ? "text" : "none",
      }}
    >
      <span
        style={{
          color: el.color,
          backgroundColor: el.background ?? "transparent",
          padding: el.background ? "0.4cqw 0.8cqw" : undefined,
          borderRadius: el.background ? "0.4cqw" : undefined,
          textShadow:
            el.shadow !== false && !el.background
              ? "0 0.1cqw 0.3cqw rgba(0,0,0,0.8), 0 0 0.8cqw rgba(0,0,0,0.5)"
              : undefined,
          whiteSpace: "pre-wrap",
        }}
      >
        {isEditing ? el.text : el.text || <span style={{ opacity: 0.4 }}>Text</span>}
      </span>
    </div>
  );
}

// ---- SVG -------------------------------------------------------------------

function SvgView({
  el,
  selected,
  opacity,
  rect,
}: {
  el: SvgElement;
  selected: boolean;
  opacity: number;
  rect: Rect;
}) {
  return (
    <div
      data-element-id={el.id}
      style={{
        ...rectStyle(rect),
        outline: selected ? "1px dashed rgba(59,130,246,0.9)" : undefined,
        outlineOffset: "2px",
        opacity,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={el.svgUrl}
        alt=""
        style={{ width: "100%", height: "100%", display: "block" }}
        draggable={false}
      />
    </div>
  );
}

// ---- Image (stamp) ---------------------------------------------------------

function ImageView({
  el,
  selected,
  opacity,
  rect,
}: {
  el: ImageElement;
  selected: boolean;
  opacity: number;
  rect: Rect;
}) {
  return (
    <div
      data-element-id={el.id}
      style={{
        ...rectStyle(rect),
        outline: selected ? "1px dashed rgba(59,130,246,0.9)" : undefined,
        outlineOffset: "2px",
        opacity,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={el.imageUrl}
        alt=""
        style={{
          width: "100%",
          height: "100%",
          objectFit: "fill",
          display: "block",
        }}
        draggable={false}
      />
    </div>
  );
}
