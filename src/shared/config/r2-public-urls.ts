// src/shared/config/r2-public-urls.ts
//
// Public origins of the two R2 buckets the browser reads from. Both are
// Cloudflare custom domains attached to the buckets, so responses are cached
// at the edge (cache rule + Smart Tiered Cache on the pathologybites.com zone).
//
// The legacy `pub-*.r2.dev` development URLs still resolve and are still
// stored in old data (images.url rows, R2 manifests, cached clients). They are
// rate-limited and uncached, so nothing should *emit* them any more — but
// anything that *recognises* our URLs must accept both, via the helpers below.

/** pathology-bites-images bucket (question images, anki media, svg, etc.) */
export const R2_IMAGES_PUBLIC_URL = "https://img.pathologybites.com";

/** pathology-bites-data bucket (JSON datasets + their manifests) */
export const R2_DATA_PUBLIC_URL = "https://data.pathologybites.com";

/** Legacy r2.dev hostnames, recognised but never generated. */
export const LEGACY_R2_IMAGES_HOST = "pub-a4bec7073d99465f99043c842be6318c.r2.dev";
export const LEGACY_R2_DATA_HOST = "pub-cee35549242c4118a1e03da0d07182d3.r2.dev";

export const R2_IMAGES_HOSTS: ReadonlySet<string> = new Set([
  new URL(R2_IMAGES_PUBLIC_URL).host,
  LEGACY_R2_IMAGES_HOST,
]);

const OUR_R2_HOSTS: ReadonlySet<string> = new Set([
  ...R2_IMAGES_HOSTS,
  new URL(R2_DATA_PUBLIC_URL).host,
  LEGACY_R2_DATA_HOST,
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
