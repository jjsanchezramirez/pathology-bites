// src/shared/config/virtual-slides.ts
// Public R2 URLs for client-only virtual-slide search.
const DATA_BASE = "https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev";

// PRIMARY: the loader fetches this manifest first to discover the live corpus URL.
// The corpus pipeline (publish_corpus.mjs) writes each rebuild as a NEW immutable object
// `virtual-slides/corpus-<hash>.json.br` and flips this manifest's `url` to point at it.
// Because the corpus filename is content-addressed and immutable, browsers/CDN can cache it
// forever with zero staleness, and republishing needs NO app redeploy — only the manifest
// (short TTL) changes. Manifest shape: { url, hash, total, per_source, generated }.
export const VIRTUAL_SLIDES_MANIFEST_URL = `${DATA_BASE}/virtual-slides/manifest.json`;

// FALLBACK: compiled corpus URL used only if the manifest is unreachable/malformed. Points at
// the last legacy stable object. Safe to leave stale — it's a degraded-mode backstop.
//
// Dataset: ~66k WSIs, 11 sources. Abbreviated field names; brotli lgwin 24 stored with
// Content-Encoding: br (browser auto-decompresses). See dev/resources/scrapers for the pipeline.
export const VIRTUAL_SLIDES_JSON_URL = `${DATA_BASE}/virtual-slides/virtual-slides-min.json.br?v=eeae49ce`;

// Retained for the loader's secondary fallback path.
export const VIRTUAL_SLIDES_JSON_URL_FALLBACK = `${DATA_BASE}/virtual-slides/virtual-slides-min.json.br?v=eeae49ce`;
