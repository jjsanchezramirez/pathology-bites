// src/app/api/quiz/sessions/[id]/complete/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { quizService } from '@/features/quiz/services/quiz-service'

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
