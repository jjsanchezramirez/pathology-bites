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

    // Try to get basic question count (this should work with any database)
    try {
      const queryStart = Date.now()
      const { count: totalQuestions, error: questionsError } = await supabase
        .from(TABLE_NAMES.QUESTIONS)
        .select('*', { count: 'exact', head: true })

      const queryDuration = Date.now() - queryStart
      devLog.database({
        query: `SELECT COUNT(*) FROM ${TABLE_NAMES.QUESTIONS}`,
        duration: queryDuration,
        rows: totalQuestions || 0,
      })

      if (!questionsError && totalQuestions !== null) {
        stats.allQuestions = totalQuestions
        stats.totalQuestions = totalQuestions
        stats.unused = totalQuestions // Default all to unused for now
        devLog.info('Questions count retrieved', { totalQuestions, duration: queryDuration })
      } else {
        devLog.warn('Could not get questions count', questionsError)
      }
    } catch (error) {
      devLog.error('Questions query failed', error)
    }

    // Try to get user profile info
    try {
      const { data: profile, error: profileError } = await supabase
        .from(TABLE_NAMES.USERS)
        .select('*')
        .eq('id', user.id)
        .single()
      
      if (!profileError && profile) {
        console.log('Found user profile')
      }
    } catch (error) {
      console.warn('Profile query failed:', error)
    }

    // Try to get quiz data if tables exist
    try {
      const queryStart = Date.now()
      // Check if quiz_sessions table exists by trying a simple query
      const { data: sessions, error: sessionsError } = await supabase
        .from(TABLE_NAMES.QUIZ_SESSIONS)
        .select('id, score, created_at, status')
        .eq('user_id', user.id)
        .limit(5)

      const queryDuration = Date.now() - queryStart
      devLog.database({
        query: `SELECT id, score, created_at, status FROM ${TABLE_NAMES.QUIZ_SESSIONS} WHERE user_id = $1 LIMIT 5`,
        duration: queryDuration,
        rows: sessions?.length || 0,
      })

      if (!sessionsError && sessions) {
        devLog.info('Quiz sessions retrieved', { count: sessions.length, duration: queryDuration })
        stats.recentQuizzes = sessions.length

        // Calculate basic stats from sessions
        const completedSessions = sessions.filter(s => s.status === SESSION_STATUSES[2]) // 'completed'
        stats.performance!.completedQuizzes = completedSessions.length

        if (completedSessions.length > 0) {
          const scores = completedSessions.map(s => s.score || 0)
          stats.averageScore = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
          stats.performance!.overallScore = stats.averageScore
        }
        
        // Generate simple recent activity
        sessions.forEach((session, index) => {
          const isCompleted = session.status === SESSION_STATUSES[2] // 'completed'
          stats.recentActivity.push({
            id: `session-${session.id}`,
            type: isCompleted ? 'quiz_completed' : 'quiz_started',
            title: isCompleted ? 'Completed Quiz' : 'Started Quiz',
            description: isCompleted
              ? `Scored ${session.score || 0}%`
              : 'Quiz in progress',
            timestamp: formatTimeAgo(new Date(session.created_at)),
            score: session.score || undefined,
            navigationUrl: isCompleted
              ? `/dashboard/quiz/${session.id}/results`
              : `/dashboard/quiz/${session.id}`
          })
        })
      }
    } catch (error) {
      console.warn('Quiz sessions query failed (table may not exist):', error)
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