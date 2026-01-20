"use client";

import { useEffect } from "react";
import { initializeCacheSystem } from "@/shared/utils/cache-migration";
// Import cache-debug to expose debugging tools in development
import "@/shared/utils/cache-debug";

/**
 * Cache Initializer Component
 *
 * Runs cache cleanup and migration on app startup.
 * Also exposes cache debugging tools (window.cacheDebug) in development.
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
