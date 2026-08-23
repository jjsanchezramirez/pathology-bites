// src/shared/config/r2-manifest.ts
//
// One implementation of the manifest-pointer rule in CLAUDE.md ("Caching"):
// a rebuildable R2 dataset is published as an immutable, content-addressed
// object plus a small mutable `manifest.json`, and the app resolves live URLs
// from that manifest at runtime so a republish needs no redeploy.
//
// Before this existed the logic was written twice (virtual-slides inline in its
// loader, IHC in its own config) and was about to be written four more times.
//
// Manifest shape, written by publishVersioned() in dev/resources/scrapers/r2_common.mjs:
//   { <key>: { url, hash, bytes }, ...arbitrary metadata }

export type ManifestEntry = { url: string; hash: string; bytes?: number };
export type R2Manifest = Record<string, ManifestEntry | unknown>;

export type Resolved<K extends string> = {
  urls: Record<K, string>;
  manifest: R2Manifest | null;
};

const isEntry = (v: unknown): v is ManifestEntry =>
  !!v && typeof v === "object" && typeof (v as ManifestEntry).url === "string";

/**
 * Build a resolver for one dataset family.
 *
 * `fallbacks` maps a manifest key to the URL compiled into the app. Those are
 * used only when the manifest is unreachable or malformed — a degraded mode
 * that must never block the page, which is why the fetch is time-boxed and
 * every failure path returns the fallbacks rather than throwing.
 *
 * The returned function caches at module level and de-dupes concurrent calls,
 * so the manifest is fetched at most once per session however many components
 * ask for it.
 */
export function createManifestResolver<K extends string>(
  manifestUrl: string,
  fallbacks: Record<K, string>,
  opts: { timeoutMs?: number } = {}
): () => Promise<Resolved<K>> {
  const timeoutMs = opts.timeoutMs ?? 4000;
  let cached: Resolved<K> | null = null;
  let inflight: Promise<Resolved<K>> | null = null;

  return function resolve(): Promise<Resolved<K>> {
    if (cached) return Promise.resolve(cached);
    if (inflight) return inflight;

    inflight = (async (): Promise<Resolved<K>> => {
      const degraded: Resolved<K> = { urls: { ...fallbacks }, manifest: null };
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const res = await fetch(manifestUrl, {
          cache: "no-cache",
          signal: controller.signal,
        }).finally(() => clearTimeout(timer));
        if (!res.ok) {
          cached = degraded;
          return degraded;
        }
        const manifest = (await res.json()) as R2Manifest;
        const urls = { ...fallbacks };
        for (const key of Object.keys(fallbacks) as K[]) {
          const entry = manifest?.[key];
          if (isEntry(entry)) urls[key] = entry.url;
        }
        const resolved: Resolved<K> = { urls, manifest: manifest ?? null };
        cached = resolved;
        return resolved;
      } catch {
        // unreachable, aborted, or malformed JSON — serve the compiled URLs
        cached = degraded;
        return degraded;
      }
    })();

    return inflight;
  };
}
