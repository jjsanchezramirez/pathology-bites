import type {
  Transform,
  Keyframe,
  HighlightRegion,
  ArrowPointer,
  TextOverlay,
} from "@/shared/types/explainer";

export const DEFAULT_TRANSFORM: Transform = { x: 0, y: 0, scale: 1 };

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function lerpTransform(a: Transform, b: Transform, t: number): Transform {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), scale: lerp(a.scale, b.scale, t) };
}

export function findKeyframePair(
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
    const kf1 = keyframes[i],
      kf2 = keyframes[i + 1];
    if (elapsed >= kf1.time && elapsed <= kf2.time) {
      const span = kf2.time - kf1.time;
      return { kf1, kf2, t: span > 0 ? (elapsed - kf1.time) / span : 0 };
    }
  }
  const last = keyframes[keyframes.length - 1];
  return { kf1: last, kf2: last, t: 0 };
}

export function lerpHighlight(a: HighlightRegion, b: HighlightRegion, t: number): HighlightRegion {
  return {
    ...b,
    position: { x: lerp(a.position.x, b.position.x, t), y: lerp(a.position.y, b.position.y, t) },
    size: {
      width: lerp(a.size.width, b.size.width, t),
      height: lerp(a.size.height, b.size.height, t),
    },
    opacity: lerp(a.opacity, b.opacity, t),
    borderWidth: lerp(a.borderWidth, b.borderWidth, t),
  };
}

export function interpolateHighlights(kf1: Keyframe, kf2: Keyframe, t: number): HighlightRegion[] {
  const map1 = new Map(kf1.highlights.map((h) => [h.id, h]));
  const result: HighlightRegion[] = [];
  for (const h2 of kf2.highlights) {
    const h1 = map1.get(h2.id);
    result.push(h1 ? lerpHighlight(h1, h2, t) : { ...h2, opacity: h2.opacity * t });
  }
  for (const h1 of kf1.highlights) {
    if (!kf2.highlights.find((h) => h.id === h1.id))
      result.push({ ...h1, opacity: h1.opacity * (1 - t) });
  }
  return result;
}

export function interpolateArrows(kf1: Keyframe, kf2: Keyframe, t: number): ArrowPointer[] {
  const map1 = new Map(kf1.arrows.map((a) => [a.id, a]));
  const result: ArrowPointer[] = [];
  for (const a2 of kf2.arrows) {
    const a1 = map1.get(a2.id);
    result.push({ ...a2, opacity: a1 ? lerp(a1.opacity, a2.opacity, t) : a2.opacity * t });
  }
  for (const a1 of kf1.arrows) {
    if (!kf2.arrows.find((a) => a.id === a1.id))
      result.push({ ...a1, opacity: a1.opacity * (1 - t) });
  }
  return result;
}

export function interpolateTextOverlays(kf1: Keyframe, kf2: Keyframe, t: number): TextOverlay[] {
  const map1 = new Map(kf1.textOverlays.map((o) => [o.id, o]));
  const result: TextOverlay[] = [];
  for (const o2 of kf2.textOverlays) {
    const o1 = map1.get(o2.id);
    result.push({
      ...o2,
      computedOpacity: o1
        ? lerp(o1.computedOpacity ?? 1, o2.computedOpacity ?? 1, t)
        : lerp(0, o2.computedOpacity ?? 1, t),
    });
  }
  for (const o1 of kf1.textOverlays) {
    if (!kf2.textOverlays.find((o) => o.id === o1.id))
      result.push({ ...o1, computedOpacity: lerp(o1.computedOpacity ?? 1, 0, t) });
  }
  return result;
}
