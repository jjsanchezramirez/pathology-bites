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

    // Verify session exists and belongs to user
    const { data: session, error: sessionError } = await supabase
      .from('quiz_sessions')
      .select('id, total_questions, correct_answers, score')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single()

    if (sessionError || !session) {
      if (sessionError?.code === 'PGRST116') {
        return NextResponse.json({ error: 'Quiz session not found' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Session does not belong to user' }, { status: 403 })
    }

    // Check if question already answered
    const { data: existingAttempt } = await supabase
      .from('quiz_attempts')
      .select('id')
      .eq('quiz_session_id', sessionId)
      .eq('question_id', questionId)
      .single()

    if (existingAttempt) {
      return NextResponse.json({ error: 'Question already answered' }, { status: 409 })
    }

    // Get question and answer details
    const { data: question, error: questionError } = await supabase
      .from('questions')
      .select('id, explanation, answer_options')
      .eq('id', questionId)
      .single()

    if (questionError || !question) {
      throw new Error('Question not found')
    }

    // Find correct answer
    const correctAnswer = question.answer_options?.find((opt: any) => opt.is_correct)
    const isCorrect = selectedAnswerId === correctAnswer?.id

    // Create the attempt record
    const { data: attempt, error: attemptError } = await supabase
      .from('quiz_attempts')
      .insert({
        quiz_session_id: sessionId,
        question_id: questionId,
        selected_answer_id: selectedAnswerId,
        is_correct: isCorrect,
        time_spent: timeSpent || 0
      })
      .select('id')
      .single()

    if (attemptError) {
      throw attemptError
    }

    // Update session stats
    const newCorrectAnswers = isCorrect ? (session.correct_answers || 0) + 1 : (session.correct_answers || 0)
    const newScore = Math.round((newCorrectAnswers / session.total_questions) * 100)

    await supabase
      .from('quiz_sessions')
      .update({
        correct_answers: newCorrectAnswers,
        score: newScore
      })
      .eq('id', sessionId)

    // Get next question
    const { data: nextQuestion } = await supabase
      .from('questions')
      .select('id')
      .eq('question_set_id', (await supabase.from('quiz_sessions').select('question_set_id').eq('id', sessionId).single()).data?.question_set_id)
      .not('id', 'in', `(${(await supabase.from('quiz_attempts').select('question_id').eq('quiz_session_id', sessionId)).data?.map((a: any) => a.question_id).join(',')})`)
      .limit(1)
      .single()

    const isSessionComplete = (newCorrectAnswers + 1) >= session.total_questions

    return NextResponse.json({
      success: true,
      data: {
        id: attempt.id,
        isCorrect,
        correctAnswerId: correctAnswer?.id,
        explanation: question.explanation,
        nextQuestionId: nextQuestion?.id || null,
        isSessionComplete,
        sessionScore: newScore,
        questionNumber: (newCorrectAnswers + 1),
        totalQuestions: session.total_questions
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