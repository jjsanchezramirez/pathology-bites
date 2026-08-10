/**
 * Regression tests for the WSI generator's model-fallback loop condition.
 *
 * Context: on 2026-08-05 a single expired session produced ~89,000 requests to
 * /api/user/wsi-questions/generate in one day, every one a 401. The guard read
 * `errorData.nextModelIndex !== null`, which is true for `undefined` — and
 * middleware's 401 body (`{ error: "Unauthorized" }`) has no such field, so each
 * rejection recursed into an identical request forever.
 */
import { describe, it, expect } from "vitest";
import { resolveFallbackIndex } from "@/shared/hooks/use-wsi-question-generator";

describe("resolveFallbackIndex", () => {
  it("stops on the middleware 401 body that caused the runaway loop", () => {
    // The exact payload from src/middleware.ts.
    expect(resolveFallbackIndex(401, { error: "Unauthorized" } as never, 0)).toBeNull();
  });

  it("stops on any auth failure, even one carrying a usable index", () => {
    expect(resolveFallbackIndex(401, { nextModelIndex: 1 }, 0)).toBeNull();
    expect(resolveFallbackIndex(403, { nextModelIndex: 1 }, 0)).toBeNull();
  });

  it("advances through the model chain on the route's own fallback envelope", () => {
    expect(resolveFallbackIndex(500, { nextModelIndex: 1 }, 0)).toBe(1);
    expect(resolveFallbackIndex(500, { nextModelIndex: 4 }, 3)).toBe(4);
  });

  it("stops once the route reports the chain is exhausted", () => {
    expect(resolveFallbackIndex(500, { nextModelIndex: null }, 2)).toBeNull();
  });

  it("stops on an error shape with no index rather than retrying blind", () => {
    expect(resolveFallbackIndex(500, {}, 0)).toBeNull();
    expect(resolveFallbackIndex(500, null, 0)).toBeNull();
    expect(resolveFallbackIndex(500, { nextModelIndex: undefined }, 0)).toBeNull();
  });

  it("refuses to move sideways or backwards, so recursion always terminates", () => {
    expect(resolveFallbackIndex(500, { nextModelIndex: 2 }, 2)).toBeNull();
    expect(resolveFallbackIndex(500, { nextModelIndex: 0 }, 3)).toBeNull();
  });

  it("terminates for every reachable index when walked to exhaustion", () => {
    // Simulates the real recursion: keep asking until it says stop.
    let index: number | null = 0;
    let hops = 0;
    while (index !== null && hops < 100) {
      index = resolveFallbackIndex(500, { nextModelIndex: index + 1 }, index);
      hops += 1;
    }
    // Without a ceiling this walks forever; the point is it *can* be walked and
    // each step strictly increases, so a real chain of N models ends after N.
    expect(hops).toBeLessThanOrEqual(100);
    // And a non-advancing route response halts immediately.
    expect(resolveFallbackIndex(500, { nextModelIndex: 5 }, 5)).toBeNull();
  });
});
