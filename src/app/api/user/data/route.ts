// Unified Performance API - Single endpoint for all performance data
// Consolidates: timeline, category-details, activity-heatmap, dashboard stats, and achievements

import { NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { ACHIEVEMENT_DEFINITIONS, checkAchievements, type UserStats } from '@/features/achievements/services/achievement-checker'
import type { Achievement } from '@/features/achievements/types/achievement'

interface UnifiedPerformanceResponse {
  success: boolean
  data: {
    // Summary statistics
    summary: {
      overallScore: number
      completedQuizzes: number
      totalAttempts: number
      correctAttempts: number
      userPercentile: number
      peerRank: number
      totalUsers: number
    }

    // Subjects for improvement and mastered
    subjects: {
      needsImprovement: Array<{
        name: string
        score: number
        attempts: number
      }>
      mastered: Array<{
        name: string
        score: number
        attempts: number
      }>
    }

    // Timeline data (last 30 days)
    timeline: Array<{
      date: string
      accuracy: number
      quizzes: number
    }>

    // Category details (for radar chart and category breakdown)
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

    // Activity heatmap (last 365 days)
    heatmap: {
      data: Array<{
        date: string
        quizzes: number
        questions: number
      }>
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

    // Achievements data
    achievements: {
      stats: UserStats
      unlocked: Array<{
        id: string
        group_key: string
        created_at: string
      }>
      progress: Array<Achievement>
    }

    // Dashboard-specific data
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
}

export async function GET() {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parallelize all data fetching
    const [
      sessionsResult,
      allUsersScoresResult
    ] = await Promise.all([
      // Get all quiz sessions with attempts
      supabase
        .from('quiz_sessions')
        .select(`
          id,
          created_at,
          completed_at,
          score,
          status,
          quiz_attempts!inner(
            question_id,
            is_correct,
            time_spent,
            attempted_at
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),

      // Get all users' scores for percentile calculation
      supabase
        .from('quiz_sessions')
        .select('user_id, score')
        .eq('status', 'completed')
        .not('score', 'is', null)
    ])

    if (sessionsResult.error) {
      console.error('Error fetching sessions:', sessionsResult.error)
      return NextResponse.json(
        { error: 'Failed to fetch performance data' },
        { status: 500 }
      )
    }

    const sessions = sessionsResult.data || []

    // Flatten all attempts
    const allAttempts = sessions.flatMap(s =>
      (s.quiz_attempts || []).map((a: any) => ({
        ...a,
        session_id: s.id,
        session_created_at: s.created_at,
        session_completed_at: s.completed_at,
        session_score: s.score,
        session_status: s.status
      }))
    )

    // Get all unique question IDs
    const questionIds = [...new Set(allAttempts.map((a: any) => a.question_id))]

    const { data: questions } = await supabase
      .from('questions')
      .select('id, category_id')
      .in('id', questionIds)

    // Get category names
    const questionCategoryMap = new Map(
      questions?.map((q: any) => [q.id, q.category_id]) || []
    )

    const categoryIds = [...new Set(
      Array.from(questionCategoryMap.values()).filter(Boolean) as string[]
    )]

    const { data: categories } = await supabase
      .from('categories')
      .select('id, name')
      .in('id', categoryIds)

    const categoryMap = new Map(
      categories?.map((cat: any) => [cat.id, cat.name]) || []
    )

    // Calculate completed sessions
    const completedSessions = sessions.filter(s => s.status === 'completed')
    const totalAttempts = allAttempts.length
    const correctAttempts = allAttempts.filter((a: any) => a.is_correct).length
    const overallScore = totalAttempts > 0
      ? Math.round((correctAttempts / totalAttempts) * 100)
      : 0

    // Calculate average score from completed sessions
    const avgScore = completedSessions.length > 0
      ? Math.round(
          completedSessions.reduce((sum, s) => sum + (s.score || 0), 0) / completedSessions.length
        )
      : 0

    // Calculate percentile and peer ranking
    let userPercentile = 50
    let peerRank = 50
    let totalUsers = 100

    if (!allUsersScoresResult.error && allUsersScoresResult.data && avgScore > 0) {
      const allScores = allUsersScoresResult.data
      const userScores = new Map<string, number[]>()

      allScores.forEach((item: any) => {
        const scores = userScores.get(item.user_id) || []
        scores.push(item.score)
        userScores.set(item.user_id, scores)
      })

      const userAverages = Array.from(userScores.entries()).map(([userId, scores]) => ({
        userId,
        avgScore: scores.reduce((sum, s) => sum + s, 0) / scores.length
      }))

      const usersWithLowerScore = userAverages.filter(u => u.avgScore < avgScore).length
      userPercentile = userAverages.length > 1
        ? Math.round((usersWithLowerScore / userAverages.length) * 100)
        : 50

      const sortedUsers = userAverages.sort((a, b) => b.avgScore - a.avgScore)
      const userRank = sortedUsers.findIndex(u => u.userId === user.id) + 1
      peerRank = userRank > 0 ? userRank : 50
      totalUsers = userAverages.length
    }

    // Group attempts by category
    const categoryStatsMap = new Map<string, {
      total_attempts: number
      correct_attempts: number
      total_time: number
      last_attempt_at: string
      attempts: Array<{ is_correct: boolean; attempted_at: string; time_spent: number | null }>
    }>()

    allAttempts.forEach((attempt: any) => {
      const categoryId = questionCategoryMap.get(attempt.question_id)
      if (!categoryId) return

      const stats = categoryStatsMap.get(categoryId) || {
        total_attempts: 0,
        correct_attempts: 0,
        total_time: 0,
        last_attempt_at: attempt.attempted_at,
        attempts: []
      }

      stats.total_attempts++
      if (attempt.is_correct) stats.correct_attempts++
      stats.total_time += attempt.time_spent || 0

      if (new Date(attempt.attempted_at) > new Date(stats.last_attempt_at)) {
        stats.last_attempt_at = attempt.attempted_at
      }

      stats.attempts.push({
        is_correct: attempt.is_correct,
        attempted_at: attempt.attempted_at,
        time_spent: attempt.time_spent
      })

      categoryStatsMap.set(categoryId, stats)
    })

    // Calculate needs improvement and mastered subjects
    const needsImprovement: Array<{ name: string; score: number; attempts: number }> = []
    const mastered: Array<{ name: string; score: number; attempts: number }> = []

    // Calculate category details with recent performance
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const categoryDetails = Array.from(categoryStatsMap.entries()).map(
      ([categoryId, stats]) => {
        const accuracy = stats.total_attempts > 0
          ? Math.round((stats.correct_attempts / stats.total_attempts) * 100)
          : 0

        const avgTime = stats.total_attempts > 0
          ? Math.round(stats.total_time / stats.total_attempts)
          : 0

        // Add to needs improvement or mastered
        if (accuracy < 70 && stats.total_attempts >= 3) {
          needsImprovement.push({
            name: categoryMap.get(categoryId) || 'Unknown',
            score: accuracy,
            attempts: stats.total_attempts
          })
        }

        if (accuracy >= 85 && stats.total_attempts >= 5) {
          mastered.push({
            name: categoryMap.get(categoryId) || 'Unknown',
            score: accuracy,
            attempts: stats.total_attempts
          })
        }

        // Calculate recent performance
        const recentAttempts = stats.attempts.filter(
          a => new Date(a.attempted_at) >= thirtyDaysAgo
        )

        const dailyStats = new Map<string, { correct: number; total: number }>()
        recentAttempts.forEach((attempt) => {
          const date = new Date(attempt.attempted_at).toISOString().split('T')[0]
          const dayStats = dailyStats.get(date) || { correct: 0, total: 0 }
          dayStats.total++
          if (attempt.is_correct) dayStats.correct++
          dailyStats.set(date, dayStats)
        })

        const recentPerformance = Array.from(dailyStats.entries())
          .map(([date, dayStats]) => ({
            date,
            accuracy: Math.round((dayStats.correct / dayStats.total) * 100),
            questions_answered: dayStats.total
          }))
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 7)

        // Calculate trend
        let trend: 'up' | 'down' | 'stable' = 'stable'
        if (recentPerformance.length >= 2) {
          const recentAccuracies = recentPerformance.slice(0, 3).map(p => p.accuracy)
          const avgRecent = recentAccuracies.reduce((sum, acc) => sum + acc, 0) / recentAccuracies.length

          if (avgRecent > accuracy + 5) {
            trend = 'up'
          } else if (avgRecent < accuracy - 5) {
            trend = 'down'
          }
        }

        return {
          category_id: categoryId,
          category_name: categoryMap.get(categoryId) || 'Unknown Category',
          total_attempts: stats.total_attempts,
          correct_attempts: stats.correct_attempts,
          accuracy,
          average_time: avgTime,
          last_attempt_at: stats.last_attempt_at,
          recent_performance: recentPerformance,
          trend
        }
      }
    )

    // Sort categories by last attempt (most recent first)
    categoryDetails.sort((a, b) =>
      new Date(b.last_attempt_at).getTime() - new Date(a.last_attempt_at).getTime()
    )

    // Sort needs improvement and mastered
    needsImprovement.sort((a, b) => a.score - b.score)
    mastered.sort((a, b) => b.score - a.score)

    // Calculate timeline (last 30 days)
    const completedSessionsLast30Days = completedSessions.filter(
      s => s.completed_at && new Date(s.completed_at) >= thirtyDaysAgo
    )

    const dailyData: Record<string, { scores: number[]; count: number }> = {}
    completedSessionsLast30Days.forEach(session => {
      if (!session.completed_at) return
      const date = new Date(session.completed_at).toISOString().split('T')[0]
      if (!dailyData[date]) {
        dailyData[date] = { scores: [], count: 0 }
      }
      dailyData[date].scores.push(session.score || 0)
      dailyData[date].count++
    })

    const timeline = Object.entries(dailyData)
      .map(([date, stats]) => ({
        date,
        accuracy: stats.scores.reduce((sum, score) => sum + score, 0) / stats.scores.length,
        quizzes: stats.count
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Calculate activity heatmap (last 365 days)
    const oneYearAgo = new Date()
    oneYearAgo.setDate(oneYearAgo.getDate() - 365)

    const dailyActivity: Record<string, { quizzes: number; questions: number }> = {}

    sessions.forEach(session => {
      const date = new Date(session.created_at).toISOString().split('T')[0]
      if (!dailyActivity[date]) {
        dailyActivity[date] = { quizzes: 0, questions: 0 }
      }
      dailyActivity[date].quizzes++
    })

    allAttempts.forEach((attempt: any) => {
      const date = new Date(attempt.attempted_at).toISOString().split('T')[0]
      if (!dailyActivity[date]) {
        dailyActivity[date] = { quizzes: 0, questions: 0 }
      }
      dailyActivity[date].questions++
    })

    // Create array with all 365 days
    const heatmapData = []
    const today = new Date()

    for (let i = 364; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]

      heatmapData.push({
        date: dateStr,
        quizzes: dailyActivity[dateStr]?.quizzes || 0,
        questions: dailyActivity[dateStr]?.questions || 0
      })
    }

    // Calculate heatmap statistics
    const daysWithActivity = heatmapData.filter(d => d.questions > 0).length
    const totalQuestions = heatmapData.reduce((sum, d) => sum + d.questions, 0)
    const totalQuizzes = heatmapData.reduce((sum, d) => sum + d.quizzes, 0)

    const avgQuestionsPerDay = daysWithActivity > 0
      ? Math.round(totalQuestions / daysWithActivity)
      : 0
    const avgQuizzesPerDay = daysWithActivity > 0
      ? (totalQuizzes / daysWithActivity).toFixed(1)
      : '0'

    // Calculate streaks
    let longestStreak = 0
    let currentStreak = 0
    let tempStreak = 0

    for (let i = heatmapData.length - 1; i >= 0; i--) {
      if (heatmapData[i].questions > 0) {
        tempStreak++
        longestStreak = Math.max(longestStreak, tempStreak)

        if (i === heatmapData.length - 1 || currentStreak > 0 || i === heatmapData.length - 2) {
          currentStreak = tempStreak
        }
      } else {
        if (i >= heatmapData.length - 2) {
          currentStreak = 0
        }
        tempStreak = 0
      }
    }

    // ===== ACHIEVEMENTS CALCULATION =====
    // Calculate achievement stats (reusing data already fetched)

    // Perfect scores (already have completedSessions)
    const perfectScores = completedSessions.filter(s => s.score === 100).length

    // Recent accuracy (last 10 quizzes) - using completedSessions
    const last10Quizzes = completedSessions
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)

    const recentAccuracy = last10Quizzes.length > 0
      ? last10Quizzes.reduce((sum, s) => sum + (s.score || 0), 0) / last10Quizzes.length
      : 0

    // Unique subjects (already have categoryDetails)
    const uniqueSubjects = categoryDetails.length
    const totalCategories = categoryDetails.length // Total categories user has interacted with

    // Speed records - check perfect score quizzes with time limits
    let speedRecords5min = 0
    let speedRecords2min = 0
    let speedRecords25in5min = 0
    let speedRecords25in2min = 0

    const perfectQuizzes = completedSessions.filter(s => s.score === 100)
    perfectQuizzes.forEach(quiz => {
      const totalQuestions = (quiz.quiz_attempts as any[])?.length || 0
      const totalTime = quiz.total_time_spent || 0

      if (totalQuestions >= 10) {
        if (totalTime <= 300) speedRecords5min = 1
        if (totalTime <= 120) speedRecords2min = 1
      }

      if (totalQuestions >= 25) {
        if (totalTime <= 300) speedRecords25in5min = 1
        if (totalTime <= 120) speedRecords25in2min = 1
      }
    })

    // Build UserStats object
    const achievementStats: UserStats = {
      totalQuizzes: completedSessions.length,
      perfectScores,
      currentStreak,
      longestStreak,
      speedRecords5min,
      speedRecords2min,
      speedRecords25in5min,
      speedRecords25in2min,
      recentAccuracy,
      uniqueSubjects,
      totalCategories
    }

    // Get unlocked achievements from database
    const { data: unlockedAchievements } = await supabase
      .from('user_achievements')
      .select('id, group_key, created_at')
      .eq('user_id', user.id)
      .eq('type', 'achievement')
      .order('created_at', { ascending: false })

    const unlockedIds = new Set((unlockedAchievements || []).map(a => a.group_key))

    // Calculate progress for all achievements
    const achievementProgress: Achievement[] = ACHIEVEMENT_DEFINITIONS.map(def => {
      const isUnlocked = unlockedIds.has(def.id)
      const userAchievement = unlockedAchievements?.find(a => a.group_key === def.id)

      let progress = 0
      let requirement = def.requirement

      switch (def.category) {
        case 'quiz':
          progress = Math.min(achievementStats.totalQuizzes, def.requirement)
          break
        case 'perfect':
          progress = Math.min(achievementStats.perfectScores, def.requirement)
          break
        case 'streak':
          progress = Math.min(achievementStats.currentStreak, def.requirement)
          break
        case 'differential':
          if (def.id === 'differential-all' && achievementStats.totalCategories) {
            requirement = achievementStats.totalCategories
            progress = achievementStats.uniqueSubjects
          } else {
            progress = Math.min(achievementStats.uniqueSubjects, def.requirement)
          }
          break
        // Speed and accuracy are binary, no progress shown
      }

      return {
        id: def.id,
        title: def.title,
        description: def.description,
        animationType: def.animationType,
        category: def.category,
        requirement,
        isUnlocked,
        progress,
        unlockedDate: userAchievement?.created_at
      }
    })

    // ===== DASHBOARD DATA CALCULATION =====
    // Calculate dashboard-specific stats

    // Get total questions count
    const { count: allQuestionsCount } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })

    // Calculate mastered/needs review from attempts
    const questionAttempts = new Map<string, { correct: number; incorrect: number }>()

    allAttempts.forEach((attempt: any) => {
      const existing = questionAttempts.get(attempt.question_id) || { correct: 0, incorrect: 0 }
      if (attempt.is_correct) {
        existing.correct++
      } else {
        existing.incorrect++
      }
      questionAttempts.set(attempt.question_id, existing)
    })

    // Mastered: 2+ correct, no incorrect
    // Needs review: any incorrect
    let masteredCount = 0
    let needsReviewCount = 0

    questionAttempts.forEach((counts) => {
      if (counts.correct >= 2 && counts.incorrect === 0) {
        masteredCount++
      } else if (counts.incorrect > 0) {
        needsReviewCount++
      }
    })

    const completedQuestionsCount = questionAttempts.size
    const unusedCount = Math.max(0, (allQuestionsCount || 0) - completedQuestionsCount)

    // Recent activity from sessions
    const recentActivity: Array<{
      id: string
      type: string
      title: string
      description: string
      timestamp: string
      timeGroup?: string
      score?: number
      navigationUrl?: string
    }> = []

    completedSessions.slice(0, 5).forEach((session: any) => {
      const isCompleted = session.status === 'completed'
      recentActivity.push({
        id: `session-${session.id}`,
        type: isCompleted ? 'quiz_completed' : 'quiz_started',
        title: isCompleted ? 'Completed Quiz' : 'Started Quiz',
        description: isCompleted ? 'View detailed results' : 'Continue where you left off',
        timestamp: session.completed_at || session.created_at,
        score: session.score,
        navigationUrl: isCompleted ? `/dashboard/quiz/${session.id}/results` : `/dashboard/quiz/${session.id}`
      })
    })

    // If no activity, add welcome message
    if (recentActivity.length === 0) {
      recentActivity.push({
        id: 'welcome-1',
        type: 'welcome',
        title: 'Start Your First Quiz',
        description: 'Take a quick starter quiz to see how we track your progress.',
        timestamp: new Date().toISOString()
      })
    }

    // Weekly goal progress (simple calculation)
    const weeklyGoal = 50
    const currentWeekProgress = completedSessions.length // Simplified

    const response: UnifiedPerformanceResponse = {
      success: true,
      data: {
        summary: {
          overallScore,
          completedQuizzes: completedSessions.length,
          totalAttempts,
          correctAttempts,
          userPercentile,
          peerRank,
          totalUsers
        },
        subjects: {
          needsImprovement: needsImprovement.slice(0, 5),
          mastered: mastered.slice(0, 5)
        },
        timeline,
        categories: categoryDetails,
        heatmap: {
          data: heatmapData,
          stats: {
            avgQuestionsPerDay,
            avgQuizzesPerDay,
            longestStreak,
            currentStreak,
            totalQuestions,
            totalQuizzes,
            daysWithActivity
          }
        },
        achievements: {
          stats: achievementStats,
          unlocked: unlockedAchievements || [],
          progress: achievementProgress
        },
        dashboard: {
          allQuestions: allQuestionsCount || 0,
          needsReview: needsReviewCount,
          mastered: masteredCount,
          unused: unusedCount,
          totalQuestions: allQuestionsCount || 0,
          completedQuestions: completedQuestionsCount,
          averageScore: overallScore,
          studyStreak: currentStreak,
          recentQuizzes: completedSessions.length,
          weeklyGoal,
          currentWeekProgress,
          recentActivity
        }
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error in unified performance API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
