// src/shared/config/virtual-slides.ts
// Public, immutable JSON URL for client-only search.
// Hard-coded R2 data URL - this is a public, static URL that doesn't change
const DATA_BASE = "https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev";

// Single STABLE object — overwritten on every publish. Cache-busting is by the ?v= content
// hash (8 chars of sha256 over the brotli bytes), bumped automatically by publish_corpus.mjs.
// The URL changes iff the content changes, so identical rebuilds stay cached and there's no
// vN-file proliferation. Don't hand-edit ?v= — re-run the publish step.
//
// Dataset: ~66,300 WSIs, 11 sources. Notable processing: Wirtualny stains recovered (~19k) +
// Wirtualny Mikroskop (Gdańsk Tech, IIIF); additional-content links (Hemepath/Rosai/AANP);
// MGH enrichment (dropped 2,470 dead/login-walled, ~7.7k previews); strict 16-category
// taxonomy; pair/panel/session `groups` + `k` for related slides; PathPresenter "Slide Type:
// Image" (2,711, mostly gross derm) labeled stain="Gross photo". Abbreviated field names;
// brotli lgwin 24 ~2.14MB stored with Content-Encoding: br (browser auto-decompresses).
export const VIRTUAL_SLIDES_JSON_URL = `${DATA_BASE}/virtual-slides/virtual-slides-min.json.br?v=f524b5c8`;

// Fallback URL (same object) retained for the loader's fallback path.
export const VIRTUAL_SLIDES_JSON_URL_FALLBACK = `${DATA_BASE}/virtual-slides/virtual-slides-min.json.br?v=f524b5c8`;
