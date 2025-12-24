// src/shared/hooks/use-quiz-init.ts
// Hook for batched quiz initialization data

import { useCachedData } from './use-cached-data'

interface QuizInitData {
  sessions: {
    titles: string[]
    count: number
  }
  options: {
    categories: any[]
    questionTypeStats: {
      all: any
      ap_only: any
      cp_only: any
    }
  }
}

interface UseQuizInitOptions {
  enabled?: boolean
  sessionLimit?: number
}

/**
 * Hook for batched quiz initialization
 * 
 * Fetches all data needed for quiz creation page in a single API call:
 * - Recent quiz session titles (for title generation)
 * - Categories with question counts
 * - Question type statistics
 * 
 * Features:
 * - Single API call instead of 2 separate calls
 * - localStorage caching with 5 minute TTL
 * - Automatic stale-while-revalidate
 * 
 * Usage:
 * ```tsx
 * const { data, isLoading } = useQuizInit()
 * const sessionTitles = data?.sessions.titles || []
 * const categories = data?.options.categories || []
 * ```
 */
export function useQuizInit(options: UseQuizInitOptions = {}) {
  const {
    enabled = true,
    sessionLimit = 100
  } = options

  return useCachedData<QuizInitData>(
    `quiz-init-${sessionLimit}`,
    async () => {
      const response = await fetch(`/api/quiz/init?sessionLimit=${sessionLimit}`)
      if (!response.ok) {
        throw new Error(`Failed to initialize quiz: ${response.status}`)
      }
      const result = await response.json()
      return result.data
    },
    {
      enabled,
      refetchOnMount: true, // Always fetch on mount if no valid cache
      ttl: 5 * 60 * 1000, // 5 minutes cache
      staleTime: 2 * 60 * 1000, // 2 minutes stale time
      storage: 'localStorage', // Persist across sessions
      prefix: 'pathology-bites-quiz'
    }
  )
}

