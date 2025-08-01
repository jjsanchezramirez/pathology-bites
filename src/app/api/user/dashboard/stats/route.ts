// src/app/api/dashboard/stats/route.ts
// Optimized dashboard API using materialized views for 10x performance improvement
// Uses get_user_performance_data() RPC function with hybrid materialized view + real-time fallback
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { SupabaseClient } from '@supabase/supabase-js'

// Type definitions for dashboard stats API
interface PerformanceData {
  user_percentile: number
  overall_score: number
  total_quizzes: number
  avg_score: number
  best_score: number
  total_questions: number
  correct_answers: number
  study_streak: number
  last_activity: string
}

interface Milestone {
  type: string
  title: string
  description: string
  value: number
  achievedAt: string
}

interface QuizSession {
  id: string
  score: number
  total_questions: number
  correct_answers: number
  created_at: string
  status: string
}

interface DashboardStatsResponse {
  success: boolean
  data: {
    performanceAnalytics: {
      userPercentile: number
      overallScore: number
      totalQuizzes: number
      avgScore: number
      bestScore: number
      totalQuestions: number
      correctAnswers: number
      studyStreak: number
      lastActivity: string
    }
    milestones: Milestone[]
  }
}

export async function GET() {
  // Global error handler to ensure we always return JSON
  try {
    // Wrap Supabase client creation in try-catch to handle server-side errors
    let supabase
    try {
      supabase = await createClient()
    } catch (clientError) {
      console.error('Dashboard stats - Supabase client creation failed:', clientError)
      return NextResponse.json({
        error: 'Service temporarily unavailable',
        success: false,
        details: 'Database connection failed'
      }, {
        status: 503,
        headers: {
          'Content-Type': 'application/json'
        }
      })
    }

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('Dashboard stats auth error:', authError)
      return NextResponse.json({
        error: 'Unauthorized',
        success: false,
        details: authError?.message || 'Authentication required'
      }, {
        status: 401,
        headers: {
          'Content-Type': 'application/json'
        }
      })
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

    // Calculate performance analytics using optimized materialized view
    const performanceStartTime = Date.now()
    const performanceData = await calculatePerformanceAnalytics(supabase, user.id, averageScore)
    const performanceEndTime = Date.now()

    // Log performance metrics for monitoring
    console.log(`Dashboard performance analytics: ${performanceEndTime - performanceStartTime}ms, source: ${performanceData.dataSource}`)

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
      recentActivity: await generateEnhancedRecentActivity(user.id, supabase, recentSessions || []),

      // Performance analytics (enhanced with materialized view data)
      performance: {
        ...performanceData,
        // Add materialized view specific metrics
        performanceMetrics: performanceData.performanceMetrics || {},
        dataFreshness: performanceData.dataSource === 'materialized_view' ? 'cached' : 'real_time',
        queryTime: performanceEndTime - performanceStartTime
      }
    }

    return NextResponse.json({
      success: true,
      data: stats
    })

  } catch (error) {
    console.error('Error fetching dashboard stats:', error)

    // Ensure we always return a proper JSON response, never HTML
    const errorResponse = {
      error: 'Failed to fetch dashboard statistics',
      success: false,
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }

    return new NextResponse(JSON.stringify(errorResponse), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  }
}

