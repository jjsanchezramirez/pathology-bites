// src/app/api/content/quiz/sessions/[id]/complete/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { quizAnalyticsService } from '@/features/quiz/services/analytics-service'
import { quizService } from '@/features/quiz/services/quiz-service'
import { ActivityGenerator } from '@/shared/services/activity-generator'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user owns the quiz session
    const { data: session, error: sessionError } = await supabase
      .from('quiz_sessions')
      .select('user_id, status')
      .eq('id', id)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Quiz session not found' },
        { status: 404 }
      )
    }

    if (session.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden - You can only complete your own quiz sessions' },
        { status: 403 }
      )
    }

    // Check if quiz is already completed
    if (session.status === 'completed') {
      return NextResponse.json(
        { error: 'Quiz session is already completed' },
        { status: 400 }
      )
    }

    // Complete the quiz using the service
    const result = await quizService.completeQuiz(id, supabase)

    // Update analytics for all questions in this quiz session (batch update)
    try {
      console.log('[Quiz Complete] Starting batch analytics update for session:', id)
      await quizAnalyticsService.updateQuizSessionAnalytics(id)
      console.log('[Quiz Complete] Batch analytics update completed successfully')
    } catch (analyticsError) {
      // Don't fail the quiz completion if analytics update fails
      console.error('[Quiz Complete] Failed to update analytics:', analyticsError)
    }

    // Generate activity for quiz completion
    try {
      const activityData = ActivityGenerator.createQuizCompletedActivity({
        id: id,
        title: `Quiz Session`, // We could get the actual quiz title from the session if needed
        score: result.score,
        totalQuestions: result.totalQuestions,
        timeSpent: result.totalTimeSpent
      })

      await ActivityGenerator.createActivity(user.id, activityData)
      console.log('✅ Activity created for quiz completion:', id)
    } catch (activityError) {
      // Don't fail the quiz completion if activity creation fails
      console.error('Failed to create activity for quiz completion:', activityError)
    }

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('Error completing quiz:', error)
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to complete quiz' },
      { status: 500 }
    )
  }
}
