// Draws 8 resize handles + 1 rotation handle around a (possibly rotated) rect.
// Pure presentation — the canvas root handles pointer events via data attrs.
//
// Handles are positioned in canvas-percent space. Rotation math goes through
// geometry.rotate() which accounts for the 16:9 aspect so handles track the
// visually-rotated element.

"use client";

import type { Rect } from "../model/types";
import { computeHandles, type HandleId } from "./geometry";

export interface SelectionHandlesProps {
  rect: Rect;
}

const HANDLE_PX = 10;
const ROTATE_PX = 12;

export function SelectionHandles({ rect }: SelectionHandlesProps) {
  // Rotation-handle offset: 4% of canvas-vertical (matches how it reads in 16:9).
  const handles = computeHandles(rect, 4);
  // 4 rotated corners (in percent) for the dashed bounding box.
  const corners = computeCorners(rect);
  return (
    <>
      {/* Dashed bounding polygon (rotation-aware, drawn in percent SVG). */}
      <svg
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          overflow: "visible",
        }}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <polygon
          points={corners.map((c) => `${c.x},${c.y}`).join(" ")}
          fill="none"
          stroke="rgba(59,130,246,0.9)"
          strokeWidth={0.25}
          strokeDasharray="1 0.75"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {handles.map((h) => {
        const isRotate = h.id === "rotate";
        const size = isRotate ? ROTATE_PX : HANDLE_PX;
        return (
          <div
            key={h.id}
            data-handle-id={h.id}
            style={{
              position: "absolute",
              left: `${h.pos.x}%`,
              top: `${h.pos.y}%`,
              width: `${size}px`,
              height: `${size}px`,
              transform: "translate(-50%, -50%)",
              background: isRotate ? "rgb(59,130,246)" : "#fff",
              border: "2px solid rgb(59,130,246)",
              borderRadius: isRotate ? "50%" : "2px",
              cursor: cursorFor(h.id, rect.rotation),
              pointerEvents: "auto",
              boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
              zIndex: 100,
            }}
          />
        );
      })}
    </>
  );
}

function computeCorners(rect: Rect): Array<{ x: number; y: number }> {
  // Use computeHandles and extract the 4 corners.
  const hs = computeHandles(rect, 0);
  const byId: Record<string, { x: number; y: number }> = {};
  for (const h of hs) byId[h.id] = h.pos;
  return [byId.nw, byId.ne, byId.se, byId.sw];
}

// ---- Cursor mapping --------------------------------------------------------

function cursorFor(id: HandleId, rotationDeg: number): string {
  if (id === "rotate") return "crosshair";
  const baseAngle: Record<HandleId, number> = {
    n: 0,
    ne: 45,
    e: 90,
    se: 135,
    s: 180,
    sw: 225,
    w: 270,
    nw: 315,
    rotate: 0,
  };
  const a = (((baseAngle[id] + rotationDeg) % 360) + 360) % 360;
  if (a < 22.5 || a >= 337.5) return "ns-resize";
  if (a < 67.5) return "nesw-resize";
  if (a < 112.5) return "ew-resize";
  if (a < 157.5) return "nwse-resize";
  if (a < 202.5) return "ns-resize";
  if (a < 247.5) return "nesw-resize";
  if (a < 292.5) return "ew-resize";
  return "nwse-resize";
}