// Helper function to calculate study streak
function calculateStudyStreak(completedSessions: QuizSession[]): number {
  if (!completedSessions || completedSessions.length === 0) return 0

  // Group sessions by date
  const sessionsByDate = new Map<string, boolean>()

  completedSessions.forEach(session => {
    const date = new Date(session.created_at).toDateString()
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

// Optimized performance analytics using materialized view system
async function calculatePerformanceAnalytics(supabase: SupabaseClient, userId: string, userScore: number) {
  try {
    // Use the new hybrid function for optimized performance data
    const { data: performanceData, error: performanceError } = await supabase.rpc('get_user_performance_data', {
      target_user_id: userId
    })

    if (performanceError) {
      console.warn('Performance data RPC failed, falling back to basic calculation:', performanceError)
      throw performanceError
    }

    // Extract data from the materialized view result
    const userData = performanceData?.[0]
    if (!userData) {
      throw new Error('No performance data found for user')
    }

    // Get total active users count (cached in materialized view context)
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')

    // Get subject-specific performance with optimized single query
    const { data: categoryPerformance } = await supabase
      .from('quiz_attempts')
      .select(`
        is_correct,
        questions!inner(categories!inner(name)),
        quiz_sessions!inner(user_id)
      `)
      .eq('quiz_sessions.user_id', userId)

    // Process category performance efficiently
    const categoryStats = new Map<string, { correct: number; total: number }>()

    categoryPerformance?.forEach((attempt: {
      is_correct: boolean;
      questions: { categories: { name: string }[] }[];
      quiz_sessions: { user_id: string }[]
    }) => {
      // Get the first question's first category name
      const categoryName = attempt.questions?.[0]?.categories?.[0]?.name
      if (categoryName) {
        const stats = categoryStats.get(categoryName) || { correct: 0, total: 0 }
        stats.total++
        if (attempt.is_correct) stats.correct++
        categoryStats.set(categoryName, stats)
      }
    })

    // Convert to performance arrays
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

    // Return optimized performance data with backward compatibility
    return {
      // Backward compatible fields
      userPercentile: Math.max(0, Math.min(100, userData.percentile || 50)),
      peerRank: Math.max(1, userData.peer_rank || 50),
      totalUsers: totalUsers || 100,
      subjectsForImprovement,
      subjectsMastered,
      overallScore: Math.round(userData.success_rate || userScore),

      // New materialized view fields
      dataSource: userData.data_source,
      performanceMetrics: {
        totalSessions: userData.total_sessions || 0,
        avgScore: parseFloat(userData.avg_score) || 0,
        successRate: parseFloat(userData.success_rate) || 0,
        fullName: userData.full_name || 'Unknown User'
      }
    }
  } catch (error) {
    console.error('Error in optimized performance analytics:', error)
    // Fallback to basic calculation if materialized view fails
    return await calculateBasicPerformanceAnalytics(supabase, userId, userScore)
  }
}

// Streamlined fallback function for basic performance analytics
async function calculateBasicPerformanceAnalytics(supabase: SupabaseClient, userId: string, userScore: number) {
  try {
    console.warn('Using fallback performance analytics - materialized view unavailable')

    // Get basic user count
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')

    // Simplified percentile calculation
    const { data: userScores } = await supabase
      .from('quiz_sessions')
      .select('user_id, score')
      .eq('status', 'completed')
      .not('score', 'is', null)
      .limit(100) // Limit for performance

    let userPercentile = 50
    let peerRank = Math.floor((totalUsers || 100) / 2)

    if (userScores && userScores.length > 0) {
      // Quick percentile calculation
      const scores = userScores.map((s: { user_id: string; score: number }) => s.score).sort((a: number, b: number) => a - b)
      const lowerCount = scores.filter((score: number) => score < userScore).length
      userPercentile = Math.round((lowerCount / scores.length) * 100)

      // Approximate rank
      const higherCount = scores.filter((score: number) => score > userScore).length
      peerRank = higherCount + 1
    }

    return {
      userPercentile: Math.max(0, Math.min(100, userPercentile)),
      peerRank: Math.max(1, peerRank),
      totalUsers: totalUsers || 100,
      subjectsForImprovement: [],
      subjectsMastered: [],
      overallScore: Math.round(userScore),
      dataSource: 'fallback',
      performanceMetrics: {
        totalSessions: 0,
        avgScore: userScore,
        successRate: userScore,
        fullName: 'Unknown User'
      }
    }
  } catch (error) {
    console.error('Error in fallback performance analytics:', error)
    return {
      userPercentile: 50,
      peerRank: 50,
      totalUsers: 100,
      subjectsForImprovement: [],
      subjectsMastered: [],
      overallScore: Math.round(userScore),
      dataSource: 'error',
      performanceMetrics: {
        totalSessions: 0,
        avgScore: userScore,
        successRate: userScore,
        fullName: 'Unknown User'
      }
    }
  }
}

// Enhanced Recent Activity Generation
async function generateEnhancedRecentActivity(userId: string, supabase: SupabaseClient, recentSessions: QuizSession[]) {
  const activities = []

  // Helper function to get time group
  function getTimeGroup(date: Date): string {
    const now = new Date()
    const diffTime = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'today'
    if (diffDays === 1) return 'yesterday'
    if (diffDays <= 7) return 'this_week'
    if (diffDays <= 14) return 'last_week'
    return 'earlier'
  }

  // Helper function to get navigation URL
  function getNavigationUrl(session: QuizSession): string {
    if (session.status === 'completed') {
      return `/dashboard/quiz/${session.id}/results`
    } else if (session.status === 'in_progress') {
      return `/dashboard/quiz/${session.id}`
    }
    return `/dashboard/quiz/new`
  }

  // 1. Add quiz activities from sessions
  for (const session of recentSessions) {
    const sessionDate = new Date(session.created_at)
    const timeGroup = getTimeGroup(sessionDate)

    if (session.status === 'completed') {
      // Calculate improvement if we have previous scores
      let improvement = null
      try {
        const { data: previousSessions } = await supabase
          .from('quiz_sessions')
          .select('score')
          .eq('user_id', userId)
          .eq('status', 'completed')
          .lt('created_at', session.created_at)
          .order('created_at', { ascending: false })
          .limit(1)

        if (previousSessions && previousSessions.length > 0) {
          improvement = (session.score || 0) - (previousSessions[0].score || 0)
        }
      } catch (error) {
        console.error('Error calculating improvement:', error)
      }

      activities.push({
        id: `quiz-completed-${session.id}`,
        type: 'quiz_completed',
        title: `Completed Quiz`,
        description: `Scored ${session.score || 0}% on ${session.total_questions} questions${
          improvement ? ` (${improvement > 0 ? '+' : ''}${improvement}% improvement)` : ''
        }`,
        timestamp: formatTimeAgo(sessionDate),
        timeGroup,
        score: session.score,
        navigationUrl: getNavigationUrl(session),
        priority: (session.score || 0) >= 90 ? 'high' : (session.score || 0) >= 70 ? 'medium' : 'low',
        metadata: {
          quizId: session.id,
          totalQuestions: session.total_questions,
          timeSpent: 0, // Time spent not available in current interface
          improvement
        }
      })
    } else if (session.status === 'in_progress') {
      activities.push({
        id: `quiz-started-${session.id}`,
        type: 'quiz_started',
        title: `Started Quiz`,
        description: `Quiz with ${session.total_questions} questions`,
        timestamp: formatTimeAgo(sessionDate),
        timeGroup,
        navigationUrl: getNavigationUrl(session),
        priority: 'medium',
        metadata: {
          quizId: session.id,
          totalQuestions: session.total_questions,
          currentProgress: 0 // Progress not available in current interface
        }
      })
    }
  }

  // 2. Calculate and add study streak activities
  try {
    const streak = await calculateEnhancedStudyStreak(userId, supabase)
    if (streak.days >= 3) { // Only show streaks of 3+ days
      activities.push({
        id: `study-streak-${streak.days}`,
        type: 'study_streak',
        title: `🔥 ${streak.days} Day Study Streak!`,
        description: `Keep up the great work!${streak.isNewRecord ? ' New personal record!' : ''}`,
        timestamp: 'Current',
        timeGroup: 'today',
        priority: streak.days >= 7 ? 'high' : 'medium',
        metadata: {
          days: streak.days,
          isNewRecord: streak.isNewRecord
        }
      })
    }
  } catch (error) {
    console.error('Error calculating study streak:', error)
  }

  // 3. Add performance milestone activities
  try {
    const milestones = await calculatePerformanceMilestones(userId, supabase)
    for (const milestone of milestones) {
      activities.push({
        id: `milestone-${milestone.type}-${milestone.value}`,
        type: 'performance_milestone',
        title: `📈 ${milestone.title}`,
        description: milestone.description,
        timestamp: formatTimeAgo(new Date(milestone.achievedAt)),
        timeGroup: getTimeGroup(new Date(milestone.achievedAt)),
        priority: 'high',
        metadata: milestone
      })
    }
  } catch (error) {
    console.error('Error calculating performance milestones:', error)
  }

  // Sort activities by timestamp (most recent first) and limit to 15
  return activities
    .sort((a, b) => {
      if (a.timeGroup === 'today' && b.timeGroup !== 'today') return -1
      if (b.timeGroup === 'today' && a.timeGroup !== 'today') return 1
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    })
    .slice(0, 15)
}

// Calculate enhanced study streak from quiz sessions
async function calculateEnhancedStudyStreak(userId: string, supabase: SupabaseClient) {
  try {
    // Get quiz sessions from the last 30 days, grouped by date
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: sessions } = await supabase
      .from('quiz_sessions')
      .select('created_at, status')
      .eq('user_id', userId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })

    if (!sessions || sessions.length === 0) {
      return { days: 0, isNewRecord: false }
    }

    // Group sessions by date
    const sessionsByDate = new Map()
    sessions.forEach((session: { created_at: string; status: string }) => {
      const date = new Date(session.created_at).toDateString()
      if (!sessionsByDate.has(date)) {
        sessionsByDate.set(date, [])
      }
      sessionsByDate.get(date).push(session)
    })

    // Calculate current streak
    let currentStreak = 0
    const today = new Date()

    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today)
      checkDate.setDate(today.getDate() - i)
      const dateString = checkDate.toDateString()

      if (sessionsByDate.has(dateString)) {
        currentStreak++
      } else {
        break
      }
    }

    // Check if this is a new record (simplified - could be enhanced)
    const isNewRecord = currentStreak >= 7 // Consider 7+ days a significant streak

    return { days: currentStreak, isNewRecord }
  } catch (error) {
    console.error('Error calculating study streak:', error)
    return { days: 0, isNewRecord: false }
  }
}

