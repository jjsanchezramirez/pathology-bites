// src/shared/services/lottie-cache-service.ts
// Service for caching Lottie animation JSON data using unified cache

import { unifiedCache, CACHE_NAMESPACES } from "./unified-cache";

/**
 * Lottie Animation Cache Service
 * Caches Lottie JSON animations using the unified cache system
 */
class LottieCacheService {

  /**
   * Get Lottie animation from cache
   * Returns null if not found or expired
   */
  public get(animationType: string): unknown | null {
    return unifiedCache.get(CACHE_NAMESPACES.LOTTIE.name, animationType);
  }

  /**
   * Store Lottie animation in cache
   */
  public set(animationType: string, data: unknown): void {
    unifiedCache.set(CACHE_NAMESPACES.LOTTIE.name, animationType, data);
  }

  /**
   * Delete a specific animation from cache
   */
  public delete(animationType: string): void {
    unifiedCache.delete(CACHE_NAMESPACES.LOTTIE.name, animationType);
  }

  /**
   * Clean up expired or old version cache entries
   */
  public cleanup(): void {
    unifiedCache.cleanup(CACHE_NAMESPACES.LOTTIE.name);
  }

  /**
   * Clear all Lottie cache entries
   */
  public clearAll(): void {
    unifiedCache.clearNamespace(CACHE_NAMESPACES.LOTTIE.name);
  }
}

// Export singleton instance
export const lottieCacheService = new LottieCacheService();
