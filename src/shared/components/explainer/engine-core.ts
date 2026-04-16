// Pure interpolation engine for ExplainerSequence playback.
// Used by both the React player hook (use-explainer-engine.ts) and the
// canvas-based video exporter (export-engine.ts). Keep this file free of
// React or DOM dependencies so it stays testable and portable.

import type {
  ExplainerSequence,
  Segment,
  Transform,
  HighlightRegion,
  ArrowPointer,
  TextOverlay,
  SvgOverlayElement,
  Keyframe,
} from "@/shared/types/explainer";

// ---- Public types -----------------------------------------------------------

export interface EngineState {
  currentSegment: Segment | null;
  incomingSegment: Segment | null;
  interpolatedTransform: Transform;
  activeHighlights: HighlightRegion[];
  activeArrows: ArrowPointer[];
  activeTextOverlays: TextOverlay[];
  activeSvgOverlays: SvgOverlayElement[];
  transitionOpacity: number;
  incomingOpacity: number;
}

export const DEFAULT_TRANSFORM: Transform = { x: 0, y: 0, scale: 1 };

// ---- Math helpers -----------------------------------------------------------

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Smoothstep easing (ease-in-out cubic). Applied to all keyframe interpolation. */
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerpTransform(a: Transform, b: Transform, t: number): Transform {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    scale: lerp(a.scale, b.scale, t),
  };
}

// ---- Keyframe pair finder ---------------------------------------------------

function findKeyframePair(
  keyframes: Keyframe[],
  elapsed: number
): { kf1: Keyframe; kf2: Keyframe; t: number } {
  const empty: Keyframe = {
    time: 0,
    transform: DEFAULT_TRANSFORM,
    highlights: [],
    arrows: [],
    textOverlays: [],
  };

  if (keyframes.length === 0) return { kf1: empty, kf2: empty, t: 0 };
  if (keyframes.length === 1) return { kf1: keyframes[0], kf2: keyframes[0], t: 0 };
  if (elapsed >= keyframes[keyframes.length - 1].time) {
    const last = keyframes[keyframes.length - 1];
    return { kf1: last, kf2: last, t: 0 };
  }
  if (elapsed <= keyframes[0].time) return { kf1: keyframes[0], kf2: keyframes[0], t: 0 };

  for (let i = 0; i < keyframes.length - 1; i++) {
    const kf1 = keyframes[i];
    const kf2 = keyframes[i + 1];
    if (elapsed >= kf1.time && elapsed <= kf2.time) {
      const span = kf2.time - kf1.time;
      const t = span > 0 ? smoothstep((elapsed - kf1.time) / span) : 0;
      return { kf1, kf2, t };
    }
  }

  const last = keyframes[keyframes.length - 1];
  return { kf1: last, kf2: last, t: 0 };
}

// ---- Overlay interpolation --------------------------------------------------

function lerpHighlight(a: HighlightRegion, b: HighlightRegion, t: number): HighlightRegion {
  return {
    ...b,
    position: {
      x: lerp(a.position.x, b.position.x, t),
      y: lerp(a.position.y, b.position.y, t),
    },
    size: {
      width: lerp(a.size.width, b.size.width, t),
      height: lerp(a.size.height, b.size.height, t),
    },
    opacity: lerp(a.opacity, b.opacity, t),
    borderWidth: lerp(a.borderWidth, b.borderWidth, t),
  };
}

function interpolateHighlights(kf1: Keyframe, kf2: Keyframe, t: number): HighlightRegion[] {
  const kf1Map = new Map(kf1.highlights.map((h) => [h.id, h]));
  const result: HighlightRegion[] = [];
  for (const h2 of kf2.highlights) {
    const h1 = kf1Map.get(h2.id);
    result.push(h1 ? lerpHighlight(h1, h2, t) : { ...h2, opacity: h2.opacity * t });
  }
  for (const h1 of kf1.highlights) {
    if (!kf2.highlights.find((h) => h.id === h1.id)) {
      result.push({ ...h1, opacity: h1.opacity * (1 - t) });
    }
  }
  return result;
}

