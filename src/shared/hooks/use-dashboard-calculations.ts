import { useMemo } from 'react'

interface QuizSession {
  id: string
  score: number
  completedAt: string
  [key: string]: any
}

interface DashboardStats {
  totalQuizzes?: number
  studyStreak?: number
  averageScore?: number
  [key: string]: any
}

interface UseDashboardCalculationsProps {
  recentQuizzes: QuizSession[]
  stats: DashboardStats
}

/**
 * Client-side dashboard calculations to reduce server processing and Vercel costs
 * Moved from dashboard consolidation API for better performance
 */
export function useDashboardCalculations({ recentQuizzes, stats }: UseDashboardCalculationsProps) {
  const weeklyProgress = useMemo(() => {
    // Calculate week start (Sunday)
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    weekStart.setHours(0, 0, 0, 0)

    const weeklyQuizzes = recentQuizzes.filter(quiz => 
      new Date(quiz.completedAt) >= weekStart
    )

    const avgWeeklyScore = weeklyQuizzes.length > 0 
      ? Math.round(weeklyQuizzes.reduce((sum, quiz) => sum + quiz.score, 0) / weeklyQuizzes.length)
      : 0

    return {
      weeklyQuizzes: weeklyQuizzes.length,
      avgWeeklyScore,
      weekStart: weekStart.toISOString()
    }
  }, [recentQuizzes])

  const enhancedStats = useMemo(() => ({
    ...stats,
    ...weeklyProgress,
    totalQuizzesCompleted: stats.totalQuizzes || 0,
    currentStreak: stats.studyStreak || 0,
    averageScore: stats.averageScore || 0
  }), [stats, weeklyProgress])

  const monthlyProgress = useMemo(() => {
    // Calculate month start
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const monthlyQuizzes = recentQuizzes.filter(quiz => 
      new Date(quiz.completedAt) >= monthStart
    )

    const avgMonthlyScore = monthlyQuizzes.length > 0 
      ? Math.round(monthlyQuizzes.reduce((sum, quiz) => sum + quiz.score, 0) / monthlyQuizzes.length)
      : 0

    return {
      monthlyQuizzes: monthlyQuizzes.length,
      avgMonthlyScore,
      monthStart: monthStart.toISOString()
    }
  }, [recentQuizzes])

  return {
    enhancedStats,
    weeklyProgress,
    monthlyProgress
  }
}