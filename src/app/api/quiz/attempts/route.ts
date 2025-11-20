// src/app/api/quiz/attempts/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'

export async function POST(request: NextRequest) {
  let sessionId: string | undefined
  let questionId: string | undefined
  let selectedAnswerId: string | undefined
  let firstAnswerId: string | undefined
  let timeSpent: number | undefined
  let user: any

  try {
    const supabase = await createClient()

    // Check if user is authenticated
    const { data: { user: authenticatedUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authenticatedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    user = authenticatedUser

    // Parse request body
    const requestBody = await request.json()
    sessionId = requestBody.sessionId
    questionId = requestBody.questionId
    selectedAnswerId = requestBody.selectedAnswerId
    firstAnswerId = requestBody.firstAnswerId
    timeSpent = requestBody.timeSpent

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
      console.error('[API] /api/quiz/attempts - Quiz session not found:', sessionId, sessionError)
      return NextResponse.json(
        { error: 'Quiz session not found' },
        { status: 404 }
      )
    }

    if (session.user_id !== user.id) {
      console.error('[API] /api/quiz/attempts - Unauthorized access attempt:', { sessionUserId: session.user_id, requestUserId: user.id })
      return NextResponse.json(
        { error: 'Forbidden - You can only submit answers to your own quiz sessions' },
        { status: 403 }
      )
    }

    // Check for existing attempt to prevent duplicates
    const { data: existingAttempt, error: existingAttemptError } = await supabase
      .from('quiz_attempts')
      .select('id')
      .eq('quiz_session_id', sessionId)
      .eq('question_id', questionId)
      .maybeSingle()

    if (existingAttemptError) {
      console.error('[API] /api/quiz/attempts - Error checking for existing attempt:', existingAttemptError)
    } else if (existingAttempt) {
      console.log('[API] /api/quiz/attempts - Duplicate submission detected, returning existing attempt')
      // Return the existing attempt instead of creating a new one
      const { data: fullAttempt, error: fullAttemptError } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('id', existingAttempt.id)
        .single()

      if (fullAttemptError) {
        console.error('[API] /api/quiz/attempts - Error fetching existing attempt:', fullAttemptError)
      } else {
        return NextResponse.json({
          success: true,
          data: {
            attemptId: fullAttempt.id,
            isCorrect: fullAttempt.is_correct,
            timeSpent: fullAttempt.time_spent
          }
        })
      }
    }

    // Validate that the selected answer exists and belongs to the question
    if (selectedAnswerId) {
      const { data: answerOption, error: answerError } = await supabase
        .from('question_options')
        .select('id, question_id, is_correct')
        .eq('id', selectedAnswerId)
        .single()

      if (answerError || !answerOption) {
        console.error('[API] /api/quiz/attempts - Selected answer not found:', { selectedAnswerId, answerError })
        return NextResponse.json(
          { error: 'Selected answer not found' },
          { status: 400 }
        )
      }

      if (answerOption.question_id !== questionId) {
        console.error('[API] /api/quiz/attempts - Answer does not belong to question:', {
          selectedAnswerId,
          answerQuestionId: answerOption.question_id,
          expectedQuestionId: questionId
        })
        return NextResponse.json(
          { error: 'Answer does not belong to the specified question' },
          { status: 400 }
        )
      }
    }

    // Validate first answer if provided
    if (firstAnswerId) {
      const { data: firstAnswerOption, error: firstAnswerError } = await supabase
        .from('question_options')
        .select('id, question_id')
        .eq('id', firstAnswerId)
        .single()

      if (firstAnswerError || !firstAnswerOption) {
        console.error('[API] /api/quiz/attempts - First answer not found:', { firstAnswerId, firstAnswerError })
        return NextResponse.json(
          { error: 'First answer not found' },
          { status: 400 }
        )
      }

      if (firstAnswerOption.question_id !== questionId) {
        console.error('[API] /api/quiz/attempts - First answer does not belong to question:', {
          firstAnswerId,
          firstAnswerQuestionId: firstAnswerOption.question_id,
          expectedQuestionId: questionId
        })
        return NextResponse.json(
          { error: 'First answer does not belong to the specified question' },
          { status: 400 }
        )
      }
    }

    // Submit answer - triggers will handle correctness calculation and denormalized fields
    console.log('[API] /api/quiz/attempts - Submitting quiz attempt with database triggers enabled')

    const { data: attempt, error: insertError } = await supabase
      .from('quiz_attempts')
      .insert({
        quiz_session_id: sessionId,
        question_id: questionId,
        selected_answer_id: selectedAnswerId,
        first_answer_id: firstAnswerId,
        time_spent: timeSpent || 0
      })
      .select()
      .single()

    if (insertError) {
      console.error('[API] /api/quiz/attempts - Database insertion failed:', insertError)
      throw insertError
    }

    console.log('[API] /api/quiz/attempts - Answer submitted successfully:', {
      attemptId: attempt.id,
      isCorrect: attempt.is_correct,
      timeSpent: attempt.time_spent
    })

    return NextResponse.json({
      success: true,
      data: {
        attemptId: attempt.id,
        isCorrect: attempt.is_correct,
        timeSpent: attempt.time_spent
      }
    })

  } catch (error) {
    console.error('[API] /api/quiz/attempts - Error submitting quiz attempt:', error)

    if (error instanceof Error) {
      console.error('[API] /api/quiz/attempts - Error name:', error.name)
      console.error('[API] /api/quiz/attempts - Error message:', error.message)
      console.error('[API] /api/quiz/attempts - Error stack:', error.stack)

      // Log comprehensive context for debugging
      console.error('[API] /api/quiz/attempts - Request context:', {
        sessionId,
        questionId,
        selectedAnswerId,
        firstAnswerId,
        timeSpent,
        userId: user?.id,
        timestamp: new Date().toISOString()
      })

      // Enhanced error categorization
      const errorMessage = error.message.toLowerCase()

      if (errorMessage.includes('constraint') || errorMessage.includes('violates')) {
        console.error('[API] /api/quiz/attempts - Database constraint violation:', {
          type: 'constraint_violation',
          details: error.message
        })
        return NextResponse.json(
          { error: 'Data validation failed', details: 'Constraint violation' },
          { status: 400 }
        )
      }

      if (errorMessage.includes('foreign key') || errorMessage.includes('does not exist')) {
        console.error('[API] /api/quiz/attempts - Foreign key constraint violation:', {
          type: 'foreign_key_violation',
          details: error.message
        })
        return NextResponse.json(
          { error: 'Referenced data not found', details: 'Foreign key violation' },
          { status: 400 }
        )
      }

      if (errorMessage.includes('duplicate') || errorMessage.includes('unique')) {
        console.error('[API] /api/quiz/attempts - Duplicate key violation:', {
          type: 'duplicate_key_violation',
          details: error.message
        })
        return NextResponse.json(
          { error: 'Duplicate submission detected', details: 'Unique constraint violation' },
          { status: 409 }
        )
      }

      if (errorMessage.includes('trigger') || errorMessage.includes('function')) {
        console.error('[API] /api/quiz/attempts - Database trigger/function error:', {
          type: 'trigger_function_error',
          details: error.message
        })
        return NextResponse.json(
          { error: 'Database operation failed', details: 'Trigger/function error' },
          { status: 500 }
        )
      }

      // Generic database error
      console.error('[API] /api/quiz/attempts - Generic database error:', {
        type: 'database_error',
        details: error.message
      })

      return NextResponse.json(
        { error: 'Failed to submit answer', details: 'Database error' },
        { status: 500 }
      )
    }

    console.error('[API] /api/quiz/attempts - Unknown error type:', {
      type: typeof error,
      error: error,
      timestamp: new Date().toISOString()
    })

    return NextResponse.json(
      { error: 'Failed to submit answer', details: 'Unknown error' },
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
