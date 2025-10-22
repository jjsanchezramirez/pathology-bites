// API endpoint to fetch detailed performance data by category

import { NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'

interface CategoryPerformance {
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

    // Fetch performance analytics by category
    const { data: performanceData, error: performanceError } = await supabase
      .from('performance_analytics')
      .select(`
        category_id,
        total_questions,
        questions_answered,
        correct_answers,
        average_time,
        last_attempt_at,
        categories (
          name
        )
      `)
      .eq('user_id', user.id)
      .not('category_id', 'is', null)
      .order('last_attempt_at', { ascending: false })

    if (performanceError) {
      console.error('Error fetching performance data:', performanceError)
      return NextResponse.json(
        { error: 'Failed to fetch performance data' },
        { status: 500 }
      )
    }

    // If no performance data, return empty array
    if (!performanceData || performanceData.length === 0) {
      return NextResponse.json({
        success: true,
        data: []
      })
    }

    // Fetch recent quiz attempts for trend analysis (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: recentAttempts, error: attemptsError } = await supabase
      .from('quiz_attempts')
      .select('category_id, is_correct, attempted_at')
      .eq('user_id', user.id)
      .gte('attempted_at', thirtyDaysAgo.toISOString())
      .order('attempted_at', { ascending: false })

    if (attemptsError) {
      console.error('Error fetching recent attempts:', attemptsError)
    }

    // Process data to calculate trends and recent performance
    const categoryDetails: CategoryPerformance[] = performanceData.map((perf: any) => {
      const accuracy = perf.questions_answered > 0
        ? Math.round((perf.correct_answers / perf.questions_answered) * 100)
        : 0

      // Get recent attempts for this category
      const categoryAttempts = recentAttempts?.filter(
        (attempt: any) => attempt.category_id === perf.category_id
      ) || []

      // Group attempts by date and calculate daily accuracy
      const dailyStats = new Map<string, { correct: number; total: number }>()
      
      categoryAttempts.forEach((attempt: any) => {
        const date = new Date(attempt.attempted_at).toISOString().split('T')[0]
        const stats = dailyStats.get(date) || { correct: 0, total: 0 }
        stats.total++
        if (attempt.is_correct) stats.correct++
        dailyStats.set(date, stats)
      })

      // Convert to array and sort by date (most recent first)
      const recentPerformance = Array.from(dailyStats.entries())
        .map(([date, stats]) => ({
          date,
          accuracy: Math.round((stats.correct / stats.total) * 100),
          questions_answered: stats.total
        }))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 7) // Last 7 days with activity

      return {
        category_id: perf.category_id,
        category_name: perf.categories?.name || 'Unknown Category',
        total_attempts: perf.questions_answered,
        correct_attempts: perf.correct_answers,
        accuracy,
        average_time: perf.average_time || 0,
        last_attempt_at: perf.last_attempt_at,
        recent_performance: recentPerformance
      }
    })

    // Sort by last attempt date (most recent first)
    categoryDetails.sort((a, b) => 
      new Date(b.last_attempt_at).getTime() - new Date(a.last_attempt_at).getTime()
    )

    return NextResponse.json({
      success: true,
      data: categoryDetails
    })

  } catch (error) {
    console.error('Error in category details API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

