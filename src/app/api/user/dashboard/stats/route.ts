// User Dashboard Stats API - Simplified Working Implementation
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { TABLE_NAMES, SESSION_STATUSES } from '@/shared/constants/database-types'
import { devLog, measureTime } from '@/shared/utils/dev-logger'

// Simplified interface matching frontend expectations
interface DashboardStats {
  // Main stats expected by frontend
  allQuestions: number
  needsReview: number
  mastered: number
  unused: number
  
  // Legacy compatibility
  totalQuestions: number
  completedQuestions: number
  
  // Other stats
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
  
  // Performance analytics (simplified)
  performance?: {
    userPercentile: number
    peerRank: number
    totalUsers: number
    completedQuizzes: number
    subjectsForImprovement: Array<{
      name: string
      score: number
      attempts: number
    }>
    subjectsMastered: Array<{
      name: string
      score: number
      attempts: number
    }>
    overallScore: number
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const requestId = request.headers.get('x-request-id') || 'unknown'

  try {
    devLog.info('Dashboard stats API called', { requestId })

    // Create Supabase client
    let supabase
    try {
      supabase = await createClient()
      devLog.debug('Supabase client created', { requestId })
    } catch (clientError) {
      devLog.error('Supabase client creation failed', clientError)
      return NextResponse.json({
        error: 'Service temporarily unavailable',
        success: false,
        details: 'Database connection failed'
      }, { status: 503 })
    }

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      devLog.error('Dashboard stats auth error', authError)
      return NextResponse.json({
        error: 'Unauthorized',
        success: false,
        details: 'Authentication required'
      }, { status: 401 })
    }

    devLog.info('User authenticated', { userId: user.id, requestId })

    // Start with safe defaults
    const stats: DashboardStats = {
      allQuestions: 0,
      needsReview: 0,
      mastered: 0,
      unused: 0,
      totalQuestions: 0,
      completedQuestions: 0,
      averageScore: 0,
      studyStreak: 0,
      recentQuizzes: 0,
      weeklyGoal: 50,
      currentWeekProgress: 0,
      recentActivity: [],
      performance: {
        userPercentile: 50,
        peerRank: 50,
        totalUsers: 100,
        completedQuizzes: 0,
        subjectsForImprovement: [],
        subjectsMastered: [],
        overallScore: 0
      }
    }

    // OPTIMIZATION: Parallelize all database queries using Promise.all()
    const queryStart = Date.now()

    const [
      questionsResult,
      sessionsResult,
      attemptsResult,
      performanceResult,
      allUsersScoresResult,
      completedQuizzesResult
    ] = await Promise.all([
      // 1. Get total questions count
      supabase
        .from(TABLE_NAMES.QUESTIONS)
        .select('*', { count: 'exact', head: true })
        .then(result => ({ data: result.count, error: result.error })),

      // 2. Get recent quiz sessions
      supabase
        .from(TABLE_NAMES.QUIZ_SESSIONS)
        .select('id, score, created_at, status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),

      // 3. Get quiz attempts to calculate mastered/needs review
      supabase
        .from(TABLE_NAMES.QUIZ_ATTEMPTS)
        .select('question_id, is_correct')
        .eq('user_id', user.id),

      // 4. Get performance analytics by category
      supabase
        .from(TABLE_NAMES.PERFORMANCE_ANALYTICS)
        .select(`
          category_id,
          total_questions,
          questions_answered,
          correct_answers,
          categories!inner(name)
        `)
        .eq('user_id', user.id)
        .gt('questions_answered', 0),

      // 5. Get all users' average scores for percentile calculation
      supabase
        .from(TABLE_NAMES.QUIZ_SESSIONS)
        .select('user_id, score')
        .eq('status', SESSION_STATUSES[2]) // 'completed'
        .not('score', 'is', null),

      // 6. Get count of ALL completed quizzes for this user (not just last 5)
      supabase
        .from(TABLE_NAMES.QUIZ_SESSIONS)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', SESSION_STATUSES[2]) // 'completed'
        .then(result => ({ data: result.count, error: result.error }))
    ])

    const queryDuration = Date.now() - queryStart
    devLog.info('All queries completed in parallel', { duration: queryDuration })

    // Process total questions
    if (!questionsResult.error && questionsResult.data !== null) {
      stats.allQuestions = questionsResult.data
      stats.totalQuestions = questionsResult.data
      devLog.info('Questions count retrieved', { totalQuestions: questionsResult.data })
    }

    // Process count of ALL completed quizzes
    if (!completedQuizzesResult.error && completedQuizzesResult.data !== null) {
      stats.performance!.completedQuizzes = completedQuizzesResult.data
    }

    // Process quiz sessions
    if (!sessionsResult.error && sessionsResult.data) {
      const sessions = sessionsResult.data
      stats.recentQuizzes = sessions.length

      // Calculate basic stats from sessions (only from recent sessions for average)
      const completedSessions = sessions.filter(s => s.status === SESSION_STATUSES[2]) // 'completed'

      if (completedSessions.length > 0) {
        const scores = completedSessions.map(s => s.score || 0)
        stats.averageScore = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
        stats.performance!.overallScore = stats.averageScore
      }

      // Generate recent activity
      sessions.forEach((session) => {
        const isCompleted = session.status === SESSION_STATUSES[2] // 'completed'
        stats.recentActivity.push({
          id: `session-${session.id}`,
          type: isCompleted ? 'quiz_completed' : 'quiz_started',
          title: isCompleted ? 'Completed Quiz' : 'Started Quiz',
          description: isCompleted
            ? 'View detailed results'
            : 'Quiz in progress',
          timestamp: formatTimeAgo(new Date(session.created_at)),
          score: session.score || undefined,
          navigationUrl: isCompleted
            ? `/dashboard/quiz/${session.id}/results`
            : `/dashboard/quiz/${session.id}`
        })
      })
    }

    // Process quiz attempts to calculate mastered/needs review/unused
    if (!attemptsResult.error && attemptsResult.data) {
      const attempts = attemptsResult.data

      // Group attempts by question_id
      const questionAttempts = new Map<string, { correct: number; incorrect: number }>()

      attempts.forEach(attempt => {
        const existing = questionAttempts.get(attempt.question_id) || { correct: 0, incorrect: 0 }
        if (attempt.is_correct) {
          existing.correct++
        } else {
          existing.incorrect++
        }
        questionAttempts.set(attempt.question_id, existing)
      })

      // Calculate mastered (2+ correct answers, no recent incorrect)
      // Calculate needs review (any incorrect answers)
      let mastered = 0
      let needsReview = 0

      questionAttempts.forEach((counts) => {
        if (counts.correct >= 2 && counts.incorrect === 0) {
          mastered++
        } else if (counts.incorrect > 0) {
          needsReview++
        }
      })

      stats.mastered = mastered
      stats.needsReview = needsReview
      stats.completedQuestions = questionAttempts.size
      stats.unused = Math.max(0, stats.totalQuestions - questionAttempts.size)

      devLog.info('Question progress calculated', { mastered, needsReview, unused: stats.unused })
    } else {
      // No attempts yet - all questions are unused
      stats.unused = stats.totalQuestions
    }

    // Process performance analytics for subjects
    if (!performanceResult.error && performanceResult.data) {
      const analytics = performanceResult.data

      analytics.forEach((item: any) => {
        const categoryName = item.categories?.name || 'Unknown'
        const score = item.questions_answered > 0
          ? Math.round((item.correct_answers / item.questions_answered) * 100)
          : 0

        // Subjects for improvement: score < 70%
        if (score < 70 && item.questions_answered >= 3) {
          stats.performance!.subjectsForImprovement.push({
            name: categoryName,
            score,
            attempts: item.questions_answered
          })
        }

        // Mastered subjects: score >= 85%
        if (score >= 85 && item.questions_answered >= 5) {
          stats.performance!.subjectsMastered.push({
            name: categoryName,
            score,
            attempts: item.questions_answered
          })
        }
      })

      // Sort by score (lowest first for improvement, highest first for mastered)
      stats.performance!.subjectsForImprovement.sort((a, b) => a.score - b.score)
      stats.performance!.subjectsMastered.sort((a, b) => b.score - a.score)

      // Limit to top 5 each
      stats.performance!.subjectsForImprovement = stats.performance!.subjectsForImprovement.slice(0, 5)
      stats.performance!.subjectsMastered = stats.performance!.subjectsMastered.slice(0, 5)
    }

    // Calculate percentile and peer ranking
    if (!allUsersScoresResult.error && allUsersScoresResult.data && stats.averageScore > 0) {
      const allScores = allUsersScoresResult.data

      // Calculate average score per user
      const userScores = new Map<string, number[]>()
      allScores.forEach(item => {
        const scores = userScores.get(item.user_id) || []
        scores.push(item.score)
        userScores.set(item.user_id, scores)
      })

      const userAverages = Array.from(userScores.entries()).map(([userId, scores]) => ({
        userId,
        avgScore: scores.reduce((sum, s) => sum + s, 0) / scores.length
      }))

      // Calculate percentile (percentage of users with lower average score)
      const usersWithLowerScore = userAverages.filter(u => u.avgScore < stats.averageScore).length
      const percentile = userAverages.length > 1
        ? Math.round((usersWithLowerScore / userAverages.length) * 100)
        : 50

      // Calculate peer rank (position when sorted by score, descending)
      const sortedUsers = userAverages.sort((a, b) => b.avgScore - a.avgScore)
      const userRank = sortedUsers.findIndex(u => u.userId === user.id) + 1

      stats.performance!.userPercentile = percentile
      stats.performance!.peerRank = userRank > 0 ? userRank : 50
      stats.performance!.totalUsers = userAverages.length

      devLog.info('Percentile calculated', { percentile, rank: userRank, totalUsers: userAverages.length })
    }

    // If no real activity, add welcome messages
    if (stats.recentActivity.length === 0) {
      stats.recentActivity = [
        {
          id: 'welcome-1',
          type: 'welcome',
          title: 'Start Your First Quiz',
          description: 'Take a quick starter quiz to see how we track your progress and identify your learning needs.',
          timestamp: 'Just now',
          navigationUrl: '/dashboard/quiz/new'
        },
        {
          id: 'welcome-2',
          type: 'tip',
          title: 'Explore Educational Tools',
          description: 'Check out our citation generator, gene lookup, and virtual slides to enhance your learning.',
          timestamp: 'Just now',
          navigationUrl: '/tools'
        }
      ]
    }

    const totalDuration = Date.now() - startTime
    devLog.performance('Dashboard stats compilation', totalDuration, {
      requestId,
      questionsCount: stats.allQuestions,
      recentQuizzes: stats.recentQuizzes,
    })

    devLog.info('Dashboard stats compiled successfully', {
      requestId,
      duration: totalDuration,
    })

    return NextResponse.json({
      success: true,
      data: stats
    })

  } catch (error) {
    const totalDuration = Date.now() - startTime
    devLog.error('Error in dashboard stats API', error)
    devLog.performance('Dashboard stats error', totalDuration, {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    
    // Return error response with safe defaults
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch dashboard statistics',
      data: {
        allQuestions: 0,
        needsReview: 0,
        mastered: 0,
        unused: 0,
        totalQuestions: 0,
        completedQuestions: 0,
        averageScore: 0,
        studyStreak: 0,
        recentQuizzes: 0,
        weeklyGoal: 50,
        currentWeekProgress: 0,
        recentActivity: [{
          id: 'error-1',
          type: 'error',
          title: 'Dashboard Loading Error',
          description: 'Please refresh the page or contact support if the issue persists.',
          timestamp: 'Just now'
        }],
        performance: {
          userPercentile: 50,
          peerRank: 50,
          totalUsers: 100,
          completedQuizzes: 0,
          subjectsForImprovement: [],
          subjectsMastered: [],
          overallScore: 0
        }
      }
    }, { status: 200 }) // Return 200 with error data so frontend doesn't break
  }
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