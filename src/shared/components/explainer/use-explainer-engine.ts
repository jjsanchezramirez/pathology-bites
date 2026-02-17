"use client";

import { useMemo, useEffect, useRef } from "react";
import type {
  ExplainerSequence,
  Segment,
  Transform,
  HighlightRegion,
  ArrowPointer,
  TextOverlay,
  Keyframe,
} from "@/shared/types/explainer";

interface UseExplainerEngineOptions {
  sequence: ExplainerSequence;
  currentTime: number;
}

interface EngineState {
  currentSegment: Segment | null;
  incomingSegment: Segment | null;
  interpolatedTransform: Transform;
  activeHighlights: HighlightRegion[];
  activeArrows: ArrowPointer[];
  activeTextOverlays: TextOverlay[];
  transitionOpacity: number; // Current image opacity (always 1.0 for crossfades)
  incomingOpacity: number; // Incoming image opacity (0.0 → 1.0)
}

const DEFAULT_TRANSFORM: Transform = { x: 0, y: 0, scale: 1 };

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Smoothstep easing function (ease-in-out cubic)
 * Creates a smoother transition curve
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Ease-in-out quartic (even smoother than smoothstep)
 * Better for fade-in transitions
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function easeInOutQuart(t: number): number {
  return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
}

function lerpTransform(a: Transform, b: Transform, t: number): Transform {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    scale: lerp(a.scale, b.scale, t),
  };
}

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

/**
 * Find the keyframe pair that brackets the given elapsed time within a segment.
 * Returns [index, t] where t is the interpolation factor between keyframes[index] and keyframes[index+1].
 */
function findKeyframePair(
  keyframes: Keyframe[],
  elapsed: number
): { kf1: Keyframe; kf2: Keyframe; t: number } {
  if (keyframes.length === 0) {
    const empty: Keyframe = {
      time: 0,
      transform: DEFAULT_TRANSFORM,
      highlights: [],
      arrows: [],
      textOverlays: [],
    };
    return { kf1: empty, kf2: empty, t: 0 };
  }

  if (keyframes.length === 1) {
    return { kf1: keyframes[0], kf2: keyframes[0], t: 0 };
  }

  // Clamp to last keyframe
  if (elapsed >= keyframes[keyframes.length - 1].time) {
    const last = keyframes[keyframes.length - 1];
    return { kf1: last, kf2: last, t: 0 };
  }

  // Clamp to first keyframe
  if (elapsed <= keyframes[0].time) {
    return { kf1: keyframes[0], kf2: keyframes[0], t: 0 };
  }

  // Find the pair
  for (let i = 0; i < keyframes.length - 1; i++) {
    const kf1 = keyframes[i];
    const kf2 = keyframes[i + 1];
    if (elapsed >= kf1.time && elapsed <= kf2.time) {
      const span = kf2.time - kf1.time;
      const t = span > 0 ? (elapsed - kf1.time) / span : 0;
      return { kf1, kf2, t };
    }
  }

  // Fallback to last keyframe
  const last = keyframes[keyframes.length - 1];
  return { kf1: last, kf2: last, t: 0 };
}

/**
 * Interpolate highlights between two keyframes.
 * Matches highlights by ID for smooth animation.
 */
function interpolateHighlights(kf1: Keyframe, kf2: Keyframe, t: number): HighlightRegion[] {
  // Build a map of kf1 highlights by id
  const kf1Map = new Map(kf1.highlights.map((h) => [h.id, h]));
  const result: HighlightRegion[] = [];

  for (const h2 of kf2.highlights) {
    const h1 = kf1Map.get(h2.id);
    if (h1) {
      result.push(lerpHighlight(h1, h2, t));
    } else {
      // New highlight fading in
      result.push({ ...h2, opacity: h2.opacity * t });
    }
  }

  // Highlights in kf1 but not kf2 are fading out
  for (const h1 of kf1.highlights) {
    if (!kf2.highlights.find((h) => h.id === h1.id)) {
      result.push({ ...h1, opacity: h1.opacity * (1 - t) });
    }
  }

  return result;
}

/**
 * Interpolate arrows between two keyframes.
 * Matches arrows by ID for smooth animation.
 */
function interpolateArrows(kf1: Keyframe, kf2: Keyframe, t: number): ArrowPointer[] {
  // Build a map of kf1 arrows by id
  const kf1Map = new Map(kf1.arrows.map((a) => [a.id, a]));
  const result: ArrowPointer[] = [];

  for (const a2 of kf2.arrows) {
    const a1 = kf1Map.get(a2.id);
    if (a1) {
      result.push(lerpArrow(a1, a2, t));
    } else {
      // New arrow fading in
      result.push({ ...a2, opacity: a2.opacity * t });
    }
  }

  // Arrows in kf1 but not kf2 are fading out
  for (const a1 of kf1.arrows) {
    if (!kf2.arrows.find((a) => a.id === a1.id)) {
      result.push({ ...a1, opacity: a1.opacity * (1 - t) });
    }
  }

  return result;
}

/**
 * Interpolate text overlays between two keyframes.
 * Shows overlays from kf2 with fade-in, fades out overlays only in kf1.
 */
