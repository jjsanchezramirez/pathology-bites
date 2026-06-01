// src/shared/config/virtual-slides.ts
// Public, immutable JSON URL for client-only search.
// Hard-coded R2 data URL - this is a public, static URL that doesn't change
const DATA_BASE = "https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev";

// UPDATED: v15 production dataset (66,300 WSIs, 11 sources). Cumulative over v9–v14:
// - Wirtualny stains recovered (~19k) + new source Wirtualny Mikroskop (Gdańsk Tech, IIIF).
// - Additional-content links (Hemepath/Rosai/AANP PDFs); requires a diagnosis.
// - MGH enrichment: dropped 2,470 login-walled/dead cases, derived ~7.7k previews.
// - Category made strict (16 canonical; junk free-text + long Leeds terms like
//   "Eye, ear, nose and throat (ENT)" → null/Head and Neck). Toronto filtered client-side.
// - `groups` (pair/panel/session case-groups) + per-entry `k` drive the related-slides panel.
// - v15: PathPresenter "Slide Type: Image" entries (2,711, mostly gross dermatopathology)
//   labeled stain="Gross photo".
// - Abbreviated field names (x, d, c, s, q, etc.). Brotli (lgwin 24) ~2.14MB; stored with
//   Content-Encoding: br — browser auto-decompresses, fetch() sees plain JSON.
export const VIRTUAL_SLIDES_JSON_URL = `${DATA_BASE}/virtual-slides/virtual-slides-v15-min.json.br?v=15`;

// Fallback URL (same object) retained for the loader's fallback path.
export const VIRTUAL_SLIDES_JSON_URL_FALLBACK = `${DATA_BASE}/virtual-slides/virtual-slides-v15-min.json.br?v=15`;
