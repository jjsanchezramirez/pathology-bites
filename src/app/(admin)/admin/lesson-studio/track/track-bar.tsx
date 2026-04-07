// One element's timing bar. Drag middle = shift start; drag edges = resize;
// drag fade-wedge corners = adjust fadeIn / fadeOut.

"use client";

import { useCallback, useRef } from "react";
import type { SlideElement, Timing } from "../model/types";
import { useEditorStore } from "../model/store";
import { snapToFrame, secsToTimecode } from "../utils/math";

type Mode = "move" | "resize-left" | "resize-right" | "fade-in" | "fade-out";

interface TrackBarProps {
  element: SlideElement;
  slideId: string;
  slideDuration: number;
  selected: boolean;
  /** px width of the track body (for converting pointer dx to seconds). */
  widthPx: number;
  /** Called when the user starts a vertical-drag-to-reorder on this bar. */
  onReorderStart?: (elementId: string, pointerY: number) => void;
}

const EDGE_PX = 6;
const MIN_FADE = 0;
const MIN_HOLD = 0;

function kindColor(kind: SlideElement["kind"]): { bg: string; fade: string } {
  switch (kind) {
    case "spotlight":
      return { bg: "rgb(234,179,8)", fade: "rgba(234,179,8,0.4)" };
    case "arrow":
      return { bg: "rgb(234,88,12)", fade: "rgba(234,88,12,0.4)" };
    case "text":
      return { bg: "rgb(37,99,235)", fade: "rgba(37,99,235,0.4)" };
    case "svg":
    case "image":
      return { bg: "rgb(147,51,234)", fade: "rgba(147,51,234,0.4)" };
    case "zoom":
    case "pan":
      return { bg: "rgb(20,184,166)", fade: "rgba(20,184,166,0.4)" };
    default:
      return { bg: "rgb(220,38,38)", fade: "rgba(220,38,38,0.4)" };
  }
}

