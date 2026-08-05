/**
 * Demo-question image URL rewriting.
 *
 * The homepage demo question is the only place we swap in pre-optimized R2
 * siblings. Two manifests behave differently and the difference is load-bearing:
 * a resized JPEG loses resolution, so the original MUST come back as `fullUrl`
 * for the carousel's fullscreen view; an AVIF is same-resolution, so it must
 * NOT set `fullUrl` (that would make fullscreen re-download the bigger file for
 * no visual gain).
 *
 * Everything else must pass through untouched — this API serves arbitrary
 * user-uploaded images and rewriting an unknown URL would 404 the image.
 */

import { describe, it, expect } from "vitest";
import { optimizeDemoImageUrl } from "@/shared/utils/r2/demo-question-image-url";
import { DEMO_QUESTION_AVIF_OPTIMIZED } from "@/shared/config/demo-question-avif-manifest";
import { DEMO_QUESTION_RESIZED } from "@/shared/config/demo-question-resized-manifest";

const HOST = "https://pub-a4bec7073d99465f99043c842be6318c.r2.dev";

const [resizedOriginalKey, resizedVariantKey] = [...DEMO_QUESTION_RESIZED.entries()][0];
const avifKey = [...DEMO_QUESTION_AVIF_OPTIMIZED][0];

describe("optimizeDemoImageUrl — resized JPEG entries", () => {
  it("serves the downscaled file inline and keeps the original as fullUrl", () => {
    const result = optimizeDemoImageUrl(`${HOST}/${resizedOriginalKey}`);

    expect(result.url).toBe(`${HOST}/${resizedVariantKey}`);
    expect(result.fullUrl).toBe(`${HOST}/${resizedOriginalKey}`);
  });

  it("points fullUrl at a different file than url (else the swap is pointless)", () => {
    const result = optimizeDemoImageUrl(`${HOST}/${resizedOriginalKey}`);
    expect(result.fullUrl).not.toBe(result.url);
  });
});

describe("optimizeDemoImageUrl — AVIF entries", () => {
  it("rewrites to the AVIF sibling", () => {
    const result = optimizeDemoImageUrl(`${HOST}/${avifKey}`);
    const filename = avifKey.replace(/^library\//, "");

    expect(result.url).toBe(`${HOST}/library/demo-optimized/${filename}.avif`);
  });

  it("sets NO fullUrl — the AVIF is same-resolution, so fullscreen needs nothing extra", () => {
    const result = optimizeDemoImageUrl(`${HOST}/${avifKey}`);
    expect(result.fullUrl).toBeUndefined();
  });
});

describe("optimizeDemoImageUrl — pass-through", () => {
  it("leaves an unmanifested key on our host alone", () => {
    const url = `${HOST}/library/some-other-user-upload.abc123`;
    expect(optimizeDemoImageUrl(url)).toEqual({ url });
  });

  it("leaves a foreign host alone even if the path matches a manifest key", () => {
    const url = `https://example.com/${resizedOriginalKey}`;
    expect(optimizeDemoImageUrl(url)).toEqual({ url });
  });

  it("handles an empty string without throwing", () => {
    expect(optimizeDemoImageUrl("")).toEqual({ url: "" });
  });

  it("handles a malformed URL without throwing", () => {
    expect(optimizeDemoImageUrl("not-a-url")).toEqual({ url: "not-a-url" });
  });
});
