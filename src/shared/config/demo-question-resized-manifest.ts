// Hand-maintained (unlike demo-question-avif-manifest.ts, which a dev script
// regenerates — don't add entries there or they get clobbered).
//
// Maps an original R2 key to a DOWNSCALED JPEG sibling. Use this instead of the
// AVIF manifest when a source image is texture-dense enough that modern codecs
// lose: for the oncocytoma low-power slide, AVIF at the same resolution came in
// at 408 KiB and WebP at 556 KiB against a 472 KiB JPEG original, and a plain
// mozjpeg re-encode was *larger* (551 KiB). Dropping to 1280px wide was the
// only real win (294 KiB, -38%).
//
// The demo-questions route serves the resized file inline and passes the
// untouched original through as `fullUrl`, so the carousel's fullscreen view
// still gets full diagnostic resolution. The `images` DB row is NOT modified —
// admin, review, and every other surface keep resolving the original.
export const DEMO_QUESTION_RESIZED: ReadonlyMap<string, string> = new Map([
  [
    "library/20250811230345-kidney-oncocytoma-low-power.4db6a9a7-64a8-499a-b482-dd5302373616",
    "library/demo-optimized/20250811230345-kidney-oncocytoma-low-power.4db6a9a7-64a8-499a-b482-dd5302373616.w1280.jpg",
  ],
]);