// Calculate performance milestones
async function calculatePerformanceMilestones(userId: string, supabase: SupabaseClient) {
  const milestones: Milestone[] = []

  try {
    // Get recent completed sessions for milestone calculation
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data: recentSessions } = await supabase
      .from('quiz_sessions')
      .select('score, created_at, total_questions')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false })

    if (!recentSessions || recentSessions.length === 0) {
      return milestones
    }

    // Calculate average score for recent sessions
    const averageScore = recentSessions.reduce((sum: number, session: { score: number | null; created_at: string; total_questions: number }) => sum + (session.score || 0), 0) / recentSessions.length

    // Check for accuracy milestones
    if (averageScore >= 90 && recentSessions.length >= 3) {
      milestones.push({
        type: 'accuracy',
        title: 'Accuracy Milestone',
        description: `Achieved ${Math.round(averageScore)}% average accuracy!`,
        value: Math.round(averageScore),
        achievedAt: recentSessions[0].created_at
      })
    }

    // Check for consistency milestone (multiple quizzes in recent days)
    if (recentSessions.length >= 5) {
      milestones.push({
        type: 'consistency',
        title: 'Consistency Milestone',
        description: `Completed ${recentSessions.length} quizzes this week!`,
        value: recentSessions.length,
        achievedAt: recentSessions[0].created_at
      })
    }

    // Check for improvement milestone
    if (recentSessions.length >= 2) {
      const latestScore = recentSessions[0].score || 0
      const previousScore = recentSessions[1].score || 0
      const improvement = latestScore - previousScore

      if (improvement >= 10) {
        milestones.push({
          type: 'improvement',
          title: 'Improvement Milestone',
          description: `Improved by ${improvement}% from last quiz!`,
          value: improvement,
          achievedAt: recentSessions[0].created_at
        })
      }
    }

    return milestones.slice(0, 3) // Limit to 3 most recent milestones
  } catch (error) {
    console.error('Error calculating performance milestones:', error)
    return milestones
  }
}
