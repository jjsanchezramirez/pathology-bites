// src/app/api/quiz/attempts/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { quizService } from '@/features/quiz/services/quiz-service'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const { sessionId, questionId, selectedAnswerId, firstAnswerId, timeSpent } = await request.json()

    // Validate required fields
    if (!sessionId || !questionId || !selectedAnswerId) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, questionId, selectedAnswerId' },
        { status: 400 }
      )
    }

    // Verify user owns the quiz session
    const { data: session, error: sessionError } = await supabase
      .from('quiz_sessions')
      .select('user_id')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Quiz session not found' },
        { status: 404 }
      )
    }

    if (session.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden - You can only submit answers to your own quiz sessions' },
        { status: 403 }
      )
    }

    // Note: Duplicate submission check is handled on the client side

    // Submit answer using the service with authenticated client
    const attempt = await quizService.submitAnswer(
      sessionId,
      questionId,
      selectedAnswerId,
      timeSpent || 0,
      supabase,
      firstAnswerId
    )

    return NextResponse.json({
      success: true,
      data: {
        attemptId: attempt.id,
        isCorrect: attempt.isCorrect,
        timeSpent: attempt.timeSpent
      }
    })

  } catch (error) {
    console.error('Error submitting quiz attempt:', error)
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to submit answer' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId parameter is required' },
        { status: 400 }
      )
    }

    // Verify user owns the quiz session
    const { data: session, error: sessionError } = await supabase
      .from('quiz_sessions')
      .select('user_id')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Quiz session not found' },
        { status: 404 }
      )
    }

    if (session.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden - You can only access your own quiz attempts' },
        { status: 403 }
      )
    }

    // Get attempts for this session
    const { data: attempts, error } = await supabase
      .from('quiz_attempts')
      .select(`
        *,
        question:questions(
          id,
          title,
          difficulty
        ),
        selected_answer:question_options(
          id,
          text,
          is_correct
        )
      `)
      .eq('quiz_session_id', sessionId)
      .order('attempted_at', { ascending: true })

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: attempts || []
    })

  } catch (error) {
    console.error('Error fetching quiz attempts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch quiz attempts' },
      { status: 500 }
    )
  }
}
