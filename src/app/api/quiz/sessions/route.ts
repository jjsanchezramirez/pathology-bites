// src/app/api/quiz/sessions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { QuizCreationForm } from '@/features/quiz/types/quiz'
import { quizService } from '@/features/quiz/services/quiz-service'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    console.log('Auth check - user:', user?.id, 'error:', authError)

    if (authError || !user) {
      console.error('Authentication failed:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const formData: QuizCreationForm = await request.json()

    // Validate required fields
    if (!formData.title || !formData.mode || !formData.questionCount) {
      return NextResponse.json(
        { error: 'Missing required fields: title, mode, questionCount' },
        { status: 400 }
      )
    }

    // Validate question count
    if (formData.questionCount < 1 || formData.questionCount > 100) {
      return NextResponse.json(
        { error: 'Question count must be between 1 and 100' },
        { status: 400 }
      )
    }

    // Validate that at least one source is selected
    if (formData.categorySelection === 'custom' && formData.selectedCategories.length === 0) {
      return NextResponse.json(
        { error: 'Please select at least one category when using custom selection' },
        { status: 400 }
      )
    }

    // Create quiz session using the service with authenticated client
    const quizSession = await quizService.createQuizSession(user.id, formData, supabase)

    return NextResponse.json({
      success: true,
      data: {
        sessionId: quizSession.id,
        title: quizSession.title,
        questionCount: quizSession.totalQuestions,
        mode: quizSession.config.mode
      }
    })

  } catch (error) {
    console.error('Error creating quiz session:', error)
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create quiz session' },
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
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query
    let query = supabase
      .from('quiz_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Filter by status if provided
    if (status) {
      query = query.eq('status', status)
    }

    const { data: sessions, error } = await query

    if (error) {
      throw error
    }

    // Map database fields to expected format
    const mappedSessions = sessions?.map(session => ({
      id: session.id,
      title: session.title,
      status: session.status,
      mode: session.config?.mode || 'unknown',
      difficulty: session.config?.difficulty,
      totalQuestions: session.total_questions,
      score: session.score,
      correctAnswers: session.correct_answers,
      createdAt: session.created_at,
      completedAt: session.completed_at,
      totalTimeSpent: session.total_time_spent,
      currentQuestionIndex: session.current_question_index,
      timeLimit: session.total_time_limit,
      timeRemaining: session.time_remaining,
      isTimedMode: session.config?.timing === 'timed',
      config: session.config
    })) || []

    return NextResponse.json({
      success: true,
      data: mappedSessions,
      pagination: {
        limit,
        offset,
        total: sessions?.length || 0
      }
    })

  } catch (error) {
    console.error('Error fetching quiz sessions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch quiz sessions' },
      { status: 500 }
    )
  }
}