export function TrackBar({
  element,
  slideId,
  slideDuration,
  selected,
  widthPx,
  onReorderStart,
}: TrackBarProps) {
  const t = element.timing;
  const total = t.fadeIn + t.hold + t.fadeOut;
  const pctPerSec = 100 / slideDuration;
  const color = kindColor(element.kind);

  const modeRef = useRef<Mode | null>(null);
  const originRef = useRef<{ timing: Timing; pointerX: number; pointerY: number } | null>(null);
  const candidateReorderRef = useRef(false);

  const pxToSec = widthPx > 0 ? slideDuration / widthPx : 0;

  const onPointerDown = useCallback(
    (mode: Mode) => (e: React.PointerEvent) => {
      e.stopPropagation();
      modeRef.current = mode;
      originRef.current = { timing: { ...t }, pointerX: e.clientX, pointerY: e.clientY };
      candidateReorderRef.current = mode === "move" && !!onReorderStart;
      const store = useEditorStore.getState();
      store.beginDrag();
      store.selectElements(slideId, [element.id]);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [t, slideId, element.id, onReorderStart]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const mode = modeRef.current;
      const origin = originRef.current;
      if (!mode || !origin) return;
      // Decide whether this "move" drag is a retime (horizontal) or a
      // reorder (vertical). Reorder needs strong vertical dominance (>8px
      // AND more than 2× the horizontal travel); horizontal commits as
      // soon as there's any real pointer movement. Once committed we
      // never switch, so a mid-drag wobble can't rubber-band the bar.
      if (candidateReorderRef.current) {
        const dy = e.clientY - origin.pointerY;
        const dx = e.clientX - origin.pointerX;
        if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx) * 2) {
          candidateReorderRef.current = false;
          modeRef.current = null;
          (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
          useEditorStore.getState().endDrag();
          onReorderStart?.(element.id, e.clientY);
          return;
        }
        if (Math.abs(dx) > 2) {
          candidateReorderRef.current = false;
          // Horizontal wins — fall through to timing update.
        } else {
          return; // still in dead zone
        }
      }
      const dxSec = (e.clientX - origin.pointerX) * pxToSec;
      const o = origin.timing;
      let next: Timing;
      switch (mode) {
        case "move": {
          const maxStart = Math.max(0, slideDuration - (o.fadeIn + o.hold + o.fadeOut));
          next = { ...o, start: Math.max(0, Math.min(maxStart, o.start + dxSec)) };
          break;
        }
        case "resize-left": {
          // keep end fixed; shrink start + hold
          const end = o.start + o.fadeIn + o.hold + o.fadeOut;
          const newStart = Math.max(
            0,
            Math.min(end - o.fadeIn - o.fadeOut - MIN_HOLD, o.start + dxSec)
          );
          next = {
            ...o,
            start: newStart,
            hold: Math.max(MIN_HOLD, end - newStart - o.fadeIn - o.fadeOut),
          };
          break;
        }
        case "resize-right": {
          // keep start fixed; change hold
          const newHold = Math.max(MIN_HOLD, o.hold + dxSec);
          const maxHold = Math.max(MIN_HOLD, slideDuration - o.start - o.fadeIn - o.fadeOut);
          next = { ...o, hold: Math.min(newHold, maxHold) };
          break;
        }
        case "fade-in": {
          // increase/decrease fadeIn, absorbed by hold (keep end fixed, keep start fixed)
          const desired = Math.max(MIN_FADE, o.fadeIn + dxSec);
          const maxFadeIn = Math.max(MIN_FADE, o.fadeIn + o.hold - MIN_HOLD);
          const newFadeIn = Math.min(desired, maxFadeIn);
          const delta = newFadeIn - o.fadeIn;
          next = { ...o, fadeIn: newFadeIn, hold: Math.max(MIN_HOLD, o.hold - delta) };
          break;
        }
        case "fade-out": {
          // increase/decrease fadeOut, absorbed by hold
          const desired = Math.max(MIN_FADE, o.fadeOut - dxSec);
          const maxFadeOut = Math.max(MIN_FADE, o.fadeOut + o.hold - MIN_HOLD);
          const newFadeOut = Math.min(desired, maxFadeOut);
          const delta = newFadeOut - o.fadeOut;
          next = { ...o, fadeOut: newFadeOut, hold: Math.max(MIN_HOLD, o.hold - delta) };
          break;
        }
      }
      useEditorStore.getState().updateElement(slideId, element.id, {
        timing: next,
      } as Partial<SlideElement>);
    },
    [pxToSec, slideDuration, slideId, element.id, onReorderStart]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!modeRef.current) return;
      modeRef.current = null;
      originRef.current = null;
      candidateReorderRef.current = false;
      // Snap timing to the frame grid before closing the drag session so
      // the snap is part of the same undo entry as the drag itself.
      const store = useEditorStore.getState();
      const el = store.lesson.slides
        .find((s) => s.id === slideId)
        ?.elements.find((x) => x.id === element.id);
      if (el) {
        const cur = el.timing;
        const snapped: Timing = {
          start: snapToFrame(cur.start),
          fadeIn: snapToFrame(cur.fadeIn),
          hold: snapToFrame(cur.hold),
          fadeOut: snapToFrame(cur.fadeOut),
        };
        if (
          snapped.start !== cur.start ||
          snapped.fadeIn !== cur.fadeIn ||
          snapped.hold !== cur.hold ||
          snapped.fadeOut !== cur.fadeOut
        ) {
          store.updateElement(slideId, element.id, { timing: snapped } as Partial<SlideElement>);
        }
      }
      store.endDrag();
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    },
    [slideId, element.id]
  );

  // Bar geometry
  const leftPct = t.start * pctPerSec;
  const totalPct = total * pctPerSec;
  const fadeInPct = t.fadeIn * pctPerSec;
  const fadeOutPct = t.fadeOut * pctPerSec;
  // Positions relative to the bar (0..100% of total span)
  const fadeInEndRel = total > 0 ? (t.fadeIn / total) * 100 : 0;
  const fadeOutStartRel = total > 0 ? ((t.fadeIn + t.hold) / total) * 100 : 100;

  return (
    <div
      style={{
        position: "absolute",
        left: `${leftPct}%`,
        width: `${totalPct}%`,
        top: 2,
        bottom: 2,
        display: totalPct > 0 ? "block" : "none",
      }}
    >
      {/* Body */}
      <div
        onPointerDown={onPointerDown("move")}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="absolute inset-0 cursor-grab rounded-sm"
        style={{
          background: `linear-gradient(90deg, ${color.fade} 0%, ${color.bg} ${fadeInEndRel}%, ${color.bg} ${fadeOutStartRel}%, ${color.fade} 100%)`,
          outline: selected ? "2px solid rgba(59,130,246,0.9)" : "1px solid rgba(0,0,0,0.2)",
          outlineOffset: selected ? 0 : 0,
        }}
      />
      {/* Left edge handle */}
      <div
        onPointerDown={onPointerDown("resize-left")}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: EDGE_PX,
          cursor: "ew-resize",
        }}
      />
      {/* Right edge handle */}
      <div
        onPointerDown={onPointerDown("resize-right")}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: EDGE_PX,
          cursor: "ew-resize",
        }}
      />
      {/* Fade-in marker */}
      {fadeInPct > 1 && (
        <div
          onPointerDown={onPointerDown("fade-in")}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            position: "absolute",
            left: `${fadeInEndRel}%`,
            top: -2,
            bottom: -2,
            width: 8,
            marginLeft: -4,
            cursor: "ew-resize",
          }}
          title="Fade in"
        >
          <div className="mx-auto h-full w-0.5 bg-white/60" />
        </div>
      )}
      {/* Fade-out marker */}
      {fadeOutPct > 1 && (
        <div
          onPointerDown={onPointerDown("fade-out")}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            position: "absolute",
            left: `${fadeOutStartRel}%`,
            top: -2,
            bottom: -2,
            width: 8,
            marginLeft: -4,
            cursor: "ew-resize",
          }}
          title="Fade out"
        >
          <div className="mx-auto h-full w-0.5 bg-white/60" />
        </div>
      )}
      {/* Waypoint markers */}
      {getWaypointTimes(element).map((wpTime, i) => {
        if (total <= 0) return null;
        const pct = Math.max(0, Math.min(100, (wpTime / total) * 100));
        return (
          <div
            key={`wp-${i}`}
            className="pointer-events-none absolute"
            style={{
              left: `${pct}%`,
              top: "50%",
              width: 8,
              height: 8,
              marginLeft: -4,
              marginTop: -4,
              background: "#fff",
              border: "1px solid rgba(0,0,0,0.6)",
              transform: "rotate(45deg)",
              zIndex: 2,
            }}
            title={`waypoint @ ${secsToTimecode(wpTime)}`}
          />
        );
      })}
      {/* Label */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-2 text-[10px] font-medium text-white drop-shadow truncate">
        {labelFor(element)}
      </div>
    </div>
  );
}

function getWaypointTimes(el: SlideElement): number[] {
  const wps = (el as { waypoints?: { time: number }[] }).waypoints;
  if (!wps || wps.length < 2) return [];
  return wps.map((w) => w.time);
}

function labelFor(el: SlideElement): string {
  switch (el.kind) {
    case "shape":
      return el.shape;
    case "spotlight":
      return "spotlight";
    case "arrow":
      return "arrow";
    case "text":
      return el.text ? `"${el.text.slice(0, 20)}"` : "text";
    case "svg":
      return el.svgName ?? "svg";
    case "image":
      return "image";
    case "zoom":
      return `zoom ${el.to.scale}×`;
    case "pan":
      return "pan";
  }
}
