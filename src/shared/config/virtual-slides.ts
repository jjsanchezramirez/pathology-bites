// src/shared/config/virtual-slides.ts
// Public, immutable JSON URL for client-only search.
// Hard-coded R2 data URL - this is a public, static URL that doesn't change
const DATA_BASE = "https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev";

// UPDATED: v8 production dataset (27,980 WSIs — +2,411 from WHO Blue Books and Pitt AANP DSS).
// - Abbreviated field names (x, d, c, s, q, etc.); WHO Classification of Tumours abbreviations
// - organ (s) field now populated on 82% of records, category (c) on 95.7%
// - Brotli-compressed object (8.9MB → 750KB). Stored with HTTP metadata
//   Content-Encoding: br — browser auto-decompresses; fetch() sees plain JSON,
//   no DecompressionStream needed (only .json.gz triggers manual decompress).
export const VIRTUAL_SLIDES_JSON_URL = `${DATA_BASE}/virtual-slides/virtual-slides-v8-min.json.br?v=8`;

// Fallback URL (same object) retained for the loader's fallback path.
export const VIRTUAL_SLIDES_JSON_URL_FALLBACK = `${DATA_BASE}/virtual-slides/virtual-slides-v8-min.json.br?v=8`;
