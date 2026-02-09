/**
 * Unified Cache System
 *
 * A centralized caching solution that consolidates all caching needs across the application.
 * Uses localStorage as primary storage with memory fallback.
 *
 * Key Features:
 * - Standardized key prefixing: pathology-bites-{namespace}-{key}
 * - Multiple namespaces for different data types
 * - Automatic TTL and version management
 * - Graceful fallback to memory cache
 * - Request deduplication
 * - Automatic cleanup
 */

// Cache configuration
const CACHE_PREFIX = "pathology-bites";
const CACHE_VERSION = "v1";

// Namespace configurations with default TTLs
// Simplified: Only store what can't be handled by HTTP browser cache
export const CACHE_NAMESPACES = {
  SWR: { name: "swr", ttl: 30 * 24 * 60 * 60 * 1000 }, // 30 days - All cached data (SWR + custom)
  COOKIE: { name: "cookie", ttl: 30 * 24 * 60 * 60 * 1000 }, // 30 days - consent preferences
} as const;

export type CacheNamespace = (typeof CACHE_NAMESPACES)[keyof typeof CACHE_NAMESPACES]["name"];

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  version: string;
}

interface CacheOptions {
  ttl?: number; // Override default TTL
  version?: string; // Override default version
}

/**
 * Unified Cache Service
 * Singleton service that manages all caching across the application
 */
class UnifiedCacheService {
  private static instance: UnifiedCacheService;
  private memoryCache: Map<string, CacheEntry<unknown>> = new Map();
  private pendingRequests: Map<string, Promise<unknown>> = new Map();
  private isLocalStorageAvailable: boolean;
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Check localStorage availability
    this.isLocalStorageAvailable = this.checkLocalStorageAvailability();

    // Cleanup interval disabled - most caches are indefinite
    // Run cleanup only on initialization to clean up old versions
    if (typeof window !== "undefined") {
      // Run once on initialization
      this.cleanup();
    }

