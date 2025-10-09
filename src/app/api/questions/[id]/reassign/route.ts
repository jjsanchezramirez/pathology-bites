import { createClient } from '@/shared/services/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/questions/:id/reassign
 * 
 * Reassign a question to a different reviewer (admin or creator action)
 * - Can reassign questions in pending_review state
 * - Requires new reviewer_id in request body
 * - Only admin or creator can reassign
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id: questionId } = await params

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { reviewer_id } = body

    // Validate reviewer_id is provided
    if (!reviewer_id || typeof reviewer_id !== 'string') {
      return NextResponse.json(
        { error: 'reviewer_id is required' },
        { status: 400 }
      )
    }

    // Verify new reviewer exists and has appropriate role
    const { data: reviewer, error: reviewerError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', reviewer_id)
      .single()

    if (reviewerError || !reviewer) {
      return NextResponse.json(
        { error: 'Invalid reviewer_id: reviewer not found' },
        { status: 400 }
      )
    }

    // Verify reviewer is admin or has reviewer role
    if (reviewer.role !== 'admin' && reviewer.role !== 'reviewer') {
      return NextResponse.json(
        { error: 'Selected user is not a reviewer or admin' },
        { status: 400 }
      )
    }

    // Get the question to verify status and ownership
    const { data: question, error: fetchError } = await supabase
      .from('questions')
      .select('id, status, created_by, reviewer_id')
      .eq('id', questionId)
      .single()

    if (fetchError || !question) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      )
    }

    // Verify question is in pending_review state
    if (question.status !== 'pending_review') {
      return NextResponse.json(
        { error: `Cannot reassign question with status: ${question.status}` },
        { status: 400 }
      )
    }

    // Check if user is admin or creator
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = userProfile?.role === 'admin'
    const isCreator = question.created_by === user.id

    if (!isAdmin && !isCreator) {
      return NextResponse.json(
        { error: 'Only admin or creator can reassign this question' },
        { status: 403 }
      )
    }

    // Update reviewer assignment
    const { data: updatedQuestion, error: updateError } = await supabase
      .from('questions')
      .update({
        reviewer_id: reviewer_id,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', questionId)
      .select()
      .single()

    if (updateError) {
      console.error('Error reassigning question:', updateError)
      return NextResponse.json(
        { error: `Failed to reassign question: ${updateError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      question: updatedQuestion,
      message: `Question reassigned to new reviewer`,
    })

  } catch (error) {
    console.error('Unexpected error reassigning question:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

