// src/app/api/quiz/attempts/batch/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'

interface BatchAnswerSubmission {
  questionId: string
  selectedAnswerId: string
  timeSpent: number
  timestamp: number
}

interface BatchSubmissionRequest {
  sessionId: string
  answers: BatchAnswerSubmission[]
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const { sessionId, answers }: BatchSubmissionRequest = await request.json()

    // Validate required fields
    if (!sessionId || !Array.isArray(answers) || answers.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId and answers array' },
        { status: 400 }
      )
    }

    // Verify user owns the quiz session
    const { data: session, error: sessionError } = await supabase
      .from('quiz_sessions')
      .select('user_id, status')
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

    // Check if quiz is already completed
    if (session.status === 'completed') {
      return NextResponse.json(
        { error: 'Quiz session is already completed' },
        { status: 400 }
      )
    }

    // Prepare batch insert data
    const attemptData = answers.map(answer => ({
      quiz_session_id: sessionId,
      question_id: answer.questionId,
      selected_answer_id: answer.selectedAnswerId,
      time_spent: answer.timeSpent || 0,
      attempted_at: new Date(answer.timestamp).toISOString()
    }))

    // Check for existing attempts to prevent duplicates
    const questionIds = answers.map(a => a.questionId)
    const { data: existingAttempts, error: existingError } = await supabase
      .from('quiz_attempts')
      .select('question_id')
      .eq('quiz_session_id', sessionId)
      .in('question_id', questionIds)

    if (existingError) {
      console.error('Error checking for existing attempts:', existingError)
    }

    // Filter out questions that already have attempts
    const existingQuestionIds = new Set(existingAttempts?.map(a => a.question_id) || [])
    const newAttemptData = attemptData.filter(attempt => 
      !existingQuestionIds.has(attempt.question_id)
    )

    if (newAttemptData.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All answers already submitted',
        data: {
          submitted: 0,
          skipped: answers.length,
          total: answers.length
        }
      })
    }

    // Batch insert all new attempts
    const { data: insertedAttempts, error: insertError } = await supabase
      .from('quiz_attempts')
      .insert(newAttemptData)
      .select()

    if (insertError) {
      console.error('Batch insert error:', insertError)
      throw insertError
    }

    console.log(`[Batch Answers] Successfully submitted ${newAttemptData.length} answers for session ${sessionId}`)

    return NextResponse.json({
      success: true,
      message: 'Answers submitted successfully',
      data: {
        submitted: newAttemptData.length,
        skipped: answers.length - newAttemptData.length,
        total: answers.length,
        attempts: insertedAttempts?.map(attempt => ({
          id: attempt.id,
          questionId: attempt.question_id,
          selectedAnswerId: attempt.selected_answer_id,
          isCorrect: attempt.is_correct,
          timeSpent: attempt.time_spent
        })) || []
      }
    })

  } catch (error) {
    console.error('Error in batch answer submission:', error)
    
    if (error instanceof Error) {
      return NextResponse.json({
        error: error.message,
        success: false
      }, { status: 400 })
    }

    return NextResponse.json({
      error: 'Failed to submit batch answers',
      success: false
    }, { status: 500 })
  }
}
