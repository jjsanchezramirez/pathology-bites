import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Create Supabase client with service role for admin operations
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createSupabaseClient(supabaseUrl, supabaseServiceKey)
}

/**
 * POST /api/admin/questions/bulk
 * 
 * Perform bulk operations on questions
 * Supported actions:
 * - submit_for_review: Change status from draft to pending_review
 * - approve: Change status to approved (admin only)
 * - reject: Change status to rejected (admin only)
 * - delete: Delete draft questions (with proper permissions)
 * - export: Export multiple questions as JSON
 */
export async function POST(request: NextRequest) {
  try {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { action, questionIds } = await request.json()

    if (!action || !Array.isArray(questionIds) || questionIds.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request. Requires action and questionIds array.' },
        { status: 400 }
      )
    }

    // Limit bulk operations to prevent excessive resource usage
    if (questionIds.length > 100) {
      return NextResponse.json(
        { error: 'Bulk operations limited to 100 questions at a time' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Get user role for permission checks
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const userRole = userProfile?.role || 'user'

    // Fetch questions to validate permissions
    const { data: questions, error: fetchError } = await supabase
      .from('questions')
      .select('id, status, created_by')
      .in('id', questionIds)

    if (fetchError) {
      return NextResponse.json(
        { error: 'Failed to fetch questions' },
        { status: 500 }
      )
    }

    const foundQuestionIds = questions?.map(q => q.id) || []
    const notFoundIds = questionIds.filter(id => !foundQuestionIds.includes(id))

    if (notFoundIds.length > 0) {
      return NextResponse.json(
        { 
          error: 'Some questions not found',
          notFoundIds,
          foundCount: foundQuestionIds.length
        },
        { status: 404 }
      )
    }

    let result
    let affectedCount = 0

    switch (action) {
      case 'submit_for_review':
        // Only allow submitting own draft questions or admin can submit any draft
        const draftQuestions = questions?.filter(q => 
          q.status === 'draft' && (q.created_by === user.id || userRole === 'admin')
        ) || []

        if (draftQuestions.length === 0) {
          return NextResponse.json(
            { error: 'No eligible draft questions found for submission' },
            { status: 400 }
          )
        }

        result = await supabase
          .from('questions')
          .update({ 
            status: 'pending_review',
            submitted_for_review_at: new Date().toISOString()
          })
          .in('id', draftQuestions.map(q => q.id))

        affectedCount = draftQuestions.length
        break

      case 'approve':
        // Only admins can approve questions
        if (userRole !== 'admin') {
          return NextResponse.json(
            { error: 'Only admins can approve questions' },
            { status: 403 }
          )
        }

        const pendingQuestions = questions?.filter(q => 
          q.status === 'pending_review'
        ) || []

        if (pendingQuestions.length === 0) {
          return NextResponse.json(
            { error: 'No pending questions found for approval' },
            { status: 400 }
          )
        }

        result = await supabase
          .from('questions')
          .update({ 
            status: 'approved',
            approved_at: new Date().toISOString(),
            approved_by: user.id
          })
          .in('id', pendingQuestions.map(q => q.id))

        affectedCount = pendingQuestions.length
        break

      case 'reject':
        // Only admins can reject questions
        if (userRole !== 'admin') {
          return NextResponse.json(
            { error: 'Only admins can reject questions' },
            { status: 403 }
          )
        }

        const rejectableQuestions = questions?.filter(q => 
          ['pending_review', 'approved'].includes(q.status)
        ) || []

        if (rejectableQuestions.length === 0) {
          return NextResponse.json(
            { error: 'No questions found that can be rejected' },
            { status: 400 }
          )
        }

        result = await supabase
          .from('questions')
          .update({ 
            status: 'rejected',
            rejected_at: new Date().toISOString(),
            rejected_by: user.id
          })
          .in('id', rejectableQuestions.map(q => q.id))

        affectedCount = rejectableQuestions.length
        break

      case 'delete':
        // Only allow deleting own draft questions or admin can delete any draft
        const deletableQuestions = questions?.filter(q => 
          q.status === 'draft' && (q.created_by === user.id || userRole === 'admin')
        ) || []

        if (deletableQuestions.length === 0) {
          return NextResponse.json(
            { error: 'No eligible draft questions found for deletion' },
            { status: 400 }
          )
        }

        // Delete related data first (due to foreign key constraints)
        await supabase.from('question_options').delete().in('question_id', deletableQuestions.map(q => q.id))
        await supabase.from('question_images').delete().in('question_id', deletableQuestions.map(q => q.id))
        await supabase.from('question_tags').delete().in('question_id', deletableQuestions.map(q => q.id))
        await supabase.from('question_categories').delete().in('question_id', deletableQuestions.map(q => q.id))

        result = await supabase
          .from('questions')
          .delete()
          .in('id', deletableQuestions.map(q => q.id))

        affectedCount = deletableQuestions.length
        break

      case 'export':
        // Fetch full question data for export
        const { data: exportData, error: exportError } = await supabase
          .from('questions')
          .select(`
            *,
            question_options(*),
            question_images(*),
            question_tags(tag_id),
            question_categories(category_id)
          `)
          .in('id', questionIds)

        if (exportError) {
          return NextResponse.json(
            { error: 'Failed to export questions' },
            { status: 500 }
          )
        }

        return NextResponse.json({
          success: true,
          action: 'export',
          data: exportData,
          count: exportData?.length || 0
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported: submit_for_review, approve, reject, delete, export' },
          { status: 400 }
        )
    }

    if (result?.error) {
      console.error(`Bulk ${action} error:`, result.error)
      return NextResponse.json(
        { error: `Failed to ${action} questions` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      action,
      affectedCount,
      message: `Successfully ${action.replace('_', ' ')}ed ${affectedCount} question(s)`
    })

  } catch (error) {
    console.error('Bulk questions operation error:', error)
    return NextResponse.json(
      { 
        error: 'Bulk operation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
