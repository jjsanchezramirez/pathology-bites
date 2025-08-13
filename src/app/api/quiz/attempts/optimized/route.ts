// src/app/api/quiz/attempts/optimized/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Auth is handled by middleware
    const userId = request.headers.get('x-user-id')
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { sessionId, questionId, selectedAnswerId, timeSpent } = body

    // Validate required fields
    if (!sessionId || !questionId || !selectedAnswerId) {
      return NextResponse.json({
        error: 'Missing required fields: sessionId, questionId, selectedAnswerId'
      }, { status: 400 })
    }

    // Use a single RPC call for attempt submission with all validations
    const { data: result, error } = await supabase.rpc('submit_quiz_attempt_optimized', {
      p_user_id: userId,
      p_session_id: sessionId,
      p_question_id: questionId,
      p_selected_answer_id: selectedAnswerId,
      p_time_spent: timeSpent || 0
    })

    if (error) {
      // Handle specific error types from the RPC function
      if (error.message?.includes('session_not_found')) {
        return NextResponse.json({ error: 'Quiz session not found' }, { status: 404 })
      } else if (error.message?.includes('session_not_owned')) {
        return NextResponse.json({ error: 'Session does not belong to user' }, { status: 403 })
      } else if (error.message?.includes('already_answered')) {
        return NextResponse.json({ error: 'Question already answered' }, { status: 409 })
      }
      
      throw error
    }

    const attemptResult = result?.[0]
    if (!attemptResult) {
      throw new Error('No result from attempt submission')
    }

    return NextResponse.json({
      success: true,
      data: {
        id: attemptResult.attempt_id,
        isCorrect: attemptResult.is_correct,
        correctAnswerId: attemptResult.correct_answer_id,
        explanation: attemptResult.explanation,
        nextQuestionId: attemptResult.next_question_id,
        isSessionComplete: attemptResult.is_session_complete,
        sessionScore: attemptResult.session_score,
        questionNumber: attemptResult.question_number,
        totalQuestions: attemptResult.total_questions
      }
    })

  } catch (error) {
    console.error('Error in optimized quiz attempts:', error)
    
    if (error instanceof Error) {
      return NextResponse.json({
        error: error.message,
        success: false
      }, { status: 400 })
    }

    return NextResponse.json({
      error: 'Failed to submit quiz attempt',
      success: false
    }, { status: 500 })
  }
}

// Optimized GET endpoint for quiz attempts with better performance
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Auth is handled by middleware
    const userId = request.headers.get('x-user-id')
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Optimized query with single JOIN instead of multiple queries
    let query = supabase
      .from('quiz_attempts')
      .select(`
        id,
        question_id,
        selected_answer_id,
        is_correct,
        time_spent,
        attempted_at,
        questions!inner(
          id,
          question_text,
          explanation,
          answer_options
        ),
        quiz_sessions!inner(
          id,
          title,
          user_id
        )
      `)
      .eq('quiz_sessions.user_id', userId)
      .order('attempted_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Filter by session if provided
    if (sessionId) {
      query = query.eq('quiz_session_id', sessionId)
    }

    const { data: attempts, error } = await query

    if (error) {
      throw error
    }

    // Format response data
    const formattedAttempts = attempts?.map(attempt => ({
      id: attempt.id,
      questionId: attempt.question_id,
      selectedAnswerId: attempt.selected_answer_id,
      isCorrect: attempt.is_correct,
      timeSpent: attempt.time_spent,
      attemptedAt: attempt.attempted_at,
      question: {
        id: attempt.questions?.[0]?.id,
        text: attempt.questions?.[0]?.question_text,
        explanation: attempt.questions?.[0]?.explanation,
        answerOptions: attempt.questions?.[0]?.answer_options
      },
      session: {
        id: attempt.quiz_sessions?.[0]?.id,
        title: attempt.quiz_sessions?.[0]?.title
      }
    })) || []

    return NextResponse.json({
      success: true,
      data: formattedAttempts,
      pagination: {
        limit,
        offset,
        total: formattedAttempts.length
      }
    })

  } catch (error) {
    console.error('Error fetching quiz attempts:', error)
    return NextResponse.json({
      error: 'Failed to fetch quiz attempts',
      success: false
    }, { status: 500 })
  }
}