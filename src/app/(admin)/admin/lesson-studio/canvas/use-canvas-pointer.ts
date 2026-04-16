// Central pointer handler for the editor canvas.
// Routes pointerdown events to one of five drag sessions based on hit target:
//   1. resize handle   -> resizeRect
//   2. rotate handle   -> applyRotation
//   3. arrow endpoint  -> move from/to point
//   4. element body    -> move element (translate)
//   5. empty + tool    -> create new element
// Pointer-up ends any session and commits a single history entry via endDrag().
//
// Auto-keyframing: if the clicked element has 2+ waypoints, the drag targets
// a single waypoint at the current viewTime (found by time match or created
// on the fly). If the element has 0–1 waypoints, the drag edits `el.rect`.

"use client";

import { useCallback, useRef } from "react";
import type { RefObject } from "react";
import type { Slide, SlideElement, ArrowElement, Waypoint, Rect } from "../model/types";
import { useEditorStore } from "../model/store";
import { hitElement, moveElement } from "./hit-testing";
import { resizeRect, applyRotation, type HandleId } from "./geometry";
import { createElementFromDrag } from "./element-factory";
import { rectAt } from "../model/runtime";
import { snapToFrame } from "../utils/math";
import { snapMoveDelta, snapResize, snapPoint, measureTextContent } from "./snap";

/** Identifies where a rect-edit should write back. */
type RectTarget = { kind: "rect" } | { kind: "waypoint"; index: number };

type Session =
  | { kind: "move"; elementId: string; origin: SlideElement }
  | {
      kind: "move-waypoint";
      elementId: string;
      targetIdx: number;
      originRect: Rect;
    }
  | {
      kind: "resize";
      elementId: string;
      handle: HandleId;
      originRect: Rect;
      target: RectTarget;
    }
  | {
      kind: "rotate";
      elementId: string;
      originRect: Rect;
      startPointer: { x: number; y: number };
      target: RectTarget;
    }
  | { kind: "arrow-endpoint"; elementId: string; which: "from" | "to"; origin: ArrowElement }
  | { kind: "create"; elementId: string; start: { x: number; y: number } }
  | null;

export interface UseCanvasPointerArgs {
  canvasRef: RefObject<HTMLElement | null>;
  slide: Slide | null;
  /** Active camera transform (player-space, -50..50). Used to inverse-transform pointer coords. */
  camera: { x: number; y: number; scale: number };
  /** Current playhead time, used to hit-test against interpolated (animated) positions. */
  viewTime: number;
}

const WAYPOINT_TIME_EPSILON = 0.05; // 50ms snap tolerance

/**
 * For a rect-bearing element, decide whether a spatial edit should target the
 * static `el.rect` or a specific waypoint. If the element has 2+ waypoints, we
 * match the current viewTime against existing waypoint times (snap within
 * ~50ms) or auto-create a new waypoint at viewTime whose starting pose is the
 * runtime-interpolated rect. Returns `null` for elements without a rect.
 */
function prepareRectTarget(
  el: SlideElement,
  viewTime: number,
  commitWaypoints: (wps: Waypoint[]) => void
): { target: RectTarget; originRect: Rect } | null {
  if (!("rect" in el)) return null;
  const wps = el.waypoints;
  // 0 or 1 waypoints: animation inactive, edit static rect. Keep existing
  // waypoint (if any) untouched — user can still scrub, it just won't animate.
  if (!wps || wps.length < 2) {
    return { target: { kind: "rect" }, originRect: el.rect };
  }
  const localT = snapToFrame(Math.max(0, viewTime - el.timing.start));
  const existingIdx = wps.findIndex((w) => Math.abs(w.time - localT) < WAYPOINT_TIME_EPSILON);
  if (existingIdx >= 0) {
    return {
      target: { kind: "waypoint", index: existingIdx },
      originRect: wps[existingIdx].rect,
    };
  }
  // No waypoint at viewTime — auto-create one with the current interpolated pose.
  const interpolated = rectAt(el, viewTime) ?? el.rect;
  const newWp: Waypoint = { time: localT, rect: { ...interpolated } };
  const next = [...wps, newWp].sort((a, b) => a.time - b.time);
  const newIdx = next.indexOf(newWp);
  commitWaypoints(next);
  return { target: { kind: "waypoint", index: newIdx }, originRect: newWp.rect };
}

/** Produce the patch needed to write `newRect` back to its target. */
function rectPatchFor(
  target: RectTarget,
  newRect: Rect,
  currentWaypoints: Waypoint[] | undefined
): Partial<SlideElement> {
  if (target.kind === "rect") {
    return { rect: newRect } as Partial<SlideElement>;
  }
  const wps = (currentWaypoints ?? []).slice();
  if (target.index < 0 || target.index >= wps.length) {
    return {} as Partial<SlideElement>;
  }
  wps[target.index] = { ...wps[target.index], rect: newRect };
  return { waypoints: wps } as Partial<SlideElement>;
}

