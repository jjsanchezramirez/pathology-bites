// src/shared/hooks/use-cached-data.ts
// Hook for cached data fetching with intelligent cache management

import { useState, useEffect, useCallback, useRef } from "react";
import { cacheService, type CacheOptions } from "@/shared/services/cache-service";
import { toast } from "@/shared/utils/toast";

interface UseCachedDataOptions<T> extends CacheOptions {
  enabled?: boolean;
  refetchOnMount?: boolean;
  refetchOnWindowFocus?: boolean;
  staleTime?: number; // Time before data is considered stale (but still served from cache)
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

interface UseCachedDataResult<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  isStale: boolean;
  refetch: () => Promise<void>;
  invalidate: () => void;
}

export function useCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: UseCachedDataOptions<T> = {}
): UseCachedDataResult<T> {
  const {
    enabled = true,
    refetchOnMount = false, // Changed default to false to minimize API calls
    refetchOnWindowFocus = false,
    staleTime = 2 * 60 * 1000, // 2 minutes
    ttl = 5 * 60 * 1000, // 5 minutes
    storage = "memory",
    prefix = "pathology-bites-cache",
    onSuccess,
    onError,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(enabled); // Always start as loading to avoid hydration mismatch
  const [error, setError] = useState<Error | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [lastFetch, setLastFetch] = useState<number>(0);

  const mounted = useRef(true);
  const fetchingRef = useRef(false);

  // Fetch data with caching and deduplication
  const fetchData = useCallback(
    async (force = false) => {
      if (!enabled || fetchingRef.current) return;

      // Try to get from cache first
      if (!force) {
        // NOTE: cacheService.get() returns the data directly, not wrapped in {data, timestamp}
        const cached = cacheService.get<T>(key, { storage, prefix });
        if (cached) {
          setData(cached);
          setLastFetch(Date.now()); // Use current time since we don't have the original timestamp
          const isStaleData = false; // Consider cache hit as fresh data
          setIsStale(isStaleData);
          setError(null);

          // If data is not stale, don't fetch
          if (!isStaleData) {
            return;
          }
        }
      }

      try {
        fetchingRef.current = true;
        setIsLoading(true);
        setError(null);

        // Use deduplication to prevent concurrent requests for the same key
        const result = await cacheService.dedupe(key, fetcher, { storage, prefix });

        if (!mounted.current) return;

        const timestamp = Date.now();

        // Cache the result - cacheService.set() will wrap it with {data, timestamp, ttl, key}
        cacheService.set(
          key,
          result, // Pass data directly, not wrapped
          { ttl, storage, prefix }
        );

        setData(result);
        setLastFetch(timestamp);
        setIsStale(false);
        onSuccess?.(result);
      } catch (err) {
        if (!mounted.current) return;

        const error = err instanceof Error ? err : new Error("Fetch failed");
        setError(error);
        onError?.(error);

        // Show toast notification for errors
        const isNetworkError =
          err instanceof TypeError &&
          (err.message?.includes("fetch") || err.message?.includes("network"));

        if (isNetworkError) {
          toast.error("Network connection interrupted. Please refresh the page.");
        } else {
          // Only show generic error toast if no custom onError handler
          if (!onError) {
            toast.error("Failed to load data. Please try again.");
          }
        }
      } finally {
        if (mounted.current) {
          setIsLoading(false);
        }
        fetchingRef.current = false;
      }
    },
    [key, enabled, storage, prefix, ttl, staleTime, fetcher, onSuccess, onError]
  );

  // Create refs for stable function references
  const fetchDataRef = useRef(fetchData);
  fetchDataRef.current = fetchData;

  // Invalidate cache and refetch
  const invalidate = useCallback(() => {
    cacheService.delete(key, { storage, prefix });
    setData(null);
    setIsStale(false);
    setLastFetch(0);
    if (enabled) {
      fetchDataRef.current(true);
    }
  }, [key, storage, prefix, enabled]);

  // Refetch data
  const refetch = useCallback(async () => {
    await fetchDataRef.current(true);
  }, []);

  // Initial fetch
  useEffect(() => {
    mounted.current = true;

    if (enabled) {
      // Always try to load from cache or fetch on mount
      // NOTE: cacheService.get() returns the data directly, not wrapped in {data, timestamp}
      const cached = cacheService.get<T>(key, { storage, prefix });

      console.log("=".repeat(80));
      console.log("🔍 [USE CACHED DATA] CHECKING FOR CACHE:");
      console.log("=".repeat(80));
      console.log("[useCachedData] Mount:", { key, hasCached: !!cached, storage, prefix });

      if (cached) {
        // Use cached data immediately
        console.log("✅ [CACHE HIT] Found cached data for:", key);
        console.log("[useCachedData] Cached data structure:", {
          dataType: typeof cached,
          hasData: !!cached,
          keys: cached ? Object.keys(cached).slice(0, 5) : [],
          rawCached: cached,
        });
        console.log("=".repeat(80));
        setData(cached);
        setLastFetch(Date.now()); // Use current time since we don't have the original timestamp
        const isStaleData = false; // Consider cache hit as fresh data
        setIsStale(isStaleData);
        setError(null);
        setIsLoading(false); // Stop loading since we have cached data

        // If refetchOnMount is true and data is stale, refetch in background
        if (refetchOnMount && isStaleData) {
          fetchDataRef.current();
        }
      } else {
        // No cached data, always fetch on initial mount
        console.log("❌ [CACHE MISS] No cache found, fetching:", key);
        console.log("=".repeat(80));
        fetchDataRef.current();
      }
    }

    return () => {
      mounted.current = false;
    };
  }, [enabled, refetchOnMount, key, storage, prefix, staleTime]);

  // Window focus refetch
  useEffect(() => {
    if (!refetchOnWindowFocus || !enabled) return;

    const handleFocus = () => {
      // Only refetch if data is stale
      if (lastFetch && Date.now() - lastFetch > staleTime) {
        fetchDataRef.current();
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refetchOnWindowFocus, enabled, lastFetch, staleTime]);

  return {
    data,
    isLoading,
    error,
    isStale,
    refetch,
    invalidate,
  };
}
