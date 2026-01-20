// src/shared/services/lottie-cache-service.ts
// Service for caching Lottie animation JSON data using unified cache
// All animations stored in a single cache entry: pathology-bites-lottie

import { unifiedCache, CACHE_NAMESPACES } from "./unified-cache";

// Single cache key for all lottie animations
const LOTTIE_CACHE_KEY = "all-animations";

interface LottieAnimationsCache {
  [animationType: string]: unknown;
}

/**
 * Lottie Animation Cache Service
 * Caches all Lottie JSON animations in a single unified cache entry
 */
class LottieCacheService {
  /**
   * Get all animations from cache
   */
  private getAllAnimations(): LottieAnimationsCache {
    const cached = unifiedCache.get<LottieAnimationsCache>(
      CACHE_NAMESPACES.LOTTIE.name,
      LOTTIE_CACHE_KEY
    );
    return cached || {};
  }

  /**
   * Save all animations to cache
   */
  private saveAllAnimations(animations: LottieAnimationsCache): void {
    unifiedCache.set(CACHE_NAMESPACES.LOTTIE.name, LOTTIE_CACHE_KEY, animations);
  }

  /**
   * Get Lottie animation from cache
   * Returns null if not found or expired
   */
  public get(animationType: string): unknown | null {
    const allAnimations = this.getAllAnimations();
    return allAnimations[animationType] || null;
  }

  /**
   * Store Lottie animation in cache
   */
  public set(animationType: string, data: unknown): void {
    const allAnimations = this.getAllAnimations();
    allAnimations[animationType] = data;
    this.saveAllAnimations(allAnimations);
  }

  /**
   * Delete a specific animation from cache
   */
  public delete(animationType: string): void {
    const allAnimations = this.getAllAnimations();
    delete allAnimations[animationType];
    this.saveAllAnimations(allAnimations);
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

  /**
   * Get cache statistics
   */
  public getStats(): { animationCount: number; animationNames: string[] } {
    const allAnimations = this.getAllAnimations();
    return {
      animationCount: Object.keys(allAnimations).length,
      animationNames: Object.keys(allAnimations),
    };
  }
}

// Export singleton instance
export const lottieCacheService = new LottieCacheService();
