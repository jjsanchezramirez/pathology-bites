// src/app/api/dashboard/stats/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'

export async function GET(request: NextRequest) {
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

    // Calculate user statistics
    const completedQuestions = attempts?.length || 0
    const correctAnswers = attempts?.filter(attempt => attempt.is_correct).length || 0
    const averageScore = completedQuestions > 0 ? Math.round((correctAnswers / completedQuestions) * 100) : 0

    // Calculate study streak (consecutive days with completed quizzes)
    const studyStreak = calculateStudyStreak(completedSessions || [])

    // Calculate weekly progress (questions answered this week)
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()) // Start of current week
    weekStart.setHours(0, 0, 0, 0)

    const weeklyQuestions = attempts?.filter(attempt => {
      const attemptDate = new Date(attempt.attempted_at)
      return attemptDate >= weekStart
    }).length || 0

    // Get recent quiz sessions for activity
    const { data: recentSessions, error: sessionsError } = await supabase
      .from('quiz_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)

    if (sessionsError) throw sessionsError

    // Format the response
    const stats = {
      totalQuestions: totalQuestions || 0,
      completedQuestions,
      averageScore,
      studyStreak,
      recentQuizzes: completedSessions?.length || 0,
      weeklyGoal: 50, // This could be user-configurable
      currentWeekProgress: weeklyQuestions,
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
      }))
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
