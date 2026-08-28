// src/shared/config/ihc-data.ts
import { createManifestResolver, type R2Manifest } from "@/shared/config/r2-manifest";
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

// FALLBACK: compiled URLs, used only when the manifest cannot be read. They point
// at the legacy fixed keys, which r2_publish_ihc.mjs still writes on every publish.
// Safe to leave stale — a degraded-mode backstop, not the normal path.
export const IHC_MATRIX_URL = `${DATA_BASE}/data/ihc/ihc-matrix.json.br?v=00d73309`;
export const IHC_MOLECULAR_URL = `${DATA_BASE}/data/ihc/ihc-molecular.json.br?v=f6026f14`;

/**
 * Resolve the live dataset URLs from the manifest, falling back to the compiled
 * URLs above if it is unreachable. Shared implementation — see
 * src/shared/config/r2-manifest.ts and the CLAUDE.md "Caching" rule.
 */
const resolver = createManifestResolver(IHC_MANIFEST_URL, {
  matrix: IHC_MATRIX_URL,
  molecular: IHC_MOLECULAR_URL,
});

/**
 * The knowledge base's curated entity-merge map, published beside the matrix.
 *
 * The matrix is keyed on (entity, WHO volume) — one row per chapter — while the
 * base holds one row per tumour, so the tool folds the chapter rows together
 * before showing them (see features/public/tools/ihc/aggregate.ts). This
 * artifact is what lets it fold two DIFFERENTLY named rows the curators have
 * already ruled to be one disease.
 *
 * There is deliberately NO compiled fallback: it is resolved only when the
 * manifest advertises it, so a build published before this existed simply
 * doesn't ask for it, and the tool degrades to name-level grouping rather than
 * firing a request that is certain to 404.
 */
const isUrlEntry = (v: unknown): v is { url: string } =>
  !!v && typeof v === "object" && typeof (v as { url?: unknown }).url === "string";

export async function resolveIhcUrls(): Promise<{
  matrixUrl: string;
  molecularUrl: string;
  entityGroupsUrl: string | null;
  manifest: R2Manifest | null;
}> {
  const { urls, manifest } = await resolver();
  const groups = manifest?.entityGroups;
  return {
    matrixUrl: urls.matrix,
    molecularUrl: urls.molecular,
    entityGroupsUrl: isUrlEntry(groups) ? groups.url : null,
    manifest,
  };
}
