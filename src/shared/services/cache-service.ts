// src/shared/services/cache-service.ts
// DEPRECATED: This service is deprecated in favor of unified-cache.ts
// Use unifiedCache from "@/shared/services/unified-cache" instead
//
// This file is kept for backwards compatibility only
// It now wraps the unified cache system

import { unifiedCache, CACHE_NAMESPACES } from "./unified-cache";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  key: string;
}

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  storage?: "memory" | "localStorage" | "sessionStorage"; // Ignored, always uses unified cache
  prefix?: string; // Used to determine namespace
}

class CacheService {
  private static instance: CacheService;
  private defaultNamespace = CACHE_NAMESPACES.USER.name; // Default namespace for backwards compatibility

  private constructor() {
    console.warn(
      "[CacheService] DEPRECATED: cache-service.ts is deprecated. Please use unified-cache.ts instead."
    );
  }

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  // Set cache entry - now delegates to unified cache
  public set<T>(key: string, data: T, options: CacheOptions = {}): void {
    const { ttl } = options;
    unifiedCache.set(this.defaultNamespace, key, data, { ttl });
  }

  // Get cache entry - now delegates to unified cache
  public get<T>(key: string, _options: CacheOptions = {}): T | null {
    return unifiedCache.get<T>(this.defaultNamespace, key);
  }

  // Delete cache entry - now delegates to unified cache
  public delete(key: string, _options: CacheOptions = {}): void {
    unifiedCache.delete(this.defaultNamespace, key);
  }

  // Clear all cache entries - now delegates to unified cache
  public clear(_prefix?: string): void {
    unifiedCache.clearNamespace(this.defaultNamespace);
  }

  // Get cache statistics - now delegates to unified cache
  public getStats(): {
    memoryEntries: number;
    totalSize: number;
  } {
    const stats = unifiedCache.getStats(this.defaultNamespace);
    return {
      memoryEntries: stats.memoryEntries,
      totalSize: stats.totalSize,
    };
  }

  /**
   * Deduplicate concurrent requests - now delegates to unified cache
   */
  public async dedupe<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const { ttl } = options;
    return unifiedCache.dedupe(this.defaultNamespace, key, fetcher, { ttl });
  }
}

// Export singleton instance
export const cacheService = CacheService.getInstance();

// Export types
export type { CacheOptions };
