// Custom SWR hook for unified performance/dashboard data
import useSWR from 'swr'
import type { UserStats } from '@/features/achievements/services/achievement-checker'
import type { Achievement } from '@/features/achievements/types/achievement'

interface UnifiedData {
  summary: {
    overallScore: number
    completedQuizzes: number
    totalAttempts: number
    correctAttempts: number
    userPercentile: number
    peerRank: number
    totalUsers: number
  }
  subjects: {
    needsImprovement: Array<{ name: string; score: number; attempts: number }>
    mastered: Array<{ name: string; score: number; attempts: number }>
  }
  timeline: Array<{ date: string; accuracy: number; quizzes: number }>
  categories: Array<{
    category_id: string
    category_name: string
    total_attempts: number
    correct_attempts: number
    accuracy: number
    average_time: number
    last_attempt_at: string
    recent_performance: Array<{
      date: string
      accuracy: number
      questions_answered: number
    }>
    trend?: 'up' | 'down' | 'stable'
  }>
  heatmap: {
    data: Array<{ date: string; quizzes: number; questions: number }>
    stats: {
      avgQuestionsPerDay: number
      avgQuizzesPerDay: string
      longestStreak: number
      currentStreak: number
      totalQuestions: number
      totalQuizzes: number
      daysWithActivity: number
    }
  }
  achievements: {
    stats: UserStats
    unlocked: Array<{
      id: string
      group_key: string
      created_at: string
    }>
    progress: Achievement[]
  }
  dashboard: {
    allQuestions: number
    needsReview: number
    mastered: number
    unused: number
    totalQuestions: number
    completedQuestions: number
    averageScore: number
    studyStreak: number
    recentQuizzes: number
    weeklyGoal: number
    currentWeekProgress: number
    recentActivity: Array<{
      id: string
      type: string
      title: string
      description: string
      timestamp: string
      timeGroup?: string
      score?: number
      navigationUrl?: string
    }>
  }
}

const fetcher = async (url: string) => {
  const res = await fetch(url)

  if (!res.ok) {
    const error = new Error('Failed to fetch data')
    throw error
  }

  const data = await res.json()

  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch data')
  }

  return data.data as UnifiedData
}

/**
 * Custom hook to fetch unified performance/dashboard data with SWR caching
 *
 * Cache Strategy (Optimized for Vercel/Supabase Free Tier):
 * - 30-minute cache = Minimal edge function invocations
 * - Revalidate on focus = Fresh data when user returns
 * - Manual invalidation = Update after quiz completion
 * - Deduplication = Multiple components share one request
 *
 * This dramatically reduces Vercel edge function calls while maintaining
 * a great UX. For example:
 * - Without cache: 10 page navigations = 10 API calls
 * - With 30min cache: 10 navigations = 1-2 API calls
 */
export function useUnifiedData() {
  const { data, error, isLoading, mutate } = useSWR<UnifiedData>(
    '/api/user/data',
    fetcher,
    {
      // Dedupe requests within 30 minutes (reduces API calls dramatically)
      dedupingInterval: 30 * 60 * 1000,
      // Revalidate when window regains focus (ensures fresh data on return)
      revalidateOnFocus: true,
      // Don't revalidate on reconnect (save API calls)
      revalidateOnReconnect: false,
      // Keep previous data while revalidating (smooth UX)
      keepPreviousData: true,
      // Only retry on errors once (save API calls on failures)
      errorRetryCount: 1,
      // Longer retry interval to avoid hammering the API
      errorRetryInterval: 10000,
    }
  )

  return {
    data,
    isLoading,
    isError: error,
    mutate, // Use this to manually refresh data (e.g., after quiz completion)
  }
}
