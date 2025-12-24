// API endpoint to fetch activity heatmap data

import { NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'

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

    // Get data from the last 365 days (full year)
    const oneYearAgo = new Date()
    oneYearAgo.setDate(oneYearAgo.getDate() - 365)

    // Get all user's quiz sessions
    const { data: sessions, error: sessionsError } = await supabase
      .from('quiz_sessions')
      .select('id, created_at')
      .eq('user_id', user.id)
      .gte('created_at', oneYearAgo.toISOString())
      .order('created_at', { ascending: true })

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError)
      return NextResponse.json(
        { error: 'Failed to fetch activity data' },
        { status: 500 }
      )
    }

    // Get all quiz attempts for these sessions to count questions
    const sessionIds = sessions?.map(s => s.id) || []
    let attempts: Array<{ quiz_session_id: string; attempted_at: string }> = []

    if (sessionIds.length > 0) {
      const { data: attemptsData, error: attemptsError } = await supabase
        .from('quiz_attempts')
        .select('quiz_session_id, attempted_at')
        .in('quiz_session_id', sessionIds)
        .gte('attempted_at', oneYearAgo.toISOString())

      if (attemptsError) {
        console.error('Error fetching attempts:', attemptsError)
      } else {
        attempts = attemptsData || []
      }
    }

    // Group by date and count quizzes and questions
    const dailyActivity: Record<string, { quizzes: number; questions: number }> = {}

    sessions?.forEach(session => {
      const date = new Date(session.created_at).toISOString().split('T')[0]
      if (!dailyActivity[date]) {
        dailyActivity[date] = { quizzes: 0, questions: 0 }
      }
      dailyActivity[date].quizzes++
    })

    attempts.forEach(attempt => {
      const date = new Date(attempt.attempted_at).toISOString().split('T')[0]
      if (!dailyActivity[date]) {
        dailyActivity[date] = { quizzes: 0, questions: 0 }
      }
      dailyActivity[date].questions++
    })

    // Create array with all 365 days (fill missing days with 0)
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

    // Calculate statistics
    const daysWithActivity = heatmapData.filter(d => d.questions > 0).length
    const totalQuestions = heatmapData.reduce((sum, d) => sum + d.questions, 0)
    const totalQuizzes = heatmapData.reduce((sum, d) => sum + d.quizzes, 0)

    const avgQuestionsPerDay = daysWithActivity > 0 ? Math.round(totalQuestions / daysWithActivity) : 0
    const avgQuizzesPerDay = daysWithActivity > 0 ? (totalQuizzes / daysWithActivity).toFixed(1) : '0'

    // Calculate streaks
    let longestStreak = 0
    let currentStreak = 0
    let tempStreak = 0

    for (let i = heatmapData.length - 1; i >= 0; i--) {
      if (heatmapData[i].questions > 0) {
        tempStreak++
        longestStreak = Math.max(longestStreak, tempStreak)

        // Current streak is only from today going backwards
        if (i === heatmapData.length - 1 || currentStreak > 0 || i === heatmapData.length - 2) {
          currentStreak = tempStreak
        }
      } else {
        // Break current streak if we hit today or yesterday with no activity
        if (i >= heatmapData.length - 2) {
          currentStreak = 0
        }
        tempStreak = 0
      }
    }

    const response = {
      success: true,
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
    }

    console.log('[activity-heatmap] Response summary:', {
      totalDays: heatmapData.length,
      daysWithQuestions: heatmapData.filter(d => d.questions > 0).length,
      daysWithQuizzes: heatmapData.filter(d => d.quizzes > 0).length,
      totalQuestions,
      totalQuizzes,
      stats: response.stats,
      sampleDaysWithActivity: heatmapData.filter(d => d.questions > 0).slice(0, 5)
    })

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error in activity heatmap API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

