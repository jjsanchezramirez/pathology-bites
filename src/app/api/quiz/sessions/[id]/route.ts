// src/app/api/quiz/sessions/[id]/route.ts
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

    // Get quiz session using authenticated client
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
        { error: 'Forbidden - You can only access your own quiz sessions' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      data: quizSession
    })

  } catch (error) {
    console.error('Error fetching quiz session:', error)
    return NextResponse.json(
      { error: 'Failed to fetch quiz session' },
      { status: 500 }
    )
  }
}

export async function PATCH(
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

    // Parse request body
    const updates = await request.json()

    // Get existing quiz session to verify ownership
    const existingSession = await quizService.getQuizSession(id, supabase)
    if (!existingSession) {
      return NextResponse.json(
        { error: 'Quiz session not found' },
        { status: 404 }
      )
    }

    if (existingSession.userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden - You can only update your own quiz sessions' },
        { status: 403 }
      )
    }

    // Handle special actions
    if (updates.action === 'start') {
      await quizService.startQuizSession(id, supabase)
    } else if (updates.action === 'pause') {
      await quizService.pauseQuizSession(id, updates.timeRemaining || 0, supabase)
    } else if (updates.action === 'resume') {
      await quizService.resumeQuizSession(id, supabase)
    } else {
      // Regular update
      await quizService.updateQuizSession(id, updates, supabase)
    }

    return NextResponse.json({
      success: true,
      message: 'Quiz session updated successfully'
    })

  } catch (error) {
    console.error('Error updating quiz session:', error)
    return NextResponse.json(
      { error: 'Failed to update quiz session' },
      { status: 500 }
    )
  }
}

export async function DELETE(
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

    // Check if user owns this quiz session
    const { data: session, error: sessionError } = await supabase
      .from('quiz_sessions')
      .select('user_id')
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
        { error: 'Forbidden - You can only delete your own quiz sessions' },
        { status: 403 }
      )
    }

    // Delete quiz attempts first (cascade)
    await supabase
      .from('quiz_attempts')
      .delete()
      .eq('quiz_session_id', id)

    // Delete quiz session
    const { error: deleteError } = await supabase
      .from('quiz_sessions')
      .delete()
      .eq('id', id)

    if (deleteError) {
      throw deleteError
    }

    return NextResponse.json({
      success: true,
      message: 'Quiz session deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting quiz session:', error)
    return NextResponse.json(
      { error: 'Failed to delete quiz session' },
      { status: 500 }
    )
  }
}