/** True if a just-created element is smaller than the useful threshold. */
function isDegenerateCreate(el: SlideElement | undefined): boolean {
  if (!el) return true;
  if (el.kind === "arrow") return Math.hypot(el.to.x - el.from.x, el.to.y - el.from.y) < 2;
  if ("rect" in el) return el.rect.w < 1 || el.rect.h < 1;
  return false;
}

export function useCanvasPointer({ canvasRef, slide, camera, viewTime }: UseCanvasPointerArgs) {
  const sessionRef = useRef<Session>(null);
  const startPointerRef = useRef<{ x: number; y: number } | null>(null);

  /**
   * Convert clientX/clientY to content-space 0–100% coords (pre-camera).
   * Undoes the camera transform applied to the content layer.
   */
  const toCanvasPercent = useCallback(
    (clientX: number, clientY: number) => {
      const el = canvasRef.current;
      if (!el) return { x: 0, y: 0 };
      const rect = el.getBoundingClientRect();
      // Canvas-space (outer, pre-transform) percent.
      const canvasX = ((clientX - rect.left) / rect.width) * 100;
      const canvasY = ((clientY - rect.top) / rect.height) * 100;
      // Inverse of `translate(cx%, cy%) scale(s)` with origin center:
      //   canvas = 50 + (content - 50) * s + c   →   content = (canvas - 50 - c) / s + 50
      const s = camera.scale || 1;
      return {
        x: (canvasX - 50 - camera.x) / s + 50,
        y: (canvasY - 50 - camera.y) / s + 50,
      };
    },
    [canvasRef, camera.x, camera.y, camera.scale]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!slide) return;
      // Make sure no stray input (title, timecode field) keeps focus — the
      // global keyboard shortcuts bail when an editable field is focused,
      // which otherwise blocks arrow-key nudging of the selection.
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      const store = useEditorStore.getState();
      const pt = toCanvasPercent(e.clientX, e.clientY);
      startPointerRef.current = pt;

      // 1) Handle hit — read data-handle-id off nearest ancestor.
      const handleEl = (e.target as HTMLElement).closest<HTMLElement>("[data-handle-id]");
      if (handleEl) {
        const handleId = handleEl.dataset.handleId as HandleId | "arrow-from" | "arrow-to";
        const selectedId = store.selection.elementIds[0];
        if (!selectedId) return;
        const el = slide.elements.find((x) => x.id === selectedId);
        if (!el) return;

        if (handleId === "arrow-from" || handleId === "arrow-to") {
          if (el.kind !== "arrow") return;
          store.beginDrag();
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
          sessionRef.current = {
            kind: "arrow-endpoint",
            elementId: el.id,
            which: handleId === "arrow-from" ? "from" : "to",
            origin: el,
          };
          return;
        }

        const prepared = prepareRectTarget(el, viewTime, (wps) => {
          store.updateElement(slide.id, el.id, { waypoints: wps } as Partial<SlideElement>);
        });
        if (!prepared) return;
        store.beginDrag();
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        if (handleId === "rotate") {
          sessionRef.current = {
            kind: "rotate",
            elementId: el.id,
            originRect: prepared.originRect,
            startPointer: pt,
            target: prepared.target,
          };
        } else {
          sessionRef.current = {
            kind: "resize",
            elementId: el.id,
            handle: handleId as HandleId,
            originRect: prepared.originRect,
            target: prepared.target,
          };
        }
        return;
      }

      // 2) If a creation tool is active, start creating on empty canvas.
      if (store.tool !== "select") {
        const created = createElementFromDrag({
          tool: store.tool,
          start: pt,
          end: pt,
          slideDuration: slide.duration,
          imageCategory: slide.imageCategory,
        });
        if (created) {
          // Zoom/Pan are single-click placement (no drag sizing): commit + reset tool.
          if (created.kind === "camera") {
            store.addElement(slide.id, created);
            store.setTool("select");
            sessionRef.current = null;
            return;
          }
          store.beginDrag();
          store.addElement(slide.id, created);
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
          sessionRef.current = { kind: "create", elementId: created.id, start: pt };
          return;
        }
      }

      // 3) Element hit
      const hit = hitElement(slide.elements, pt, viewTime);
      if (hit) {
        const isSelected = store.selection.elementIds.includes(hit.id);
        if (e.shiftKey) {
          // Toggle this element in/out of the selection; don't start a drag.
          const next = isSelected
            ? store.selection.elementIds.filter((id) => id !== hit.id)
            : [...store.selection.elementIds, hit.id];
          store.selectElements(slide.id, next);
          sessionRef.current = null;
          return;
        }
        if (!isSelected) {
          store.selectElements(slide.id, [hit.id]);
        }
        store.beginDrag();
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        // For rect elements with 2+ waypoints, translate just the target
        // waypoint (auto-keyframed). Otherwise, use the generic moveElement
        // path (handles arrows + single-waypoint rects + plain rects).
        if ("rect" in hit && hit.waypoints && hit.waypoints.length >= 2) {
          const prepared = prepareRectTarget(hit, viewTime, (wps) => {
            store.updateElement(slide.id, hit.id, { waypoints: wps } as Partial<SlideElement>);
          });
          if (prepared && prepared.target.kind === "waypoint") {
            sessionRef.current = {
              kind: "move-waypoint",
              elementId: hit.id,
              targetIdx: prepared.target.index,
              originRect: prepared.originRect,
            };
            return;
          }
        }
        sessionRef.current = { kind: "move", elementId: hit.id, origin: hit };
        return;
      }

      // 4) Empty space → clear selection
      if (!e.shiftKey) store.clearSelection();
      sessionRef.current = null;
    },
    [slide, toCanvasPercent, viewTime]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const session = sessionRef.current;
      const start = startPointerRef.current;
      if (!session || !start || !slide) return;
      const pt = toCanvasPercent(e.clientX, e.clientY);
      const delta = { x: pt.x - start.x, y: pt.y - start.y };
      const store = useEditorStore.getState();
      const patch = (p: Partial<SlideElement>) =>
        store.updateElement(slide.id, session.elementId, p);

      switch (session.kind) {
        case "move": {
          // Snap the translation delta so the element's edges/centers pull
          // onto the canvas borders + center lines when close. For arrows
          // and camera ops (no rect), pass the raw delta through.
          const origin = session.origin;
          const snapped = "rect" in origin ? snapMoveDelta(origin.rect, delta) : delta;
          patch(moveElement(origin, snapped) as Partial<SlideElement>);
          return;
        }
        case "move-waypoint": {
          const el = slide.elements.find((x) => x.id === session.elementId);
          if (!el || !("rect" in el)) return;
          const snapped = snapMoveDelta(session.originRect, delta);
          const newRect: Rect = {
            ...session.originRect,
            x: session.originRect.x + snapped.x,
            y: session.originRect.y + snapped.y,
          };
          patch(
            rectPatchFor({ kind: "waypoint", index: session.targetIdx }, newRect, el.waypoints)
          );
          return;
        }
        case "resize": {
          const isCorner = ["nw", "ne", "se", "sw"].includes(session.handle);
          const raw = resizeRect(session.originRect, session.handle, delta, isCorner);
          const el = slide.elements.find((x) => x.id === session.elementId);
          if (!el || !("rect" in el)) return;
          const contentSize =
            el.kind === "text" ? measureTextContent(el.id, canvasRef.current) : null;
          const newRect = snapResize(raw, session.handle, contentSize);
          patch(rectPatchFor(session.target, newRect, el.waypoints));
          return;
        }
        case "rotate": {
          const newRect = applyRotation(session.originRect, session.startPointer, pt);
          const el = slide.elements.find((x) => x.id === session.elementId);
          if (!el || !("rect" in el)) return;
          patch(rectPatchFor(session.target, newRect, el.waypoints));
          return;
        }
        case "arrow-endpoint": {
          const arrow = session.origin;
          // Snap the moving endpoint to the canvas border / center grid.
          const raw =
            session.which === "from"
              ? { x: arrow.from.x + delta.x, y: arrow.from.y + delta.y }
              : { x: arrow.to.x + delta.x, y: arrow.to.y + delta.y };
          const snapped = snapPoint(raw);
          patch(
            (session.which === "from"
              ? { from: snapped }
              : { to: snapped }) as Partial<SlideElement>
          );
          return;
        }
        case "create": {
          const rebuilt = createElementFromDrag({
            tool: store.tool,
            start: session.start,
            end: pt,
            slideDuration: slide.duration,
            imageCategory: slide.imageCategory,
          });
          if (rebuilt) {
            // Preserve the generated id from pointerdown.
            patch({ ...rebuilt, id: session.elementId } as Partial<SlideElement>);
          }
          return;
        }
      }
    },
    [slide, toCanvasPercent, canvasRef]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const session = sessionRef.current;
      if (!session) return;
      const store = useEditorStore.getState();

      // If the create session produced something trivially small, drop it.
      if (session.kind === "create" && slide) {
        const el =
          slide.elements.find((x) => x.id === session.elementId) ??
          store.lesson.slides
            .find((s) => s.id === slide.id)
            ?.elements.find((x) => x.id === session.elementId);
        if (isDegenerateCreate(el)) {
          store.removeElement(slide.id, session.elementId);
        } else {
          store.selectElements(slide.id, [session.elementId]);
        }
        store.setTool("select");
      }

      store.endDrag();
      sessionRef.current = null;
      startPointerRef.current = null;
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    },
    [slide]
  );

  return { onPointerDown, onPointerMove, onPointerUp };
}
