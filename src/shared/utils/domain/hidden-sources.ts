// src/shared/utils/domain/hidden-sources.ts
//
// Manifest-driven hiding of slide sources. The corpus pipeline's daily liveness probe
// (pathology-bites-corpus: check_liveness.mjs → corpus_health.mjs → publish_corpus.mjs)
// writes a source's health into virtual-slides/manifest.json and lists the ones whose
// slides no longer open:
//
//   {
//     ...,
//     sources: { mgh: { prefix: "mgh_", status: "down", hidden: true, ... }, ... },
//     hidden_sources: ["mgh"],
//   }
//
// The records themselves stay in the corpus (so the publish count-gate is unaffected and
// recovery is a manifest flip, no rebuild), which is why the app has to do the hiding.
// A source is recognised by the id prefix the manifest declares for it — the site never
// guesses a prefix from the source name, so a source without a `prefix` entry is left
// visible rather than hidden by a wrong match.
//
// This is the second of two independent hide switches. The first is the hard-coded
// HIDDEN_REPOS list in ./repository.ts (a human decision, effective on the next deploy);
// this one is the crawler's (effective on the next manifest publish, no deploy). A slide
// is hidden if EITHER says so.

export type SourceHealthEntry = {
  prefix?: string | null;
  hidden?: boolean;
  status?: string;
};

type ManifestWithHealth = {
  hidden_sources?: unknown;
  sources?: Record<string, SourceHealthEntry | unknown>;
};

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object";

/**
 * The slide-id prefixes the manifest marks as hidden, de-duplicated, in manifest order.
 *
 * Reads `hidden_sources` and, as the same signal written per source, `sources[s].hidden`.
 * Tolerates every shape the app may meet: no manifest (degraded mode), a pre-health
 * manifest (neither field present), a hidden source with no `prefix` (skipped), and
 * junk in either field (ignored). Never throws.
 */
export function hiddenSlidePrefixesFromManifest(manifest: unknown): string[] {
  if (!isRecord(manifest)) return [];
  const { hidden_sources, sources } = manifest as ManifestWithHealth;
  const health = isRecord(sources) ? sources : {};

  const names: string[] = [];
  if (Array.isArray(hidden_sources)) {
    for (const s of hidden_sources) if (typeof s === "string") names.push(s);
  }
  for (const [name, entry] of Object.entries(health)) {
    if (isRecord(entry) && entry.hidden === true) names.push(name);
  }

  const prefixes: string[] = [];
  for (const name of names) {
    const entry = health[name];
    const prefix = isRecord(entry) ? entry.prefix : undefined;
    if (typeof prefix !== "string" || prefix.length === 0) continue;
    if (!prefixes.includes(prefix)) prefixes.push(prefix);
  }
  return prefixes;
}

/** True when `id` belongs to one of the hidden sources (by declared id prefix). */
export function isHiddenSlideId(
  id: string | null | undefined,
  hiddenPrefixes: readonly string[]
): boolean {
  if (!id || hiddenPrefixes.length === 0) return false;
  for (const p of hiddenPrefixes) if (id.startsWith(p)) return true;
  return false;
}
