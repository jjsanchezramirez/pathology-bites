"use client";

import { useEffect } from "react";
import { useSWRConfig } from "swr";
import { initializeCacheSystem } from "@/shared/utils/cache/cache-migration";

/**
 * Cache Initializer Component
 *
 * Runs cache cleanup and migration on app startup.
 * This component is mounted in the root layout.
 *
 * We use the bound `mutate` from `useSWRConfig()` rather than the global `mutate`
 * import. The custom SWRConfig provider in swr-cache-provider.tsx creates an
 * isolated cache instance; the global mutate would target SWR's default cache
 * (which the app doesn't use) and silently no-op.
 */
export function CacheInitializer() {
  const { mutate } = useSWRConfig();

  useEffect(() => {
    // Run cache initialization once on mount; pass the provider-scoped mutate so
    // version-gated cache invalidations actually reach the active SWR cache.
    initializeCacheSystem(mutate);
  }, [mutate]);

  // This component doesn't render anything
  return null;
}
