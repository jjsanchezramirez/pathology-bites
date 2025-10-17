// src/app/api/user/dashboard/consolidated/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'

// Cache for dashboard data to reduce database load and Vercel function costs
let dashboardCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes for dashboard data (increased from 2 minutes)

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Auth is now handled by middleware - get user info from headers
    const userId = request.headers.get('x-user-id')
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check cache for fresh data
    const cacheKey = `dashboard-${userId}`
    const cached = dashboardCache.get(cacheKey)
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        data: cached.data,
        source: 'cache'
      }, {
        headers: {
          'Cache-Control': 'private, max-age=300, s-maxage=300', // 5 minute cache for dashboard data
          'Vercel-CDN-Cache-Control': 'max-age=0' // Don't cache user data at CDN level
        }
      })
    }

    // Get all dashboard data in parallel to minimize latency
    const [
      statsResult,
      activitiesResult,
      settingsResult,
      recentQuizzesResult
    ] = await Promise.all([
      // Simplified stats query - using RPC if available
      getDashboardStats(supabase, userId),

      // Recent activities (from quiz sessions)
      supabase
        .from('quiz_sessions')
        .select('id, title, status, score, total_questions, created_at, completed_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10),

      // User settings
      supabase
        .from('user_settings')
        .select('quiz_settings, notification_settings, ui_settings')
        .eq('user_id', userId)
        .maybeSingle(),

      // Recent quiz sessions with performance
      supabase
        .from('quiz_sessions')
        .select(`
          id, title, status, score, total_questions, correct_answers,
          created_at, completed_at, total_time_spent, config
        `)
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(5)
    ])

    // Process results
    const stats = statsResult || getDefaultStats()
    const goals = goalsResult.data || []
    const activities = formatActivities(activitiesResult.data || [])
    const settings = settingsResult.data || getDefaultSettings()
    const recentQuizzes = formatRecentQuizzes(recentQuizzesResult.data || [])

    // Note: Weekly progress calculations moved to client-side to reduce server processing

    // Combine all dashboard data
    const dashboardData = {
      stats: {
        ...stats
        // Weekly calculations moved to client-side for better performance
      },
      recentActivity: activities,
      settings,
      recentQuizzes,
      summary: {
        totalQuizzesCompleted: stats.totalQuizzes || 0,
        currentStreak: stats.studyStreak || 0,
        averageScore: stats.averageScore || 0
      },
      lastUpdated: new Date().toISOString()
    }

    // Cache the result
    dashboardCache.set(cacheKey, {
      data: dashboardData,
      timestamp: Date.now()
    })

    // Clean old cache entries (keep cache size manageable)
    if (dashboardCache.size > 100) {
      const oldestKey = Array.from(dashboardCache.keys())[0]
      dashboardCache.delete(oldestKey)
    }

    return NextResponse.json({
      success: true,
      data: dashboardData,
      source: 'database'
    }, {
      headers: {
        'Cache-Control': 'private, max-age=300, s-maxage=300', // 5 minute cache for dashboard data
        'Vercel-CDN-Cache-Control': 'max-age=0' // Don't cache user data at CDN level
      }
    })

  } catch (error) {
    console.error('Error in consolidated dashboard API:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch dashboard data',
        success: false,
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Optimized stats calculation
async function getDashboardStats(supabase: any, userId: string) {
  try {
    // Fetch quiz sessions and attempts for stats calculation
    const [sessionsResult, attemptsResult] = await Promise.all([
      supabase
        .from('quiz_sessions')
        .select('id, score, total_questions, correct_answers, created_at, status')
        .eq('user_id', userId),

      supabase
        .from('quiz_attempts')
        .select('question_id, is_correct, attempted_at')
        .in('quiz_session_id', supabase
          .from('quiz_sessions')
          .select('id')
          .eq('user_id', userId)
        )
    ])

    const sessions = sessionsResult.data || []
    const attempts = attemptsResult.data || []

    const completedSessions = sessions.filter(s => s.status === 'completed')
    const totalQuizzes = completedSessions.length
    const averageScore = totalQuizzes > 0
      ? Math.round(completedSessions.reduce((sum, s) => sum + (s.score || 0), 0) / totalQuizzes)
      : 0

    // Calculate unique questions attempted
    const uniqueQuestions = new Set(attempts.map(a => a.question_id)).size

    // Calculate study streak
    const studyStreak = calculateStudyStreak(completedSessions)

    return {
      totalQuizzes,
      averageScore,
      uniqueQuestions,
      studyStreak,
      totalAttempts: attempts.length,
      correctAttempts: attempts.filter(a => a.is_correct).length
    }

  } catch (error) {
    console.error('Error calculating dashboard stats:', error)
    return getDefaultStats()
  }
}

// Helper functions
function getDefaultStats() {
  return {
    totalQuizzes: 0,
    averageScore: 0,
    uniqueQuestions: 0,
    studyStreak: 0,
    totalAttempts: 0,
    correctAttempts: 0
  }
}

function getDefaultSettings() {
  return {
    quiz_settings: {
      default_question_count: 10,
      default_mode: 'tutor',
      default_timing: 'untimed'
    },
    notification_settings: {
      email_notifications: true,
      quiz_reminders: true
    },
    ui_settings: {
      theme: 'system',
      font_size: 'medium'
    }
  }
}

function formatActivities(sessions: any[]) {
  return sessions.map(session => ({
    id: `session-${session.id}`,
    type: session.status === 'completed' ? 'quiz_completed' : 'quiz_started',
    title: session.title || 'Quiz',
    description: session.status === 'completed' 
      ? `Scored ${session.score || 0}% on ${session.total_questions} questions`
      : `Started quiz with ${session.total_questions} questions`,
    timestamp: new Date(session.created_at),
    score: session.score,
    navigationUrl: session.status === 'completed' 
      ? `/dashboard/quiz/${session.id}/results`
      : `/dashboard/quiz/${session.id}`
  })).slice(0, 8) // Limit to most recent activities
}

function formatRecentQuizzes(sessions: any[]) {
  return sessions.map(session => ({
    id: session.id,
    title: session.title || 'Quiz',
    score: session.score || 0,
    totalQuestions: session.total_questions || 0,
    correctAnswers: session.correct_answers || 0,
    completedAt: session.completed_at,
    timeSpent: session.total_time_spent || 0,
    mode: session.config?.mode || 'practice'
  }))
}

function calculateStudyStreak(completedSessions: any[]): number {
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

  for (let i = 0; i < 30; i++) { // Check last 30 days max
    const checkDate = new Date(today)
    checkDate.setDate(today.getDate() - i)
    const dateString = checkDate.toDateString()

    if (sessionsByDate.has(dateString)) {
      streak++
    } else if (i > 0) { // Don't break on first day if no activity
      break
    }
  }

  return streak
}

// Add a cache clear endpoint for when user data changes
export async function DELETE(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Clear user's cached dashboard data
    const cacheKey = `dashboard-${userId}`
    dashboardCache.delete(cacheKey)
    
    return NextResponse.json({ message: 'Dashboard cache cleared' })
  } catch (error) {
    console.error('Error clearing dashboard cache:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}