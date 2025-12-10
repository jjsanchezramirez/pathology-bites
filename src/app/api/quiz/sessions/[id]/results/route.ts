// src/app/api/quiz/sessions/[id]/results/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { quizService } from '@/features/quiz/services/quiz-service'

export async function GET(
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

    // Get quiz session to verify ownership
    const quizSession = await quizService.getQuizSession(id, supabase)

    if (!quizSession) {
      return NextResponse.json(
        { error: 'Quiz session not found' },
        { status: 404 }
      )
    }

    // Check if user owns this quiz session
    if (quizSession.userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden - You can only access your own quiz results' },
        { status: 403 }
      )
    }

    // Get quiz results
    const results = await quizService.getQuizResults(id, supabase)

    if (!results) {
      return NextResponse.json(
        { error: 'Quiz results not available' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: results
    })

  } catch (error) {
    console.error('Error fetching quiz results:', error)
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to fetch quiz results' },
      { status: 500 }
    )
  }
}
