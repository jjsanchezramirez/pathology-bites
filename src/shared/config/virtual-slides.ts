// src/shared/config/virtual-slides.ts
// Public, immutable JSON URL for client-only search.
// Hard-coded R2 data URL - this is a public, static URL that doesn't change
const DATA_BASE = "https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev";

// UPDATED: v11 production dataset (66,300 WSIs). v10 + MGH enrichment: dropped 2,470
// login-walled/dead MGH cases (no hosted slide) and derived previews for ~7.7k live MGH
// slides. v10 added Wirtualny stains (~19k) + additional-content links (Hemepath/Rosai/AANP).
// Full rebuild from the scraped corpus; requires a diagnosis. Toronto filtered client-side.
// - New source: Wirtualny Mikroskop (Gdańsk Tech). Canonical taxonomies: 61 organs, 16
//   categories, 249 stains. Adds `groups` (pair/panel case-groups) + per-entry `k` for the
//   related-slides panel; the loader ignores these until that UI lands.
// - Abbreviated field names (x, d, c, s, q, etc.); WHO Classification of Tumours abbreviations.
// - Brotli-compressed object (26MB → 2.05MB, lgwin 24). Stored with HTTP metadata
//   Content-Encoding: br — browser auto-decompresses; fetch() sees plain JSON,
//   no DecompressionStream needed (only .json.gz triggers manual decompress).
export const VIRTUAL_SLIDES_JSON_URL = `${DATA_BASE}/virtual-slides/virtual-slides-v11-min.json.br?v=11`;

// Fallback URL (same object) retained for the loader's fallback path.
export const VIRTUAL_SLIDES_JSON_URL_FALLBACK = `${DATA_BASE}/virtual-slides/virtual-slides-v11-min.json.br?v=11`;
