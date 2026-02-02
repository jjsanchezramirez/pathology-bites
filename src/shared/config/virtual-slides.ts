// src/shared/config/virtual-slides.ts
// Public, immutable JSON URL for client-only search.
// Hard-coded R2 data URL - this is a public, static URL that doesn't change
const DATA_BASE = "https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev";

// UPDATED: Now using v7 production format with WHO medical abbreviations (92% smaller: 11MB → 938KB)
// - v7 uses abbreviated field names (x, d, c, s, q, etc.) reducing from 11.42MB → 6.41MB JSON
// - WHO Classification of Tumours abbreviations (881 exact-match terms)
// - Subcategory normalization (62 standardized organ systems)
// - Gzipped version compresses down to 938KB for lightning-fast loading
// - Browser's DecompressionStream API handles decompression automatically
// Legacy files kept as backup for old clients
export const VIRTUAL_SLIDES_JSON_URL = `${DATA_BASE}/virtual-slides/virtual-slides-v7-min.json.gz?v=7`;

// Fallback: Non-gzipped version (6.41MB) for browsers without DecompressionStream support
export const VIRTUAL_SLIDES_JSON_URL_FALLBACK = `${DATA_BASE}/virtual-slides/virtual-slides-v7-min.json?v=7`;
