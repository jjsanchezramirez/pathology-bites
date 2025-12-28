import { getUserIdFromHeaders } from '@/shared/utils/auth-helpers'
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
    const userId = getUserIdFromHeaders(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get quiz session to verify ownership
    const quizSession = await quizService.getQuizSession(id, supabase)

    if (!quizSession) {
      console.error(`[Quiz Results] Session not found: ${id}`)
      return NextResponse.json(
        { error: 'Quiz session not found' },
        { status: 404 }
      )
    }

    console.log(`[Quiz Results] Session found: ${id}, status: ${quizSession.status}, userId: ${quizSession.userId}`)

    // Check if user owns this quiz session
    if (quizSession.userId !== userId) {
      console.error(`[Quiz Results] Unauthorized access attempt - session user: ${quizSession.userId}, requesting user: ${userId}`)
      return NextResponse.json(
        { error: 'Forbidden - You can only access your own quiz results' },
        { status: 403 }
      )
    }

    // Get quiz results
    console.log(`[Quiz Results] Fetching results for session: ${id}`)
    const results = await quizService.getQuizResults(id, supabase)

    if (!results) {
      console.error(`[Quiz Results] Results not available for session: ${id}`)
      return NextResponse.json(
        { error: 'Quiz results not available - quiz may not be completed' },
        { status: 404 }
      )
    }

    console.log(`[Quiz Results] Results fetched successfully for session: ${id}`)

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
