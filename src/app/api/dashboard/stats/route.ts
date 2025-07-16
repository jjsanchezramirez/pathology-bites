// src/app/api/dashboard/stats/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get total questions count
    const { count: totalQuestions } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')

    // Get user's completed quiz sessions
    const { data: completedSessions, error: completedError } = await supabase
      .from('quiz_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'completed')

    if (completedError) throw completedError

    // Get user's quiz attempts for detailed statistics
    const { data: attempts, error: attemptsError } = await supabase
      .from('quiz_attempts')
      .select(`
        *,
        quiz_session:quiz_sessions!inner(user_id, status)
      `)
      .eq('quiz_session.user_id', user.id)
      .eq('quiz_session.status', 'completed')

    if (attemptsError) throw attemptsError

    // Calculate unique question statistics (not attempts)
    const uniqueQuestions = new Map<string, { hasCorrect: boolean, hasIncorrect: boolean }>()

    // Process each attempt to track unique questions
    attempts?.forEach(attempt => {
      const questionId = attempt.question_id
      const existing = uniqueQuestions.get(questionId) || { hasCorrect: false, hasIncorrect: false }

      if (attempt.is_correct) {
        existing.hasCorrect = true
      } else {
        existing.hasIncorrect = true
      }

      uniqueQuestions.set(questionId, existing)
    })

    // Calculate question categories
    const allQuestions = totalQuestions || 0
    const attemptedQuestions = uniqueQuestions.size
    const needsReview = Array.from(uniqueQuestions.values()).filter(q => q.hasIncorrect).length
    const mastered = Array.from(uniqueQuestions.values()).filter(q => q.hasCorrect && !q.hasIncorrect).length
    const unused = allQuestions - attemptedQuestions

    // Calculate average score based on unique questions (not attempts)
    const totalAttempts = attempts?.length || 0
    const correctAttempts = attempts?.filter(attempt => attempt.is_correct).length || 0
    const averageScore = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0

    // Calculate study streak (consecutive days with completed quizzes)
    const studyStreak = calculateStudyStreak(completedSessions || [])

    // Calculate weekly progress (unique questions attempted this week)
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()) // Start of current week
    weekStart.setHours(0, 0, 0, 0)

    const weeklyUniqueQuestions = new Set(
      attempts?.filter(attempt => {
        const attemptDate = new Date(attempt.attempted_at)
        return attemptDate >= weekStart
      }).map(attempt => attempt.question_id) || []
    ).size

    // Get recent quiz sessions for activity
    const { data: recentSessions, error: sessionsError } = await supabase
      .from('quiz_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)

    if (sessionsError) throw sessionsError

    // Calculate performance analytics
    const performanceData = await calculatePerformanceAnalytics(supabase, user.id, averageScore)

    // Format the response with meaningful question categories
    const stats = {
      // New meaningful categories
      allQuestions,
      needsReview,
      mastered,
      unused,

      // Legacy fields for backward compatibility (will be removed later)
      totalQuestions: allQuestions,
      completedQuestions: attemptedQuestions,

      // Other stats
      averageScore,
      studyStreak,
      recentQuizzes: completedSessions?.length || 0,
      weeklyGoal: 50, // This could be user-configurable
      currentWeekProgress: weeklyUniqueQuestions,
      recentActivity: (recentSessions || []).map(session => ({
        id: session.id,
        type: session.status === 'completed' ? 'quiz_completed' : 'quiz_started',
        title: session.status === 'completed'
          ? `Completed ${session.title}`
          : `Started ${session.title}`,
        description: session.status === 'completed'
          ? `Scored ${session.score || 0}% on ${session.total_questions} questions`
          : `Progress: ${session.current_question_index}/${session.total_questions} questions`,
        timestamp: formatTimeAgo(new Date(session.created_at)),
        score: session.score
      })),

      // Performance analytics
      performance: performanceData
    }

    return NextResponse.json({
      success: true,
      data: stats
    })

  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    )
  }
}

// Helper function to calculate study streak
function calculateStudyStreak(completedSessions: any[]): number {
  if (!completedSessions || completedSessions.length === 0) return 0

  // Group sessions by date
  const sessionsByDate = new Map<string, boolean>()

  completedSessions.forEach(session => {
    const date = new Date(session.completed_at).toDateString()
    sessionsByDate.set(date, true)
  })

  // Calculate consecutive days from today backwards
  let streak = 0
  const today = new Date()

  for (let i = 0; i < 365; i++) { // Max 365 days to prevent infinite loop
    const checkDate = new Date(today)
    checkDate.setDate(today.getDate() - i)
    const dateString = checkDate.toDateString()

    if (sessionsByDate.has(dateString)) {
      streak++
    } else if (i > 0) { // Don't break on first day (today) if no activity
      break
    }
  }

  return streak
}

