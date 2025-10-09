import { createClient } from '@/shared/services/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/questions/:id/reject
 * 
 * Reject a question with feedback (reviewer action)
 * - Changes status from pending_review → rejected
 * - Requires feedback in request body
 * - Sets rejected_at, rejected_by, reviewer_feedback
 * - Only assigned reviewer or admin can reject
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
    const { feedback } = body

    // Validate feedback is provided
    if (!feedback || typeof feedback !== 'string' || feedback.trim() === '') {
      return NextResponse.json(
        { error: 'Feedback is required when rejecting a question' },
        { status: 400 }
      )
    }

    // Get the question to verify reviewer assignment
    const { data: question, error: fetchError } = await supabase
      .from('questions')
      .select('id, status, reviewer_id, created_by')
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
        { error: `Cannot reject question with status: ${question.status}` },
        { status: 400 }
      )
    }

    // Check if user is the assigned reviewer or admin
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = userProfile?.role === 'admin'
    const isAssignedReviewer = question.reviewer_id === user.id

    if (!isAdmin && !isAssignedReviewer) {
      return NextResponse.json(
        { error: 'Only the assigned reviewer or admin can reject this question' },
        { status: 403 }
      )
    }

    // Update question to rejected with feedback
    const { data: updatedQuestion, error: updateError } = await supabase
      .from('questions')
      .update({
        status: 'rejected',
        reviewer_feedback: feedback.trim(),
        rejected_at: new Date().toISOString(),
        rejected_by: user.id,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', questionId)
      .select()
      .single()

    if (updateError) {
      console.error('Error rejecting question:', updateError)
      return NextResponse.json(
        { error: `Failed to reject question: ${updateError.message}` },
        { status: 500 }
      )
    }

    // Record the review action
    const { error: reviewError } = await supabase
      .from('question_reviews')
      .insert({
        question_id: questionId,
        reviewer_id: user.id,
        action: 'rejected',
        feedback: feedback.trim(),
      })

    if (reviewError) {
      console.error('Error recording review:', reviewError)
      // Don't fail the request if review recording fails
    }

    return NextResponse.json({
      success: true,
      question: updatedQuestion,
    })

  } catch (error) {
    console.error('Unexpected error rejecting question:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

