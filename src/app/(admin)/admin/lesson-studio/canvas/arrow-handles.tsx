// Endpoint handles for arrows — only two handles (tail and head).

"use client";

import type { ArrowElement } from "../model/types";
import { arrowPointsAt } from "../model/runtime";

export interface ArrowHandlesProps {
  arrow: ArrowElement;
  viewTime: number;
}

const HANDLE_PX = 10;

export function ArrowHandles({ arrow, viewTime }: ArrowHandlesProps) {
  const pts = arrowPointsAt(arrow, viewTime);
  return (
    <>
      <EndpointHandle id="arrow-from" x={pts.from.x} y={pts.from.y} />
      <EndpointHandle id="arrow-to" x={pts.to.x} y={pts.to.y} />
    </>
  );
}

function EndpointHandle({ id, x, y }: { id: "arrow-from" | "arrow-to"; x: number; y: number }) {
  return (
    <div
      data-handle-id={id}
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        width: `${HANDLE_PX}px`,
        height: `${HANDLE_PX}px`,
        transform: "translate(-50%, -50%)",
        background: "#fff",
        border: "2px solid rgb(59,130,246)",
        borderRadius: "50%",
        cursor: "move",
        pointerEvents: "auto",
        boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
        zIndex: 100,
      }}
    />
  );
}