function lerpArrow(a: ArrowPointer, b: ArrowPointer, t: number): ArrowPointer {
  return {
    ...b,
    startPosition: {
      x: lerp(a.startPosition.x, b.startPosition.x, t),
      y: lerp(a.startPosition.y, b.startPosition.y, t),
    },
    endPosition: {
      x: lerp(a.endPosition.x, b.endPosition.x, t),
      y: lerp(a.endPosition.y, b.endPosition.y, t),
    },
    opacity: lerp(a.opacity, b.opacity, t),
    strokeWidth: lerp(a.strokeWidth, b.strokeWidth, t),
  };
}

function interpolateArrows(kf1: Keyframe, kf2: Keyframe, t: number): ArrowPointer[] {
  const kf1Map = new Map(kf1.arrows.map((a) => [a.id, a]));
  const result: ArrowPointer[] = [];
  for (const a2 of kf2.arrows) {
    const a1 = kf1Map.get(a2.id);
    result.push(a1 ? lerpArrow(a1, a2, t) : { ...a2, opacity: a2.opacity * t });
  }
  for (const a1 of kf1.arrows) {
    if (!kf2.arrows.find((a) => a.id === a1.id)) {
      result.push({ ...a1, opacity: a1.opacity * (1 - t) });
    }
  }
  return result;
}

function interpolateTextOverlays(kf1: Keyframe, kf2: Keyframe, t: number): TextOverlay[] {
  const kf1Map = new Map(kf1.textOverlays.map((o) => [o.id, o]));
  const result: TextOverlay[] = [];
  for (const o2 of kf2.textOverlays) {
    const o1 = kf1Map.get(o2.id);
    result.push({
      ...o2,
      computedOpacity: o1
        ? lerp(o1.computedOpacity ?? 1, o2.computedOpacity ?? 1, t)
        : lerp(0, o2.computedOpacity ?? 1, t),
    });
  }
  for (const o1 of kf1.textOverlays) {
    if (!kf2.textOverlays.find((o) => o.id === o1.id)) {
      result.push({ ...o1, computedOpacity: lerp(o1.computedOpacity ?? 1, 0, t) });
    }
  }
  return result;
}

function lerpSvgOverlay(a: SvgOverlayElement, b: SvgOverlayElement, t: number): SvgOverlayElement {
  return {
    ...b,
    position: {
      x: lerp(a.position.x, b.position.x, t),
      y: lerp(a.position.y, b.position.y, t),
    },
    size: {
      width: lerp(a.size.width, b.size.width, t),
      height: lerp(a.size.height, b.size.height, t),
    },
    rotation: lerp(a.rotation, b.rotation, t),
    computedOpacity: lerp(a.computedOpacity ?? a.opacity, b.computedOpacity ?? b.opacity, t),
  };
}

function interpolateSvgOverlays(kf1: Keyframe, kf2: Keyframe, t: number): SvgOverlayElement[] {
  const kf1Svgs = kf1.svgOverlays ?? [];
  const kf2Svgs = kf2.svgOverlays ?? [];
  const kf1Map = new Map(kf1Svgs.map((s) => [s.id, s]));
  const result: SvgOverlayElement[] = [];
  for (const s2 of kf2Svgs) {
    const s1 = kf1Map.get(s2.id);
    result.push(
      s1
        ? lerpSvgOverlay(s1, s2, t)
        : { ...s2, computedOpacity: lerp(0, s2.computedOpacity ?? s2.opacity, t) }
    );
  }
  for (const s1 of kf1Svgs) {
    if (!kf2Svgs.find((s) => s.id === s1.id)) {
      result.push({ ...s1, computedOpacity: lerp(s1.computedOpacity ?? s1.opacity, 0, t) });
    }
  }
  return result;
}

