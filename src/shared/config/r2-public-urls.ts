// src/shared/config/r2-public-urls.ts
//
// Public origins of the two R2 buckets the browser reads from. Both are
// Cloudflare custom domains attached to the buckets, so responses are cached
// at the edge (cache rule + Smart Tiered Cache on the pathologybites.com zone).
//
// The `pub-*.r2.dev` development URLs were retired in Nov 2026 (disabled on
// the buckets; no stored URL or manifest references them). They are still
// *recognised* by the helpers below so a stray old URL is treated as ours
// (e.g. extractR2KeyFromUrl on a delete), but nothing may *emit* them.

/** pathology-bites-images bucket (question images, anki media, svg, etc.) */
export const R2_IMAGES_PUBLIC_URL = "https://img.pathologybites.com";

/** pathology-bites-data bucket (JSON datasets + their manifests) */
export const R2_DATA_PUBLIC_URL = "https://data.pathologybites.com";

/** pathology-bites-audio bucket (narration for interactive sequences) */
export const R2_AUDIO_PUBLIC_URL = "https://audio.pathologybites.com";

/** Legacy r2.dev hostnames, recognised but never generated. */
export const LEGACY_R2_IMAGES_HOST = "pub-a4bec7073d99465f99043c842be6318c.r2.dev";
export const LEGACY_R2_DATA_HOST = "pub-cee35549242c4118a1e03da0d07182d3.r2.dev";
export const LEGACY_R2_AUDIO_HOST = "pub-9b9085c172ac445ca3d87dec27a0518f.r2.dev";

export const R2_IMAGES_HOSTS: ReadonlySet<string> = new Set([
  new URL(R2_IMAGES_PUBLIC_URL).host,
  LEGACY_R2_IMAGES_HOST,
]);

const OUR_R2_HOSTS: ReadonlySet<string> = new Set([
  ...R2_IMAGES_HOSTS,
  new URL(R2_DATA_PUBLIC_URL).host,
  LEGACY_R2_DATA_HOST,
  new URL(R2_AUDIO_PUBLIC_URL).host,
  LEGACY_R2_AUDIO_HOST,
]);

/** True for any hostname that serves one of our public R2 buckets. */
export function isR2PublicHost(hostname: string): boolean {
  return (
    OUR_R2_HOSTS.has(hostname) ||
    hostname.endsWith(".r2.dev") ||
    hostname.endsWith(".r2.cloudflarestorage.com")
  );
}

/** Same check on a full URL string; false for relative paths or junk. */
export function isR2PublicUrl(url: string): boolean {
  try {
    return isR2PublicHost(new URL(url).hostname);
  } catch {
    return false;
  }
}
