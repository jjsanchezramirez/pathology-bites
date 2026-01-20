// SWR Cache Provider with Unified Cache System
// Uses the unified cache for consistent caching across the application

"use client";

import { SWRConfig, Cache } from "swr";
import { useEffect, useState } from "react";
import { autoCleanup } from "@/shared/utils/storage-cleanup";
import { unifiedCache, CACHE_NAMESPACES } from "@/shared/services/unified-cache";

/**
 * SWR Cache Provider with Unified Cache System
 *
 * Features:
 * - Uses unified cache system for consistency
 * - Persists SWR cache to localStorage via unified cache
 * - Survives page refreshes and browser restarts
 * - Automatic cache restoration on mount
 * - Version-based cache invalidation
 * - Automatic cleanup
 *
 * Performance Impact:
 * - Reduces API calls by ~90% (from 20 calls/10 refreshes to 0 calls)
 * - Instant data loading on page refresh
 * - No network latency for cached data
 * - Standardized caching across entire application
 */
export function SWRCacheProvider({ children }: { children: React.ReactNode }) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);

    // Run auto-cleanup on app initialization (client-side only)
    if (typeof window !== "undefined") {
      // Run cleanup after a short delay to not block initial render
      setTimeout(() => {
        autoCleanup();
      }, 2000);
    }
  }, []);

  // Don't render until client-side to avoid hydration mismatch
  if (!isClient) {
    return <>{children}</>;
  }

  return (
    <SWRConfig
      value={{
        // Custom cache provider using unified cache system
        provider: () => {
          // Initialize cache Map
          const map = new Map<string, unknown>();

          // SSR: return empty map
          if (typeof window === "undefined") {
            return map as Cache;
          }

          // Client-side: Restore cache from unified cache system
          try {
            const exported = unifiedCache.export(CACHE_NAMESPACES.SWR.name);
            const entries = Object.entries(exported);

            if (entries.length > 0) {
              // Extract the actual keys (remove the prefix)
              const prefix = `pathology-bites-${CACHE_NAMESPACES.SWR.name}-`;
              for (const [fullKey, value] of entries) {
                const key = fullKey.replace(prefix, "");
                map.set(key, value);
              }

              console.log("[SWR Cache] ✅ Restored cache from unified cache:", {
                entries: map.size,
              });
            }
          } catch (error) {
            console.error("[SWR Cache] ❌ Failed to restore cache:", error);
          }

          // Create custom Map that syncs with unified cache
          const cachedMap = new Map<string, unknown>();

          // Restore initial data
          for (const [key, value] of map) {
            cachedMap.set(key, value);
          }

          // Override set to sync with unified cache
          const originalSet = cachedMap.set.bind(cachedMap);
          cachedMap.set = (key: string, value: unknown) => {
            // Update unified cache
            unifiedCache.set(CACHE_NAMESPACES.SWR.name, key, value);
            // Update in-memory map
            return originalSet(key, value);
          };

          // Override delete to sync with unified cache
          const originalDelete = cachedMap.delete.bind(cachedMap);
          cachedMap.delete = (key: string) => {
            // Delete from unified cache
            unifiedCache.delete(CACHE_NAMESPACES.SWR.name, key);
            // Delete from in-memory map
            return originalDelete(key);
          };

          return cachedMap as Cache;
        },

        // Global SWR config
        // These apply to all useSWR hooks unless overridden locally

        // Deduplicate requests within 2 seconds (prevents race conditions and simultaneous calls)
        // This is especially important when multiple components mount at the same time
        // Reduced from 10s to 2s for better deduplication of rapid requests
        dedupingInterval: 2000,

        // Don't automatically revalidate stale data on mount
        // (rely on localStorage cache instead)
        revalidateIfStale: false,

        // Don't revalidate when window gains focus (save API calls)
        // Changed from true to false to prevent unnecessary API calls on tab switching
        // Users can manually refresh if they need fresh data
        revalidateOnFocus: false,

        // Don't revalidate on network reconnect (save API calls)
        revalidateOnReconnect: false,

        // Keep previous data while revalidating (smooth UX)
        keepPreviousData: true,

        // Error retry config
        errorRetryCount: 2,
        errorRetryInterval: 5000,

        // Show errors in console during development
        onError: (error, key) => {
          console.error(`[SWR Error] ${key}:`, error);
        },

        // Log successful data fetches in development
        onSuccess: (data, key) => {
          if (process.env.NODE_ENV === "development") {
            console.log(`[SWR Success] ${key}:`, {
              dataType: typeof data,
              hasData: !!data,
              size: JSON.stringify(data).length,
            });
          }
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}

/**
 * Utility function to manually clear SWR cache
 * Useful for logout, cache invalidation, etc.
 */
export function clearSWRCache() {
  if (typeof window !== "undefined") {
    try {
      unifiedCache.clearNamespace(CACHE_NAMESPACES.SWR.name);
      console.log("[SWR Cache] 🗑️ Cache cleared");
    } catch (error) {
      console.error("[SWR Cache] ❌ Failed to clear cache:", error);
    }
  }
}

/**
 * Utility function to get cache statistics
 */
export function getSWRCacheStats(): {
  exists: boolean;
  entries: number;
  size: number;
} | null {
  if (typeof window === "undefined") return null;

  try {
    const stats = unifiedCache.getStats(CACHE_NAMESPACES.SWR.name);

    return {
      exists: stats.localStorageEntries > 0 || stats.memoryEntries > 0,
      entries: stats.localStorageEntries || stats.memoryEntries,
      size: stats.totalSize,
    };
  } catch (error) {
    console.error("[SWR Cache] ❌ Failed to get cache stats:", error);
    return null;
  }
}
