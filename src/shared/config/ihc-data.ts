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
// PRIMARY: the loader resolves the live dataset URLs from this manifest, so a
// republish is picked up with NO app redeploy. r2_publish_ihc.mjs writes each
// rebuild as a NEW content-addressed object (`ihc-matrix-<hash>.json.br`,
// immutable, cacheable forever) and flips the manifest to point at it. Only the
// manifest is mutable, and it carries a 60s TTL.
//
// Same architecture as virtual-slides/manifest.json — see
// src/shared/config/virtual-slides.ts. Manifest shape:
//   { matrix: {url, hash, brBytes}, molecular: {...}, diagnoses, markers, cells, ... }
const DATA_BASE = "https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev";

export const IHC_MANIFEST_URL = `${DATA_BASE}/data/ihc/manifest.json`;

export type IhcManifest = {
  matrix?: { url: string; hash: string; brBytes: number } | null;
  molecular?: { url: string; hash: string; brBytes: number } | null;
  diagnoses?: number;
  markers?: number;
  cells?: number;
  references?: number;
  generatedAt?: string;
  publishedAt?: string;
};

// Module-level cache: the manifest is fetched at most once per session and
// shared by every consumer (the panel tool and the debug harnesses).
let cached: { matrixUrl: string; molecularUrl: string; manifest: IhcManifest | null } | null = null;
let inflight: Promise<{
  matrixUrl: string;
  molecularUrl: string;
  manifest: IhcManifest | null;
}> | null = null;

/**
 * Resolve the live dataset URLs. Falls back to the compiled URLs below if the
 * manifest is unreachable or malformed — degraded mode, never blocks the page.
 */
export function resolveIhcUrls(): Promise<{
  matrixUrl: string;
  molecularUrl: string;
  manifest: IhcManifest | null;
}> {
  if (cached) return Promise.resolve(cached);
  if (inflight) return inflight;

  inflight = (async () => {
    const fallback = {
      matrixUrl: IHC_MATRIX_URL,
      molecularUrl: IHC_MOLECULAR_URL,
      manifest: null as IhcManifest | null,
    };
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(IHC_MANIFEST_URL, {
        cache: "no-cache",
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));
      if (res.ok) {
        const m = (await res.json()) as IhcManifest;
        const resolved = {
          matrixUrl: m?.matrix?.url || IHC_MATRIX_URL,
          molecularUrl: m?.molecular?.url || IHC_MOLECULAR_URL,
          manifest: m ?? null,
        };
        cached = resolved;
        return resolved;
      }
    } catch {
      // unreachable / aborted / malformed — fall through to the compiled URLs
    }
    cached = fallback;
    return fallback;
  })();

  return inflight;
}

// v3 (2026-08-17): two independent extractions reconciled against a
// sentence-level audit of all 11,831 v1 calls. Cells now carry `status`
// (confirmed / carried / review) and `certainty` (definite / variable), and a
// proliferation index is its own polarity rather than a positive. 1,654 v1 calls
// that neither pass supports were dropped.
// adde8669 (2026-08-22): syndrome re-home. WHO's genetic-tumour-syndrome
// chapters describe the tumours a syndrome CAUSES, and the extractor keyed those
// stains to the syndrome — the tool was asserting that MEN2 is positive for
// calcitonin, when WHO said the medullary thyroid carcinoma is. A panel judged
// all 371 such cells against their source quote, with an adversarial pass
// specifically hunting for germline surrogates (SDHB, MMR proteins, BAP1, PTEN)
// being moved off the syndrome they legitimately diagnose. 46 cells moved, 189
// dropped as duplicates the tumour's own chapter already carried, 110 stayed as
// true surrogates. Diagnoses now carry `kind`, so the UI can say which is which.
// FALLBACK: compiled URLs, used only when the manifest cannot be read. They point
// at the legacy fixed keys, which r2_publish_ihc.mjs still writes on every publish.
// Safe to leave stale — a degraded-mode backstop, not the normal path.
export const IHC_MATRIX_URL = `${DATA_BASE}/data/ihc/ihc-matrix.json.br?v=00d73309`;
export const IHC_MOLECULAR_URL = `${DATA_BASE}/data/ihc/ihc-molecular.json.br?v=f6026f14`;
