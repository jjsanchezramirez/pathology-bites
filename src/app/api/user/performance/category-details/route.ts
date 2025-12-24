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
    console.log('[category-details] API called')
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.log('[category-details] Auth error:', authError)
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('[category-details] User authenticated:', user.id)

    // First, get all quiz sessions for the user
    const { data: sessions, error: sessionsError } = await supabase
      .from('quiz_sessions')
      .select('id')
      .eq('user_id', user.id)

    if (sessionsError) {
      console.error('[category-details] Error fetching sessions:', sessionsError)
      return NextResponse.json(
        { error: 'Failed to fetch quiz sessions', details: sessionsError.message },
        { status: 500 }
      )
    }

    console.log('[category-details] Found', sessions?.length || 0, 'quiz sessions')

    if (!sessions || sessions.length === 0) {
      console.log('[category-details] No quiz sessions found, returning empty array')
      return NextResponse.json({
        success: true,
        data: []
      })
    }

    const sessionIds = sessions.map(s => s.id)

    // Fetch all quiz attempts for these sessions
    const { data: attempts, error: attemptsError } = await supabase
      .from('quiz_attempts')
      .select('id, is_correct, time_spent, attempted_at, quiz_session_id, question_id')
      .in('quiz_session_id', sessionIds)

    if (attemptsError) {
      console.error('[category-details] Error fetching attempts:', attemptsError)
      return NextResponse.json(
        { error: 'Failed to fetch performance data', details: attemptsError.message },
        { status: 500 }
      )
    }

    console.log('[category-details] Fetched', attempts?.length || 0, 'attempts')

    // If no attempts, return empty array
    if (!attempts || attempts.length === 0) {
      console.log('[category-details] No attempts found, returning empty array')
      return NextResponse.json({
        success: true,
        data: []
      })
    }

    // Get unique question IDs
    const questionIds = [...new Set(attempts.map(a => a.question_id))]
    console.log('[category-details] Fetching', questionIds.length, 'unique questions')

    // Fetch questions with their categories
    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .select('id, category_id')
      .in('id', questionIds)

    if (questionsError) {
      console.error('[category-details] Error fetching questions:', questionsError)
      return NextResponse.json(
        { error: 'Failed to fetch question data' },
        { status: 500 }
      )
    }

    console.log('[category-details] Fetched', questions?.length || 0, 'questions')

    // Create question -> category map
    const questionCategoryMap = new Map(
      questions?.map(q => [q.id, q.category_id]) || []
    )

    console.log('[category-details] Question->Category map size:', questionCategoryMap.size)

    // Get unique category IDs (filter out null/undefined)
    const categoryIds = [...new Set(
      Array.from(questionCategoryMap.values()).filter(Boolean) as string[]
    )]

    console.log('[category-details] Unique category IDs:', categoryIds)

    if (categoryIds.length === 0) {
      console.log('[category-details] No categories found, returning empty array')
      return NextResponse.json({
        success: true,
        data: []
      })
    }

    console.log('[category-details] Fetching', categoryIds.length, 'categories')

    // Fetch category names
    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('id, name')
      .in('id', categoryIds)

    if (categoriesError) {
      console.error('[category-details] Error fetching categories:', categoriesError)
    }

    const categoryMap = new Map(
      categories?.map((cat: any) => [cat.id, cat.name]) || []
    )

    // Group attempts by category and calculate stats
    const categoryStatsMap = new Map<string, {
      total_attempts: number
      correct_attempts: number
      total_time: number
      last_attempt_at: string
      attempts: Array<{ is_correct: boolean; attempted_at: string; time_spent: number | null }>
    }>()

    attempts.forEach((attempt: any) => {
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

      // Update last attempt if more recent
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

    // Calculate recent performance (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Build the final category details array
    const categoryDetails: CategoryPerformance[] = Array.from(categoryStatsMap.entries()).map(
      ([categoryId, stats]) => {
        const accuracy = stats.total_attempts > 0
          ? Math.round((stats.correct_attempts / stats.total_attempts) * 100)
          : 0

        const avgTime = stats.total_attempts > 0
          ? Math.round(stats.total_time / stats.total_attempts)
          : 0

        // Filter recent attempts (last 30 days)
        const recentAttempts = stats.attempts.filter(
          a => new Date(a.attempted_at) >= thirtyDaysAgo
        )

        // Group by date for daily stats
        const dailyStats = new Map<string, { correct: number; total: number }>()

        recentAttempts.forEach((attempt) => {
          const date = new Date(attempt.attempted_at).toISOString().split('T')[0]
          const dayStats = dailyStats.get(date) || { correct: 0, total: 0 }
          dayStats.total++
          if (attempt.is_correct) dayStats.correct++
          dailyStats.set(date, dayStats)
        })

        // Convert to array and sort by date (most recent first)
        const recentPerformance = Array.from(dailyStats.entries())
          .map(([date, dayStats]) => ({
            date,
            accuracy: Math.round((dayStats.correct / dayStats.total) * 100),
            questions_answered: dayStats.total
          }))
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 7) // Last 7 days with activity

        return {
          category_id: categoryId,
          category_name: categoryMap.get(categoryId) || 'Unknown Category',
          total_attempts: stats.total_attempts,
          correct_attempts: stats.correct_attempts,
          accuracy,
          average_time: avgTime,
          last_attempt_at: stats.last_attempt_at,
          recent_performance: recentPerformance
        }
      }
    )

    // Sort by last attempt date (most recent first)
    categoryDetails.sort((a, b) =>
      new Date(b.last_attempt_at).getTime() - new Date(a.last_attempt_at).getTime()
    )

    console.log('[category-details] Returning', categoryDetails.length, 'category details')

    return NextResponse.json({
      success: true,
      data: categoryDetails
    })

  } catch (error) {
    console.error('[category-details] Error in category details API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

