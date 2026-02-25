// src/features/admin/dashboard/hooks/use-dashboard-data.ts
"use client";

import useSWR from "swr";
import { UserRole } from "@/shared/utils/auth/auth-helpers";
import { clientDashboardService } from "@/features/admin/dashboard/services/client-service";
import { DashboardStats, RecentActivity } from "@/features/admin/dashboard/services/service";

/**
 * Hook for fetching dashboard statistics
 *
 * Simplified from original implementation:
 * - Uses SWR for automatic caching, revalidation, and error handling
 * - No manual state management needed
 * - Automatic retry on errors
 * - Deduplicates parallel requests
 *
 * @param enabled - Whether to enable the query (wait for dependencies)
 */
export function useDashboardStats(enabled = true) {
  const { data, error, isLoading, mutate } = useSWR<DashboardStats>(
    // Key: only fetch when enabled
    enabled ? "dashboard-stats" : null,
    async () => {
      console.log("[useDashboardStats] Fetching stats...");
      const stats = await clientDashboardService.getDashboardStats();
      console.log("[useDashboardStats] ✅ Stats loaded");
      return stats;
    },
    {
      // Cache for 30 seconds, then revalidate in background
      dedupingInterval: 30000,
      // Revalidate when window regains focus
      revalidateOnFocus: true,
      // Retry on error with exponential backoff
      errorRetryCount: 3,
      errorRetryInterval: 1000,
      // Keep previous data while revalidating
      keepPreviousData: true,
    }
  );

  return {
    stats: data ?? null,
    isLoading: enabled && isLoading,
    error: error ? (error instanceof Error ? error.message : "Failed to load stats") : null,
    refresh: mutate,
  };
}

/**
 * Hook for fetching recent activities based on user role
 *
 * Simplified from original implementation:
 * - Uses SWR for caching and automatic revalidation
 * - Waits for both role and userId to be ready before fetching
 * - Properly handles role changes by updating the cache key
 * - No stale closure issues - role and userId are part of the key
 *
 * @param role - User role for filtering activities
 * @param userId - User ID for creator/reviewer filtering
 * @param enabled - Whether to enable the query
 */
export function useDashboardActivities(
  role: UserRole | null | undefined,
  userId: string | undefined,
  enabled = true
) {
  // Only create cache key when we have role (userId optional depending on role)
  const shouldFetch = enabled && role !== null && role !== undefined;

  // Cache key includes role and userId to properly handle changes
  // This prevents stale data when switching roles
  const cacheKey = shouldFetch ? `dashboard-activities-${role}-${userId ?? "no-user"}` : null;

  const { data, error, isLoading, mutate } = useSWR<RecentActivity[]>(
    cacheKey,
    async () => {
      console.log("[useDashboardActivities] Fetching activities for role:", role, "userId:", userId);
      const activities = await clientDashboardService.getRecentActivity(role, userId);
      console.log("[useDashboardActivities] ✅ Activities loaded:", activities.length);
      return activities;
    },
    {
      // Cache for 15 seconds - activities change more frequently
      dedupingInterval: 15000,
      revalidateOnFocus: true,
      errorRetryCount: 3,
      errorRetryInterval: 1000,
      keepPreviousData: true,
    }
  );

  return {
    activities: data ?? null,
    isLoading: shouldFetch && isLoading,
    error: error ? (error instanceof Error ? error.message : "Failed to load activities") : null,
    refresh: mutate,
  };
}

/**
 * Combined hook for fetching all dashboard data
 *
 * This hook simplifies the dashboard page by:
 * - Coordinating both stats and activities fetches
 * - Providing a single loading state
 * - Handling dependencies properly (waits for role before fetching)
 * - Eliminating race conditions through explicit enabled flags
 *
 * @param role - User role from useUserRole
 * @param userId - User ID from useAuthContext
 * @param roleLoading - Whether role is still loading
 */
export function useDashboardData(
  role: UserRole | null | undefined,
  userId: string | undefined,
  roleLoading: boolean
) {
  // Only fetch when we have a user and role is loaded
  // This prevents the race condition on first load
  const enabled = !roleLoading && role !== null && role !== undefined && !!userId;

  const statsQuery = useDashboardStats(enabled);
  const activitiesQuery = useDashboardActivities(role, userId, enabled);

  // Combined loading: both must complete
  const isLoading = statsQuery.isLoading || activitiesQuery.isLoading;

  // Combined error: show first error encountered
  const error = statsQuery.error || activitiesQuery.error;

  // Both data sets available
  const isReady = statsQuery.stats !== null && activitiesQuery.activities !== null;

  return {
    // Data
    stats: statsQuery.stats,
    activities: activitiesQuery.activities,

    // States
    isLoading,
    isReady,
    error,

    // Refresh functions
    refreshStats: statsQuery.refresh,
    refreshActivities: activitiesQuery.refresh,
    refreshAll: () => {
      statsQuery.refresh();
      activitiesQuery.refresh();
    },
  };
}
