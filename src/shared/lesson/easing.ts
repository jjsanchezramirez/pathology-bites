// Timeline easing primitives — ported from the reference player (dev/PathVideo.jsx).
// Pure, framework-agnostic. Shared by the lesson evaluator (editor preview, player,
// and export) so motion is authored once and identical everywhere.

export type EaseFn = (t: number) => number;

export const Easing = {
  linear: (t: number) => t,
  // Our historical player default (ease-in-out cubic via smoothstep). Kept named so
  // existing motion is byte-identical unless an author opts into another curve.
  smoothstep: (t: number) => t * t * (3 - 2 * t),
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => (t - 1) ** 3 + 1,
  easeInOutCubic: (t: number) =>
    t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  easeOutQuart: (t: number) => 1 - (t - 1) ** 4,
  easeInOutQuart: (t: number) => (t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (t - 1) ** 4),
  easeOutExpo: (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  easeOutBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  easeOutElastic: (t: number) => {
    const c4 = (2 * Math.PI) / 3;
    if (t === 0) return 0;
    if (t === 1) return 1;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
} satisfies Record<string, EaseFn>;

export type EaseName = keyof typeof Easing;

export const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, v));

/**
 * Curried, multi-stop interpolation. Returns a function of `t`.
 * `ease` may be a single curve OR an array of curves (one per segment) — the
 * array form is per-keyframe easing (each leg eases independently).
 */
export function interpolate(
  input: number[],
  output: number[],
  ease: EaseFn | EaseFn[] = Easing.linear
): (t: number) => number {
  return (t: number) => {
    if (t <= input[0]) return output[0];
    if (t >= input[input.length - 1]) return output[output.length - 1];
    for (let i = 0; i < input.length - 1; i++) {
      if (t >= input[i] && t <= input[i + 1]) {
        const span = input[i + 1] - input[i];
        const local = span === 0 ? 0 : (t - input[i]) / span;
        const easeFn = Array.isArray(ease) ? ease[i] ?? Easing.linear : ease;
        return output[i] + (output[i + 1] - output[i]) * easeFn(local);
      }
    }
    return output[output.length - 1];
  };
}

/** Single eased tween over [start, end]. Returns a function of `t`. */
export function animate(opts: {
  from?: number;
  to?: number;
  start?: number;
  end?: number;
  ease?: EaseFn;
}): (t: number) => number {
  const { from = 0, to = 1, start = 0, end = 1, ease = Easing.easeInOutCubic } = opts;
  return (t: number) => {
    if (t <= start) return from;
    if (t >= end) return to;
    return from + (to - from) * ease((t - start) / (end - start));
  };
}

/** Apply a named easing to a normalized progress, with a safe fallback. */
export function applyEase(
  name: EaseName | undefined,
  t: number,
  fallback: EaseName = "easeInOutCubic"
): number {
  const fn = (name && Easing[name]) || Easing[fallback];
  return fn(t);
}