function interpolateTextOverlays(kf1: Keyframe, kf2: Keyframe, t: number): TextOverlay[] {
  const kf1Map = new Map(kf1.textOverlays.map((o) => [o.id, o]));
  const result: TextOverlay[] = [];

  for (const o2 of kf2.textOverlays) {
    const o1 = kf1Map.get(o2.id);
    if (o1) {
      // Present in both — interpolate opacity
      result.push({
        ...o2,
        computedOpacity: lerp(o1.computedOpacity ?? 1, o2.computedOpacity ?? 1, t),
      });
    } else {
      // New overlay - fade from 0 to its target opacity
      result.push({ ...o2, computedOpacity: lerp(0, o2.computedOpacity ?? 1, t) });
    }
  }

  // Overlays in kf1 but not kf2 - fade from their current opacity to 0
  for (const o1 of kf1.textOverlays) {
    if (!kf2.textOverlays.find((o) => o.id === o1.id)) {
      result.push({ ...o1, computedOpacity: lerp(o1.computedOpacity ?? 1, 0, t) });
    }
  }

  return result;
}

export function useExplainerEngine({
  sequence,
  currentTime,
}: UseExplainerEngineOptions): EngineState {
  const preloadedRef = useRef<Set<string>>(new Set());

  // Find the active and incoming segments
  const state = useMemo((): EngineState => {
    const { segments } = sequence;

    if (segments.length === 0) {
      return {
        currentSegment: null,
        incomingSegment: null,
        interpolatedTransform: DEFAULT_TRANSFORM,
        activeHighlights: [],
        activeArrows: [],
        activeTextOverlays: [],
        transitionOpacity: 1,
        incomingOpacity: 0,
      };
    }

    // Find current segment (use < for endTime so the next segment takes over at exact boundary,
    // except for the last segment which uses <=)
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

    // If past all segments, use the last one
    if (!currentSegment && currentTime >= (segments[segments.length - 1]?.endTime ?? 0)) {
      currentSegment = segments[segments.length - 1];
      currentIndex = segments.length - 1;
    }

    // If before all segments, use the first one
    if (!currentSegment) {
      currentSegment = segments[0];
      currentIndex = 0;
    }

    // Determine transition state
    let incomingSegment: Segment | null = null;
    let transitionOpacity = 1;
    let incomingOpacity = 0;

    if (currentSegment && currentIndex < segments.length - 1) {
      const nextSegment = segments[currentIndex + 1];
      const transitionStart = currentSegment.endTime - currentSegment.transitionDuration;

      if (
        currentTime >= transitionStart &&
        currentTime < currentSegment.endTime &&
        currentSegment.transition === "crossfade"
      ) {
        incomingSegment = nextSegment;
        const transitionProgress =
          (currentTime - transitionStart) / currentSegment.transitionDuration;
        // Fade-in only: incoming image fades in on top of current (no fade-out)
        // Current image stays at full opacity (transitionOpacity = 1)
        // This prevents the dark moment during transitions
        // Linear transition - no easing curve
        const linearProgress = Math.max(0, Math.min(1, transitionProgress));
        transitionOpacity = 1; // Keep current image at full opacity
        incomingOpacity = linearProgress; // Incoming fades from 0.0 → 1.0 linearly
      }
    }

    // Fade-to-black transition
    if (
      currentSegment &&
      currentSegment.transition === "fade-to-black" &&
      currentIndex < segments.length - 1
    ) {
      const transitionStart = currentSegment.endTime - currentSegment.transitionDuration;
      if (currentTime >= transitionStart && currentTime < currentSegment.endTime) {
        const progress = (currentTime - transitionStart) / currentSegment.transitionDuration;
        transitionOpacity = progress <= 0.5 ? 1 - progress * 2 : (progress - 0.5) * 2;
        if (progress > 0.5) {
          incomingSegment = segments[currentIndex + 1];
        }
      }
    }

    // Interpolate keyframes within the current segment
    const elapsed = currentTime - currentSegment.startTime;
    const { kf1, kf2, t } = findKeyframePair(currentSegment.keyframes, elapsed);

    const interpolatedTransform = lerpTransform(kf1.transform, kf2.transform, t);
    const activeHighlights = interpolateHighlights(kf1, kf2, t);
    const activeArrows = interpolateArrows(kf1, kf2, t);
    const activeTextOverlays = interpolateTextOverlays(kf1, kf2, t);

    return {
      currentSegment,
      incomingSegment,
      interpolatedTransform,
      activeHighlights,
      activeArrows: activeArrows.filter((a) => a.opacity > 0.01),
      activeTextOverlays: activeTextOverlays.filter((o) => o.computedOpacity > 0.01),
      transitionOpacity,
      incomingOpacity,
    };
  }, [sequence, currentTime]);

  // Reset preload cache when sequence changes
  useEffect(() => {
    preloadedRef.current.clear();
  }, [sequence]);

  // Preload upcoming images
  useEffect(() => {
    const { segments } = sequence;
    const currentIndex = segments.findIndex(
      (s) => currentTime >= s.startTime && currentTime < s.endTime
    );

    // Preload current + next 2 segments
    for (let i = Math.max(0, currentIndex); i < Math.min(segments.length, currentIndex + 3); i++) {
      const url = segments[i]?.imageUrl;
      if (url && !preloadedRef.current.has(url)) {
        preloadedRef.current.add(url);
        const img = new Image();
        img.src = url;
      }
    }
  }, [sequence, currentTime]);

  return state;
}
