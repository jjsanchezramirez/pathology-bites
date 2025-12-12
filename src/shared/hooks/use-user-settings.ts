// src/shared/hooks/use-user-settings.ts
// Cached hook for user settings with localStorage persistence

import { useCachedData } from './use-cached-data'
import { userSettingsService, type UserSettings } from '@/shared/services/user-settings'

interface UseUserSettingsOptions {
  enabled?: boolean
  refetchOnMount?: boolean
  onSuccess?: (data: UserSettings) => void
  onError?: (error: Error) => void
}

/**
 * Hook for user settings with intelligent caching
 * 
 * Features:
 * - localStorage persistence across sessions
 * - Automatic stale-while-revalidate
 * - Eliminates redundant API calls
 * - 5 minute cache, 2 minute stale time
 * 
 * Usage:
 * ```tsx
 * const { data: settings, isLoading, refetch, invalidate } = useUserSettings()
 * ```
 */
export function useUserSettings(options: UseUserSettingsOptions = {}) {
  const {
    enabled = true,
    refetchOnMount = true,
    onSuccess,
    onError
  } = options

  return useCachedData<UserSettings>(
    'user-settings',
    async () => {
      return await userSettingsService.getUserSettings()
    },
    {
      enabled,
      refetchOnMount,
      ttl: 5 * 60 * 1000, // 5 minutes cache
      staleTime: 2 * 60 * 1000, // 2 minutes stale time
      storage: 'localStorage', // Persist across sessions
      prefix: 'pathology-bites-settings',
      onSuccess,
      onError
    }
  )
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