// Helper function to format time ago
function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) {
    return 'Just now'
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60)
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600)
    return `${hours} hour${hours > 1 ? 's' : ''} ago`
  } else {
    const days = Math.floor(diffInSeconds / 86400)
    return `${days} day${days > 1 ? 's' : ''} ago`
  }
}

// Helper function to calculate performance analytics
async function calculatePerformanceAnalytics(supabase: any, userId: string, userScore: number) {
  try {
    // Get total number of users for ranking
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')

    // Calculate user percentile based on average scores
    // This is a simplified calculation - in a real system you'd want more sophisticated analytics
    const { data: userScores } = await supabase
      .from('quiz_sessions')
      .select('user_id, score')
      .eq('status', 'completed')
      .not('score', 'is', null)

    let userPercentile = 50 // Default to 50th percentile
    let peerRank = Math.floor((totalUsers || 100) / 2) // Default to middle rank

    if (userScores && userScores.length > 0) {
      // Calculate average score per user
      const userAverages = new Map<string, number[]>()
      userScores.forEach((session: { user_id: string; score: number }) => {
        if (!userAverages.has(session.user_id)) {
          userAverages.set(session.user_id, [])
        }
        userAverages.get(session.user_id)!.push(session.score)
      })

      const averageScores = Array.from(userAverages.entries()).map(([userId, scores]) => ({
        userId,
        averageScore: scores.reduce((sum, score) => sum + score, 0) / scores.length
      }))

      // Calculate percentile
      const lowerScores = averageScores.filter(u => u.averageScore < userScore).length
      userPercentile = Math.round((lowerScores / averageScores.length) * 100)

      // Calculate rank (1-based)
      const sortedScores = averageScores.sort((a, b) => b.averageScore - a.averageScore)
      const userRankIndex = sortedScores.findIndex(u => u.userId === userId)
      peerRank = userRankIndex >= 0 ? userRankIndex + 1 : peerRank
    }

    // Get subject-specific performance (using categories as subjects)
    const { data: categoryPerformance } = await supabase
      .from('quiz_attempts')
      .select(`
        is_correct,
        questions!inner(categories!inner(name)),
        quiz_sessions!inner(user_id)
      `)
      .eq('quiz_sessions.user_id', userId)

    // Process category performance
    const categoryStats = new Map<string, { correct: number; total: number }>()

    if (categoryPerformance) {
      categoryPerformance.forEach((attempt: {
        is_correct: boolean;
        questions?: { categories?: { name: string } }
      }) => {
        const categoryName = attempt.questions?.categories?.name
        if (categoryName) {
          if (!categoryStats.has(categoryName)) {
            categoryStats.set(categoryName, { correct: 0, total: 0 })
          }
          const stats = categoryStats.get(categoryName)!
          stats.total++
          if (attempt.is_correct) {
            stats.correct++
          }
        }
      })
    }

    // Convert to arrays and sort
    const subjectPerformance = Array.from(categoryStats.entries()).map(([name, stats]) => ({
      name,
      score: Math.round((stats.correct / stats.total) * 100),
      attempts: stats.total
    }))

    const subjectsForImprovement = subjectPerformance
      .filter(subject => subject.score < 70 && subject.attempts >= 3)
      .sort((a, b) => a.score - b.score)
      .slice(0, 5)

    const subjectsMastered = subjectPerformance
      .filter(subject => subject.score >= 85 && subject.attempts >= 3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)

    return {
      userPercentile: Math.max(0, Math.min(100, userPercentile)),
      peerRank: Math.max(1, peerRank),
      totalUsers: totalUsers || 100,
      subjectsForImprovement,
      subjectsMastered,
      overallScore: Math.round(userScore)
    }
  } catch (error) {
    console.error('Error calculating performance analytics:', error)
    // Return default values on error
    return {
      userPercentile: 50,
      peerRank: 50,
      totalUsers: 100,
      subjectsForImprovement: [],
      subjectsMastered: [],
      overallScore: Math.round(userScore)
    }
  }
}
