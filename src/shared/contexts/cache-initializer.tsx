"use client";

import { useEffect } from "react";
import { initializeCacheSystem } from "@/shared/utils/cache/cache-migration";

/**
 * Cache Initializer Component
 *
 * Runs cache cleanup and migration on app startup.
 * This component is mounted in the root layout.
 */
export function CacheInitializer() {
  useEffect(() => {
    // Run cache initialization once on mount
    initializeCacheSystem();
  }, []);

  // This component doesn't render anything
  return null;
}