// ---- Main computation -------------------------------------------------------

/**
 * Compute the full engine state for a given sequence and time. Pure function —
 * no side effects, no React, no DOM. Both the player hook and the video
 * exporter call this.
 */
export function computeEngineState(sequence: ExplainerSequence, currentTime: number): EngineState {
  const { segments } = sequence;

  if (segments.length === 0) {
    return {
      currentSegment: null,
      incomingSegment: null,
      interpolatedTransform: DEFAULT_TRANSFORM,
      activeHighlights: [],
      activeArrows: [],
      activeTextOverlays: [],
      activeSvgOverlays: [],
      transitionOpacity: 1,
      incomingOpacity: 0,
    };
  }

  // Find current segment (< for endTime so next segment takes over at boundary,
  // except last segment which uses <=).
  let currentSegment: Segment | null = null;
  let currentIndex = -1;
  for (let i = 0; i < segments.length; i++) {
    const isLast = i === segments.length - 1;
    const inRange = isLast
      ? currentTime >= segments[i].startTime && currentTime <= segments[i].endTime
      : currentTime >= segments[i].startTime && currentTime < segments[i].endTime;
    if (inRange) {
      currentSegment = segments[i];
      currentIndex = i;
      break;
    }
  }

  // Past all segments → use last.
  if (!currentSegment && currentTime >= (segments[segments.length - 1]?.endTime ?? 0)) {
    currentSegment = segments[segments.length - 1];
    currentIndex = segments.length - 1;
  }
  // Before all segments → use first.
  if (!currentSegment) {
    currentSegment = segments[0];
    currentIndex = 0;
  }

  // ---- Transition state -----------------------------------------------------

  let incomingSegment: Segment | null = null;
  let transitionOpacity = 1;
  let incomingOpacity = 0;

  if (currentSegment && currentIndex < segments.length - 1) {
    const transitionStart = currentSegment.endTime - currentSegment.transitionDuration;

    if (currentTime >= transitionStart && currentTime < currentSegment.endTime) {
      const progress = Math.max(
        0,
        Math.min(1, (currentTime - transitionStart) / currentSegment.transitionDuration)
      );

      switch (currentSegment.transition) {
        case "crossfade":
          // Incoming image fades in on top of current (no fade-out).
          // Current stays at full opacity to prevent a dark moment.
          incomingSegment = segments[currentIndex + 1];
          transitionOpacity = 1;
          incomingOpacity = progress;
          break;

        case "fade-to-black":
          if (progress <= 0.5) {
            // First half: fade current image to black.
            transitionOpacity = 1 - progress * 2;
          } else {
            // Second half: fade incoming image in from black.
            transitionOpacity = 0;
            incomingSegment = segments[currentIndex + 1];
            incomingOpacity = (progress - 0.5) * 2;
          }
          break;

        // "cut" — do nothing; the segment switches at the exact boundary.
        // Default values (transitionOpacity=1, incomingOpacity=0) are correct.
      }
    }
  }

  // ---- Keyframe interpolation -----------------------------------------------

  const elapsed = currentTime - currentSegment.startTime;
  const { kf1, kf2, t } = findKeyframePair(currentSegment.keyframes, elapsed);

  return {
    currentSegment,
    incomingSegment,
    interpolatedTransform: lerpTransform(kf1.transform, kf2.transform, t),
    activeHighlights: interpolateHighlights(kf1, kf2, t),
    activeArrows: interpolateArrows(kf1, kf2, t).filter((a) => a.opacity > 0.01),
    activeTextOverlays: interpolateTextOverlays(kf1, kf2, t).filter(
      (o) => (o.computedOpacity ?? 1) > 0.01
    ),
    activeSvgOverlays: interpolateSvgOverlays(kf1, kf2, t).filter(
      (s) => (s.computedOpacity ?? s.opacity) > 0.01
    ),
    transitionOpacity,
    incomingOpacity,
  };
}