    // Restore SWR cache from localStorage on initialization
    if (this.isLocalStorageAvailable) {
      this.restoreMemoryCache();
    }
  }

  public static getInstance(): UnifiedCacheService {
    if (!UnifiedCacheService.instance) {
      UnifiedCacheService.instance = new UnifiedCacheService();
    }
    return UnifiedCacheService.instance;
  }

  /**
   * Check if localStorage is available
   */
  private checkLocalStorageAvailability(): boolean {
    if (typeof window === "undefined") return false;

    try {
      const testKey = `${CACHE_PREFIX}-test`;
      localStorage.setItem(testKey, "test");
      localStorage.removeItem(testKey);
      return true;
    } catch {
      console.warn("[UnifiedCache] localStorage not available, using memory cache only");
      return false;
    }
  }

  /**
   * Generate cache key with standardized format
   */
  private getCacheKey(namespace: CacheNamespace, key: string): string {
    return `${CACHE_PREFIX}-${namespace}-${key}`;
  }

  /**
   * Get default TTL for namespace
   */
  private getDefaultTTL(namespace: CacheNamespace): number {
    const config = Object.values(CACHE_NAMESPACES).find((ns) => ns.name === namespace);
    return config?.ttl ?? 5 * 60 * 1000; // Default 5 minutes
  }

  /**
   * Set cache entry
   */
  public set<T>(namespace: CacheNamespace, key: string, data: T, options: CacheOptions = {}): void {
    const cacheKey = this.getCacheKey(namespace, key);
    const ttl = options.ttl ?? this.getDefaultTTL(namespace);
    const version = options.version ?? CACHE_VERSION;

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      version,
    };

    // Always set in memory cache
    this.memoryCache.set(cacheKey, entry);

    // Try to set in localStorage
    if (this.isLocalStorageAvailable) {
      try {
        localStorage.setItem(cacheKey, JSON.stringify(entry));
      } catch (error) {
        console.warn(`[UnifiedCache] Failed to store ${cacheKey} in localStorage:`, error);
        // If quota exceeded, try cleanup and retry once
        if (error instanceof Error && error.name === "QuotaExceededError") {
          this.cleanup(namespace);
          try {
            localStorage.setItem(cacheKey, JSON.stringify(entry));
          } catch {
            console.warn(`[UnifiedCache] Still failed after cleanup, using memory cache only`);
          }
        }
      }
    }
  }

  /**
   * Get cache entry
   */
  public get<T>(namespace: CacheNamespace, key: string, options: CacheOptions = {}): T | null {
    const cacheKey = this.getCacheKey(namespace, key);
    const version = options.version ?? CACHE_VERSION;

    // Try memory cache first (fastest)
    let entry = this.memoryCache.get(cacheKey) as CacheEntry<T> | undefined;

    // If not in memory, try localStorage
    if (!entry && this.isLocalStorageAvailable) {
      try {
        const stored = localStorage.getItem(cacheKey);
        if (stored) {
          entry = JSON.parse(stored) as CacheEntry<T>;
          // Restore to memory cache for faster subsequent access
          if (entry) {
            this.memoryCache.set(cacheKey, entry);
          }
        }
      } catch (error) {
        console.warn(`[UnifiedCache] Failed to read ${cacheKey} from localStorage:`, error);
        return null;
      }
    }

    if (!entry) {
      return null;
    }

    // Check version
    if (entry.version !== version) {
      this.delete(namespace, key);
      return null;
    }

    // Check if expired
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.delete(namespace, key);
      return null;
    }

    return entry.data;
  }

  /**
   * Delete cache entry
   */
  public delete(namespace: CacheNamespace, key: string): void {
    const cacheKey = this.getCacheKey(namespace, key);

    // Delete from memory
    this.memoryCache.delete(cacheKey);

    // Delete from localStorage
    if (this.isLocalStorageAvailable) {
      try {
        localStorage.removeItem(cacheKey);
      } catch (error) {
        console.warn(`[UnifiedCache] Failed to delete ${cacheKey} from localStorage:`, error);
      }
    }
  }

  /**
   * Clear all cache entries for a namespace
   */
  public clearNamespace(namespace: CacheNamespace): void {
    const prefix = `${CACHE_PREFIX}-${namespace}-`;

    // Clear from memory cache
    for (const [key] of this.memoryCache) {
      if (key.startsWith(prefix)) {
        this.memoryCache.delete(key);
      }
    }

    // Clear from localStorage
    if (this.isLocalStorageAvailable) {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(prefix)) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key));
        console.log(
          `[UnifiedCache] Cleared ${keysToRemove.length} entries from ${namespace} namespace`
        );
      } catch (error) {
        console.warn(`[UnifiedCache] Failed to clear namespace ${namespace}:`, error);
      }
    }
  }

  /**
   * Clear all cache entries
   */
  public clearAll(): void {
    // Clear memory cache
    this.memoryCache.clear();

    // Clear localStorage - only remove keys belonging to known cache namespaces
    // to avoid deleting non-cache keys like 'pathology-bites-theme' (from next-themes)
    if (this.isLocalStorageAvailable) {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key) continue;
          const isKnownCacheKey = Object.values(CACHE_NAMESPACES).some((ns) =>
            key.startsWith(`${CACHE_PREFIX}-${ns.name}-`)
          );
          if (isKnownCacheKey) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key));
        console.log(`[UnifiedCache] Cleared ${keysToRemove.length} total cache entries`);
      } catch (error) {
        console.warn("[UnifiedCache] Failed to clear all caches:", error);
      }
    }
  }

  /**
   * Clean up expired entries
   */
  public cleanup(namespace?: CacheNamespace): void {
    const now = Date.now();
    let cleanedCount = 0;

    // When no namespace specified, build prefixes for all known namespaces
    // to avoid matching non-cache keys like 'pathology-bites-theme' (from next-themes)
    const prefixes = namespace
      ? [`${CACHE_PREFIX}-${namespace}-`]
      : Object.values(CACHE_NAMESPACES).map((ns) => `${CACHE_PREFIX}-${ns.name}-`);

    const matchesPrefix = (key: string) => prefixes.some((p) => key.startsWith(p));

    // Cleanup memory cache
    for (const [key, entry] of this.memoryCache) {
      if (matchesPrefix(key) && now - entry.timestamp > entry.ttl) {
        this.memoryCache.delete(key);
        cleanedCount++;
      }
    }

    // Cleanup localStorage
    if (this.isLocalStorageAvailable) {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const storageKey = localStorage.key(i);
          if (!storageKey || !matchesPrefix(storageKey)) continue;

          try {
            const stored = localStorage.getItem(storageKey);
            if (!stored) continue;

            const entry = JSON.parse(stored) as CacheEntry<unknown>;
            // Remove if expired or wrong version
            if (entry.version !== CACHE_VERSION || now - entry.timestamp > entry.ttl) {
              keysToRemove.push(storageKey);
            }
          } catch {
            // Only remove if key matches a known cache namespace pattern.
            // Don't remove non-cache keys like 'pathology-bites-theme' (from next-themes)
            // that happen to share the same prefix but aren't JSON CacheEntry objects.
            const isKnownCacheKey = Object.values(CACHE_NAMESPACES).some((ns) =>
              storageKey.startsWith(`${CACHE_PREFIX}-${ns.name}-`)
            );
            if (isKnownCacheKey) {
              keysToRemove.push(storageKey);
            }
          }
        }

        keysToRemove.forEach((key) => localStorage.removeItem(key));
        cleanedCount += keysToRemove.length;
      } catch (error) {
        console.warn("[UnifiedCache] Cleanup failed:", error);
      }
    }

    if (cleanedCount > 0) {
      console.log(`[UnifiedCache] Cleaned up ${cleanedCount} expired entries`);
    }
  }

  /**
   * Deduplicate concurrent requests for the same key
   */
  public async dedupe<T>(
    namespace: CacheNamespace,
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cacheKey = this.getCacheKey(namespace, key);

    // If there's already a pending request for this key, return it
    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey) as Promise<T>;
    }

    // Create new request
    const promise = fetcher()
      .then((data) => {
        // Cache the result
        this.set(namespace, key, data, options);
        return data;
      })
      .finally(() => {
        // Clean up pending request
        this.pendingRequests.delete(cacheKey);
      });

    // Store pending request
    this.pendingRequests.set(cacheKey, promise);

    return promise;
  }

  /**
   * Restore memory cache from localStorage
   * Used during initialization to warm up memory cache
   */
  private restoreMemoryCache(): void {
    if (!this.isLocalStorageAvailable) return;

    try {
      let restoredCount = 0;
      const now = Date.now();

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(CACHE_PREFIX)) continue;

        try {
          const stored = localStorage.getItem(key);
          if (!stored) continue;

          const entry = JSON.parse(stored) as CacheEntry<unknown>;

          // Only restore if valid and not expired
          if (entry.version === CACHE_VERSION && now - entry.timestamp <= entry.ttl) {
            this.memoryCache.set(key, entry);
            restoredCount++;
          }
        } catch {
          // Skip invalid entries
        }
      }

      if (restoredCount > 0) {
        console.log(`[UnifiedCache] Restored ${restoredCount} cache entries to memory`);
      }
    } catch (error) {
      console.warn("[UnifiedCache] Failed to restore memory cache:", error);
    }
  }

  /**
   * Get cache statistics
   */
  public getStats(namespace?: CacheNamespace): {
    memoryEntries: number;
    localStorageEntries: number;
    totalSize: number;
  } {
    const prefix = namespace ? `${CACHE_PREFIX}-${namespace}-` : CACHE_PREFIX;
    let memoryEntries = 0;
    let localStorageEntries = 0;
    let totalSize = 0;

    // Count memory entries
    for (const [key] of this.memoryCache) {
      if (key.startsWith(prefix)) {
        memoryEntries++;
      }
    }

    // Count localStorage entries
    if (this.isLocalStorageAvailable) {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(prefix)) {
            localStorageEntries++;
            const value = localStorage.getItem(key);
            if (value) {
              totalSize += new Blob([value]).size;
            }
          }
        }
      } catch {
        // Ignore errors
      }
    }

    return {
      memoryEntries,
      localStorageEntries,
      totalSize,
    };
  }

  /**
   * Export all cache data for a namespace (useful for debugging)
   */
  public export(namespace?: CacheNamespace): Record<string, unknown> {
    const prefix = namespace ? `${CACHE_PREFIX}-${namespace}-` : CACHE_PREFIX;
    const exported: Record<string, unknown> = {};

    if (!this.isLocalStorageAvailable) {
      // Export from memory cache only
      for (const [key, entry] of this.memoryCache) {
        if (key.startsWith(prefix)) {
          exported[key] = entry.data;
        }
      }
    } else {
      // Export from localStorage
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(prefix)) {
            const stored = localStorage.getItem(key);
            if (stored) {
              try {
                const entry = JSON.parse(stored) as CacheEntry<unknown>;
                exported[key] = entry.data;
              } catch {
                // Skip invalid entries
              }
            }
          }
        }
      } catch {
        // Fallback to memory cache
        for (const [key, entry] of this.memoryCache) {
          if (key.startsWith(prefix)) {
            exported[key] = entry.data;
          }
        }
      }
    }

    return exported;
  }

  /**
   * Cleanup on destroy
   */
  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Export singleton instance
export const unifiedCache = UnifiedCacheService.getInstance();

// Export types
export type { CacheEntry, CacheOptions };
