// src/shared/hooks/use-user-settings.ts
// Cached hook for user settings with SWR

import useSWR from 'swr'
import { userSettingsService, type UserSettings } from '@/shared/services/user-settings'

interface UseUserSettingsOptions {
  enabled?: boolean
  refetchOnMount?: boolean
  onSuccess?: (data: UserSettings) => void
  onError?: (error: Error) => void
}

/**
 * Hook for user settings with SWR caching
 *
 * Features:
 * - Automatic request deduplication (no redundant calls!)
 * - 30-minute cache (consistent with unified API)
 * - Revalidate on window focus
 * - Shared across all components
 *
 * Usage:
 * ```tsx
 * const { data: settings, isLoading, mutate } = useUserSettings()
 * ```
 */
export function useUserSettings(options: UseUserSettingsOptions = {}) {
  const {
    enabled = true,
    onSuccess,
    onError
  } = options

  const { data, error, isLoading, mutate } = useSWR<UserSettings>(
    enabled ? '/api/user/settings' : null,
    async () => {
      const result = await userSettingsService.getUserSettings()
      if (onSuccess) onSuccess(result)
      return result
    },
    {
      // 30-minute cache (consistent with unified API)
      dedupingInterval: 30 * 60 * 1000,
      // Revalidate on focus
      revalidateOnFocus: true,
      // Don't revalidate on reconnect
      revalidateOnReconnect: false,
      // Keep previous data
      keepPreviousData: true,
      // Error handling
      onError,
      errorRetryCount: 1,
      errorRetryInterval: 10000,
    }
  )

  return {
    data,
    isLoading,
    error,
    refetch: mutate,
    invalidate: mutate,
  }
}

/**
 * Hook for quiz settings only (subset of user settings)
 */
export function useQuizSettings(options: UseUserSettingsOptions = {}) {
  const { data: settings, isLoading, error, refetch, invalidate } = useUserSettings(options)
  
  return {
    data: settings?.quiz_settings ?? null,
    isLoading,
    error,
    refetch,
    invalidate
  }
}

/**
 * Hook for UI settings only (subset of user settings)
 */
export function useUISettings(options: UseUserSettingsOptions = {}) {
  const { data: settings, isLoading, error, refetch, invalidate } = useUserSettings(options)
  
  return {
    data: settings?.ui_settings ?? null,
    isLoading,
    error,
    refetch,
    invalidate
  }
}

/**
 * Hook for notification settings only (subset of user settings)
 */
export function useNotificationSettings(options: UseUserSettingsOptions = {}) {
  const { data: settings, isLoading, error, refetch, invalidate } = useUserSettings(options)
  
  return {
    data: settings?.notification_settings ?? null,
    isLoading,
    error,
    refetch,
    invalidate
  }
}

