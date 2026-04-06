// Waypoint editor for spatially-animatable elements.
// Users build motion by snapshotting the element's current pose (at the current
// playhead) as a waypoint at a given local time. With 2+ waypoints, the runtime
// interpolates linearly between them.

"use client";

import type { SlideElement, Waypoint, ArrowWaypoint, ArrowElement, Rect } from "../model/types";
import { useEditorStore } from "../model/store";
import { rectAt, arrowPointsAt } from "../model/runtime";
import { Section, Row, NumberInput } from "./inputs";
import { clamp } from "../utils/math";

interface Props {
  element: SlideElement;
  slideId: string;
}

export function WaypointsSection({ element, slideId }: Props) {
  const viewTime = useEditorStore((s) => s.viewTime);
  // Maximum sensible waypoint time = element's visible span.
  const t = element.timing;
  const maxLocal = Math.max(0, t.fadeIn + t.hold + t.fadeOut);

  const isArrow = element.kind === "arrow";
  if (
    element.kind !== "shape" &&
    element.kind !== "spotlight" &&
    element.kind !== "text" &&
    element.kind !== "svg" &&
    element.kind !== "image" &&
    element.kind !== "arrow"
  ) {
    return null;
  }

  const waypoints = (element as { waypoints?: Waypoint[] | ArrowWaypoint[] }).waypoints ?? [];

  const localNow = clamp(viewTime - t.start, 0, maxLocal);

  function update(patch: { waypoints: Waypoint[] | ArrowWaypoint[] | undefined }) {
    useEditorStore.getState().updateElement(slideId, element.id, patch as Partial<SlideElement>);
  }

  function addAtPlayhead() {
    if (isArrow) {
      const arrow = element as ArrowElement;
      const pts = arrowPointsAt(arrow, viewTime);
      const wp: ArrowWaypoint = { time: localNow, from: { ...pts.from }, to: { ...pts.to } };
      const next = [...(waypoints as ArrowWaypoint[]), wp].sort((a, b) => a.time - b.time);
      update({ waypoints: next });
    } else {
      const r: Rect = rectAt(element, viewTime) ?? (element as { rect: Rect }).rect;
      const wp: Waypoint = { time: localNow, rect: { ...r } };
      const next = [...(waypoints as Waypoint[]), wp].sort((a, b) => a.time - b.time);
      update({ waypoints: next });
    }
  }

  function removeAt(index: number) {
    const next = waypoints.filter((_, i) => i !== index);
    update({ waypoints: next.length === 0 ? undefined : (next as Waypoint[] | ArrowWaypoint[]) });
  }

  function setTimeAt(index: number, newTime: number) {
    const clamped = clamp(newTime, 0, maxLocal);
    const next = waypoints
      .map((w, i) => (i === index ? { ...w, time: clamped } : w))
      .sort((a, b) => a.time - b.time);
    update({ waypoints: next as Waypoint[] | ArrowWaypoint[] });
  }

  function snapshotAt(index: number) {
    if (isArrow) {
      const pts = arrowPointsAt(element as ArrowElement, viewTime);
      const next = (waypoints as ArrowWaypoint[]).map((w, i) =>
        i === index ? { ...w, from: { ...pts.from }, to: { ...pts.to } } : w
      );
      update({ waypoints: next });
    } else {
      const r = rectAt(element, viewTime) ?? (element as { rect: Rect }).rect;
      const next = (waypoints as Waypoint[]).map((w, i) =>
        i === index ? { ...w, rect: { ...r } } : w
      );
      update({ waypoints: next });
    }
  }

  return (
    <Section title={`Waypoints (${waypoints.length})`}>
      <div className="text-[10px] text-muted-foreground">
        Playhead at {viewTime.toFixed(2)}s &middot; local {localNow.toFixed(2)}s
      </div>
      <button
        type="button"
        onClick={addAtPlayhead}
        className="h-7 rounded border bg-white px-2 text-[11px] font-medium hover:border-blue-500"
      >
        + Add waypoint at playhead
      </button>
      {waypoints.length >= 1 && waypoints.length < 2 && (
        <div className="text-[10px] text-amber-700">Need at least 2 waypoints for animation.</div>
      )}
      {waypoints.map((wp, i) => (
        <div
          key={i}
          className="flex items-center gap-1 rounded border bg-gray-50 px-1.5 py-1 text-[10px]"
        >
          <span className="w-5 text-gray-500">#{i}</span>
          <div className="flex-1">
            <Row label="t">
              <NumberInput
                value={wp.time}
                step={0.1}
                min={0}
                max={maxLocal}
                suffix="s"
                onChange={(v) => setTimeAt(i, v)}
              />
            </Row>
          </div>
          <button
            type="button"
            title="Overwrite with canvas pose at playhead"
            onClick={() => snapshotAt(i)}
            className="rounded border bg-white px-1.5 text-[10px] hover:border-blue-500"
          >
            Use canvas
          </button>
          <button
            type="button"
            title="Delete waypoint"
            onClick={() => removeAt(i)}
            className="rounded border bg-white px-1.5 text-[10px] text-red-600 hover:border-red-500"
          >
            ×
          </button>
        </div>
      ))}
      {/* Quick preview for scalars on the selected waypoint */}
      {!isArrow && waypoints.length > 0 && (
        <WaypointRectPreview waypoints={waypoints as Waypoint[]} />
      )}
    </Section>
  );
}

function WaypointRectPreview({ waypoints }: { waypoints: Waypoint[] }) {
  const first = waypoints[0];
  const last = waypoints[waypoints.length - 1];
  return (
    <div className="text-[10px] text-gray-500">
      {first === last
        ? `@ (${first.rect.x.toFixed(0)}, ${first.rect.y.toFixed(0)})`
        : `(${first.rect.x.toFixed(0)},${first.rect.y.toFixed(0)}) → (${last.rect.x.toFixed(0)},${last.rect.y.toFixed(0)})`}
    </div>
  );
}
