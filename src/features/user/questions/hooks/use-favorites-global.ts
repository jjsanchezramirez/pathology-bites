// src/features/user/questions/hooks/use-favorites-global.ts
"use client";

import useSWR from "swr";
import { useCallback, useRef } from "react";
import { toast } from "@/shared/utils/ui/toast";

interface FavoriteResponse {
  success: boolean;
  data: Array<{
    id: string;
    question_id: string;
    user_id: string;
    created_at: string;
  }>;
}

const FAVORITES_KEY = "/api/user/favorites";

/**
 * Fetcher function for SWR
 * Returns an array of question IDs (easier to serialize than Set)
 */
async function fetchFavorites(): Promise<string[]> {
  const response = await fetch(FAVORITES_KEY);
  if (!response.ok) {
    throw new Error("Failed to fetch favorites");
  }
  const data: FavoriteResponse = await response.json();
  return data.data?.map((fav) => fav.question_id) || [];
}

/**
 * Global hook for managing user favorites using SWR
 * Fetches once, caches globally, and shares across all components
 * Uses global SWR config (2s deduping) for consistency with rest of app
 */
export function useFavoritesGlobal() {
  // Track pending operations to prevent race conditions on rapid clicks
  const pendingOperations = useRef(new Set<string>());

  // Use bound mutate from useSWR for proper cache updates
  const {
    data: favoritesArray,
    error,
    isLoading,
    mutate: boundMutate,
  } = useSWR<string[]>(FAVORITES_KEY, fetchFavorites);

  /**
   * Check if a question is favorited
   */
  const isFavorited = useCallback(
    (questionId: string): boolean => {
      return favoritesArray?.includes(questionId) ?? false;
    },
    [favoritesArray]
  );

  /**
   * Toggle favorite status for a question
   * Prevents race conditions and uses bound mutate for reliable cache updates
   */
  const toggleFavorite = useCallback(
    async (questionId: string) => {
      if (!favoritesArray) {
        console.warn("[Favorites] Data not loaded yet, skipping toggle");
        return;
      }

      // Prevent concurrent operations on same question (race condition protection)
      if (pendingOperations.current.has(questionId)) {
        console.warn(`[Favorites] Toggle already in progress for question ${questionId}`);
        return;
      }

      // Mark operation as pending
      pendingOperations.current.add(questionId);

      const wasFavorited = favoritesArray.includes(questionId);

      // Optimistic update - update cache immediately
      const optimisticFavorites = wasFavorited
        ? favoritesArray.filter((id) => id !== questionId)
        : [...favoritesArray, questionId];

      try {
        // Update SWR cache optimistically (false = don't revalidate yet)
        await boundMutate(optimisticFavorites, false);

        // Perform API call
        const response = await fetch("/api/user/favorites", {
          method: wasFavorited ? "DELETE" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ question_id: questionId }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to update favorite");
        }

        // Revalidate to ensure consistency with server
        // With 2s deduping (global config), this will actually refetch
        await boundMutate();

        toast.success(wasFavorited ? "Removed from favorites" : "Added to favorites");
      } catch (error) {
        // Rollback on error
        await boundMutate(favoritesArray, false);
        console.error("[Favorites] Error toggling favorite:", error);
        toast.error(
          error instanceof Error ? error.message : "Failed to update favorite. Please try again."
        );
      } finally {
        // Always remove from pending operations
        pendingOperations.current.delete(questionId);
      }
    },
    [favoritesArray, boundMutate]
  );

  return {
    favorites: new Set(favoritesArray ?? []),
    isFavorited,
    toggleFavorite,
    isLoading,
    error,
  };
}
