// API endpoint to fetch performance timeline data

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

    // Get completed quiz sessions from the last 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: sessions, error } = await supabase
      .from('quiz_sessions')
      .select('completed_at, score, title')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .gte('completed_at', thirtyDaysAgo.toISOString())
      .not('score', 'is', null)
      .order('completed_at', { ascending: true })

    if (error) {
      console.error('Error fetching timeline data:', error)
      return NextResponse.json(
        { error: 'Failed to fetch timeline data' },
        { status: 500 }
      )
    }

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({
        success: true,
        data: []
      })
    }

    // Group quizzes by completion date
    const dailyData: Record<string, { scores: number[]; count: number }> = {}

    sessions.forEach(session => {
      const date = new Date(session.completed_at).toISOString().split('T')[0]
      if (!dailyData[date]) {
        dailyData[date] = { scores: [], count: 0 }
      }
      dailyData[date].scores.push(session.score)
      dailyData[date].count++
    })

    // Convert to array format for charts and sort by date
    const timelineData = Object.entries(dailyData)
      .map(([date, stats]) => ({
        date,
        accuracy: stats.scores.length > 0
          ? stats.scores.reduce((sum, score) => sum + score, 0) / stats.scores.length
          : 0,
        quizzes: stats.count
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({
      success: true,
      data: timelineData
    })

  } catch (error) {
    console.error('Error in timeline API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

