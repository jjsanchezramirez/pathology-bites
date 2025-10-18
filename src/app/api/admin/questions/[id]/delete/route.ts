import { createClient } from '@/shared/services/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * DELETE /api/admin/questions/:id/delete
 * 
 * Delete a question with proper constraints
 * - Only draft questions can be deleted
 * - Admins can delete any draft question
 * - Creators can only delete their own draft questions
 * - Reviewers cannot delete questions
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('DELETE route called');
    const supabase = await createClient()
    const { id: questionId } = await params
    console.log(`Question ID to delete: ${questionId}`);

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user profile to check role
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !userProfile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    // Check if user has permission to delete questions
    if (!['admin', 'creator'].includes(userProfile.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions. Only admins and creators can delete questions.' },
        { status: 403 }
      )
    }

    // Get the question to check status and ownership
    const { data: question, error: fetchError } = await supabase
      .from('questions')
      .select('id, status, created_by, title')
      .eq('id', questionId)
      .single()

    if (fetchError || !question) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      )
    }

    // Check if question is in draft status (only draft questions can be deleted)
    if (question.status !== 'draft') {
      return NextResponse.json(
        { 
          error: `Cannot delete question with status '${question.status}'. Only draft questions can be deleted.`,
          details: {
            currentStatus: question.status,
            allowedStatus: 'draft'
          }
        },
        { status: 400 }
      )
    }

    // Check ownership permissions
    const isAdmin = userProfile.role === 'admin'
    const isOwner = question.created_by === user.id

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: 'You can only delete your own questions' },
        { status: 403 }
      )
    }

    // Delete the question (cascade will handle related records)
    console.log(`Attempting to delete question: ${questionId}`);
    const { error: deleteError, data: deleteData } = await supabase
      .from('questions')
      .delete()
      .eq('id', questionId)

    console.log('Delete result:', { deleteError, deleteData });

    if (deleteError) {
      console.error('Error deleting question:', deleteError)
      return NextResponse.json(
        { error: `Failed to delete question: ${deleteError.message}`, details: deleteError },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Question "${question.title}" deleted successfully`,
      questionId: questionId
    })

  } catch (error) {
    console.error('Unexpected error deleting question:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
