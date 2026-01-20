// src/shared/hooks/use-lottie-animation.ts
// Hook for loading Lottie animations with HTTP browser cache + memory deduplication

import { useEffect, useState } from "react";

const ANIMATION_BASE_URL = "https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev/animations";

// Module-scope memory cache for request deduplication only
// HTTP browser cache handles persistence across sessions
const pendingRequests = new Map<string, Promise<unknown>>();
const memoryCache = new Map<string, unknown>();

interface UseLottieAnimationResult {
  animationData: unknown | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to load Lottie animations with automatic localStorage caching
 *
 * @param animationName - Name of the animation file (without .json extension)
 * @returns Object containing animationData, isLoading, and error states
 *
 * @example
 * const { animationData, isLoading } = useLottieAnimation('badge')
 * const { animationData } = useLottieAnimation('under_construction')
 */
export function useLottieAnimation(animationName: string): UseLottieAnimationResult {
  const [animationData, setAnimationData] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadAnimation = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Check memory cache first (same session)
        const cached = memoryCache.get(animationName);
        if (cached) {
          if (isMounted) {
            setAnimationData(cached);
            setIsLoading(false);
          }
          return;
        }

        // Check if already fetching (request deduplication)
        let fetchPromise = pendingRequests.get(animationName);

        if (!fetchPromise) {
          // Fetch from R2 - browser HTTP cache handles persistence
          fetchPromise = fetch(`${ANIMATION_BASE_URL}/${animationName}.json`, {
            cache: "force-cache", // Use browser HTTP cache
          }).then(async (response) => {
            if (!response.ok) {
              throw new Error(`Failed to load animation: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();

            // Store in memory for session
            memoryCache.set(animationName, data);
            pendingRequests.delete(animationName);

            return data;
          });

          pendingRequests.set(animationName, fetchPromise);
        }

        const data = await fetchPromise;

        if (isMounted) {
          setAnimationData(data);
          setIsLoading(false);
        }
      } catch (err) {
        console.error(`[Lottie] ❌ Error loading ${animationName}:`, err);
        pendingRequests.delete(animationName);
        const errorObj = err instanceof Error ? err : new Error("Failed to load animation");
        if (isMounted) {
          setError(errorObj);
          setIsLoading(false);
        }
      }
    };

    loadAnimation();

    return () => {
      isMounted = false;
    };
  }, [animationName]);

  return { animationData, isLoading, error };
}
