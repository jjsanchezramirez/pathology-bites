// src/shared/config/knowledge-graph-data.ts
import { createManifestResolver, type R2Manifest } from "@/shared/config/r2-manifest";
// Public R2 URL for the knowledge graph's baked cloud snapshot.
//
// The graph is ~10,600 nodes and 28,500 edges in the database. Served live it is
// five megabytes of JSON across two requests plus a second or two of Leiden in a
// worker before anything takes shape — fine for the explorer, hopeless for a
// landing page. The snapshot bakes the pruned graph AND its layout into one
// binary blob of about 80KB: no API, no partitioning, nothing to compute.
//
// Stored as `.bin.br` with `Content-Encoding: br`, so the browser inflates it
// natively and a plain `fetch().arrayBuffer()` yields the decoded bytes.
//
// PRIMARY: the cloud resolves the live URL from this manifest, so a rebuild is
// picked up with NO app redeploy. build-snapshot.ts writes each rebuild as a new
// content-addressed object (`cloud-v1-<hash>.bin.br`, immutable, cacheable
// forever) and flips the manifest to point at it. Only the manifest is mutable,
// and it carries a 60s TTL.
//
// Same architecture as data/ihc/manifest.json and virtual-slides/manifest.json —
// see src/shared/config/ihc-data.ts and the CLAUDE.md "Caching" rule.
const DATA_BASE = "https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev";

export const KNOWLEDGE_GRAPH_MANIFEST_URL = `${DATA_BASE}/knowledge-graph/manifest.json`;

// FALLBACK: the legacy fixed key, rewritten on every publish, used only when the
// manifest cannot be read. Safe to leave stale — a degraded-mode backstop.
export const KNOWLEDGE_GRAPH_URL = `${DATA_BASE}/knowledge-graph/cloud-v1.bin.br`;

/**
 * The hero's own, much sparser snapshot.
 *
 * The landing page draws a backdrop, not a map: it is ghosted behind body copy
 * at about half the viewport, nothing in it is read, and nothing in it is
 * clicked. It does not need all 8,930 nodes and 26,552 edges -- and every one
 * of them is paid for on every frame, in the projection pass, the label
 * candidate pass, the magnet scan and the line rasteriser. Cut to the
 * best-connected fifteen hundred it is the same cloud, visibly, at a fraction
 * of the per-frame cost.
 *
 * The explorer keeps the full graph; there the nodes are the point.
 */
export const KNOWLEDGE_GRAPH_HERO_URL = `${DATA_BASE}/knowledge-graph/hero-v1.bin.br`;

const resolver = createManifestResolver(KNOWLEDGE_GRAPH_MANIFEST_URL, {
  cloud: KNOWLEDGE_GRAPH_URL,
  hero: KNOWLEDGE_GRAPH_HERO_URL,
});

/** Which baked snapshot to draw. Both live under the same manifest. */
export type SnapshotVariant = "cloud" | "hero";

/**
 * Resolve the live snapshot URL from the manifest, falling back to the compiled
 * URL if it is unreachable.
 */
export async function resolveKnowledgeGraphUrl(variant: SnapshotVariant = "cloud"): Promise<{
  url: string;
  manifest: R2Manifest | null;
}> {
  const { urls, manifest } = await resolver();
  return { url: urls[variant], manifest };
}
