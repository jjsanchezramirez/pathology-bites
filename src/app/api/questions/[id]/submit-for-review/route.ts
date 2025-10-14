import { createClient } from '@/shared/services/server'
import { NextRequest, NextResponse } from 'next/server'
import { NotificationTriggers } from '@/shared/services/notification-triggers'

/**
 * POST /api/questions/:id/submit-for-review
 * 
 * Submit a question for review (creator action)
 * - Changes status from draft → pending_review OR rejected → pending_review
 * - Requires reviewer_id in request body
 * - Clears reviewer_feedback when resubmitting rejected question
 * - Only creator or admin can submit
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
    const { reviewer_id, resubmission_notes } = body

    // Validate reviewer_id is provided
    if (!reviewer_id || typeof reviewer_id !== 'string') {
      return NextResponse.json(
        { error: 'reviewer_id is required' },
        { status: 400 }
      )
    }

    // Verify reviewer exists and has appropriate role
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

    // Get the question to verify ownership and status
    const { data: question, error: fetchError } = await supabase
      .from('questions')
      .select('id, status, created_by')
      .eq('id', questionId)
      .single()

    if (fetchError || !question) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      )
    }

    // Verify question is in draft or rejected state
    if (question.status !== 'draft' && question.status !== 'rejected') {
      return NextResponse.json(
        { error: `Cannot submit question with status: ${question.status}` },
        { status: 400 }
      )
    }

    // Check if user is the creator or admin
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = userProfile?.role === 'admin'
    const isCreator = question.created_by === user.id

    if (!isAdmin && !isCreator) {
      return NextResponse.json(
        { error: 'Only the creator or admin can submit this question for review' },
        { status: 403 }
      )
    }

    // Update question to pending_review
    // Clear reviewer_feedback when resubmitting (feedback has been addressed)
    // Store resubmission_notes if provided (for rejected → pending_review transitions)
    const { data: updatedQuestion, error: updateError } = await supabase
      .from('questions')
      .update({
        status: 'pending_review',
        reviewer_id: reviewer_id,
        reviewer_feedback: null, // Clear old feedback
        rejected_at: null,
        rejected_by: null,
        resubmission_notes: resubmission_notes || null, // Store creator's change notes
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', questionId)
      .select()
      .single()

    if (updateError) {
      console.error('Error submitting question for review:', updateError)
      return NextResponse.json(
        { error: `Failed to submit question: ${updateError.message}` },
        { status: 500 }
      )
    }

    // Send notification to reviewer
    try {
      const notificationTriggers = new NotificationTriggers()
      await notificationTriggers.onQuestionSubmittedForReview(
        reviewer_id,
        questionId,
        updatedQuestion.title,
        user.id
      )
    } catch (error) {
      console.error('Error sending submission notification:', error)
      // Don't fail the request if notification fails
    }

    return NextResponse.json({
      success: true,
      question: updatedQuestion,
    })

  } catch (error) {
    console.error('Unexpected error submitting question for review:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

