// src/shared/config/ihc-data.ts
// Public R2 URLs for the IHC Panel Builder's client-fetched datasets.
//
// These used to be 8MB of uncompressed JSON committed under public/data/. They are
// generated artifacts and every rebuild rewrote the whole file, so each regeneration
// added another multi-MB blob to git history forever. They now live in R2 (bucket
// pathology-bites-data, prefix data/ihc/) and are gitignored locally.
//
// Stored as `.json.br` with `Content-Encoding: br` + `Content-Type: application/json`,
// so the browser decompresses natively and `res.json()` works with a plain fetch —
// no client-side decompression. 5.97MB -> 0.50MB on the wire (~92% smaller).
//
// Objects are immutable-cached; `?v=<hash>` is the cache-buster. Republish with
// `node dev/resources/who_classification/r2_publish_ihc.mjs`, which prints the new
// hashes — paste them here when the data changes.
const DATA_BASE = "https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev";

// v3 (2026-08-17): two independent extractions reconciled against a
// sentence-level audit of all 11,831 v1 calls. Cells now carry `status`
// (confirmed / carried / review) and `certainty` (definite / variable), and a
// proliferation index is its own polarity rather than a positive. 1,654 v1 calls
// that neither pass supports were dropped.
export const IHC_MATRIX_URL = `${DATA_BASE}/data/ihc/ihc-matrix.json.br?v=6456fc04`;
export const IHC_MOLECULAR_URL = `${DATA_BASE}/data/ihc/ihc-molecular.json.br?v=723a19fd`;
