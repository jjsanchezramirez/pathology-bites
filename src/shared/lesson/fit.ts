// Fitting text to its box: the search the renderer runs with real DOM
// measurements (clean-layer.tsx). Pure, so it can be tested without a browser.

/** Smallest a text may shrink to fit its box, as a fraction of its size. */
export const MIN_TEXT_SCALE = 0.5;

/**
 * Largest scale in [MIN_TEXT_SCALE, 1] for which `fits(scale)` holds, by
 * bisection (fits is assumed monotonic: smaller text fits at least as well).
 */
export function fitScale(fits: (scale: number) => boolean, steps = 7): number {
  if (fits(1)) return 1;
  let lo = MIN_TEXT_SCALE;
  let hi = 1;
  if (!fits(lo)) return lo;
  for (let i = 0; i < steps; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}
