// src/shared/hooks/use-smart-gene-lookup.ts
/**
 * Smart caching hook for gene lookup
 * Minimizes API calls with intelligent client-side caching
 */

import { useState, useCallback } from "react";
import {
  getCachedItem,
  setCachedItem,
  clearToolCache,
  getCacheStats as getPublicToolsCacheStats,
  getRecentItems,
} from "@/shared/utils/cache/public-tools-cache";

interface GeneInfo {
  hgncId: string;
  geneName: string;
  geneProduct: string;
  previousNames: string[];
  aliasSymbols: string[];
  chromosomeLocation: string;
  description: string;
}

interface UseSmartGeneLookupResult {
  lookupGene: (symbol: string) => Promise<GeneInfo>;
  isLoading: boolean;
  error: string | null;
  clearCache: () => void;
  getCacheStats: () => { size: number };
  getRecentGenes: (limit?: number) => Array<{ key: string; data: GeneInfo; timestamp: number }>;
}

export function useSmartGeneLookup(): UseSmartGeneLookupResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Normalize gene symbol for consistent caching
  const normalizeSymbol = useCallback((symbol: string): string => {
    return symbol.trim().toUpperCase();
  }, []);

  const lookupGene = useCallback(
    async (symbol: string): Promise<GeneInfo> => {
      if (!symbol.trim()) {
        throw new Error("Gene symbol cannot be empty");
      }

      setIsLoading(true);
      setError(null);

      try {
        const normalizedSymbol = normalizeSymbol(symbol);
        const cacheKey = normalizedSymbol;

        // Check cache first
        const cached = getCachedItem<GeneInfo>("milan", cacheKey);
        if (cached) {
          console.log(`🎯 Gene cache hit: ${normalizedSymbol}`);
          setIsLoading(false);
          setError(null);
          return cached;
        }

        // Cache miss - fetch from API
        console.log(`🔄 Gene cache miss: ${normalizedSymbol}`);
        const response = await fetch(
          `/api/public/tools/milan?symbol=${encodeURIComponent(symbol.trim())}`
        );
        const result = await response.json();

        if (!response.ok) {
          const errorMessage = result.error || "Failed to fetch gene information";
          setError(errorMessage);
          return Promise.reject(errorMessage); // Return rejected promise without throwing to console
        }

        const geneInfo = result.data;

        // Save to cache
        setCachedItem("milan", cacheKey, geneInfo);
        console.log(`✅ Gene cached: ${normalizedSymbol}`);

        // Clear any previous errors on successful lookup
        setError(null);

        return geneInfo;
      } catch (err) {
        // Error already set above, don't set it again to prevent flashing
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [normalizeSymbol]
  );

  const clearCache = useCallback(() => {
    clearToolCache("milan");
  }, []);

  const getCacheStats = useCallback(() => {
    return getPublicToolsCacheStats("milan");
  }, []);

  const getRecentGenes = useCallback((limit: number = 10) => {
    return getRecentItems<GeneInfo>("milan", limit);
  }, []);

  // Initialize pre-loading of common genes after user interaction
  // Disabled to prevent interference with user searches
  // useEffect(() => {
  //   initializePreloading(lookupGene, {
  //     maxGenes: 8, // Conservative number for background loading
  //     batchSize: 2,
  //     delayBetweenBatches: 3000 // 3 second delays
  //   })
  // }, [lookupGene])

  return {
    lookupGene,
    isLoading,
    error,
    clearCache,
    getCacheStats,
    getRecentGenes,
  };
}
