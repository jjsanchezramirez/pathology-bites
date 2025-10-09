import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/shared/services/server'

// Create Supabase client with service role for admin operations
async function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createSupabaseClient(supabaseUrl, supabaseServiceKey)
}



export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: questionId } = await params
    const body = await request.json()
    const { changeSummary } = body

    // Simplified versioning - no need to specify update type
    // All updates are treated as minor version increments

    // Auth is now handled by middleware
    const userClient = await createClient()
    const { data: { user } } = await userClient.auth.getUser() // Still need user ID for changed_by

    // Use admin client for the actual operations
    const adminClient = await createAdminClient()

    // Check if question exists and is published (only published questions can be versioned)
    const { data: question, error: questionError } = await adminClient
      .from('questions')
      .select('id, status, version')
      .eq('id', questionId)
      .single()

    if (questionError || !question) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      )
    }

    if (question.status !== 'approved') {
      return NextResponse.json(
        { error: 'Only approved questions can be versioned' },
        { status: 400 }
      )
    }

    // Create version using simplified versioning function
    const { data: versionId, error: versionError } = await adminClient
      .rpc('create_question_version_simplified', {
        question_id_param: questionId,
        change_summary_param: changeSummary || 'Manual version creation',
        changed_by_param: user.id
      })

    if (versionError) {
      console.error('Error updating question version:', versionError)
      return NextResponse.json(
        { error: 'Failed to update question version' },
        { status: 500 }
      )
    }

    // Get updated question data
    const { data: updatedQuestion, error: fetchError } = await adminClient
      .from('questions')
      .select('id, version, updated_at')
      .eq('id', questionId)
      .single()

    if (fetchError) {
      console.error('Error fetching updated question:', fetchError)
      return NextResponse.json(
        { error: 'Question updated but failed to fetch updated data' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      versionId,
      question: updatedQuestion,
      message: `Question updated to version ${updatedQuestion.version}`
    })

  } catch (error) {
    console.error('Error in question versioning API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET endpoint to fetch version history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: questionId } = await params
    console.log('Version history API called for question:', questionId)

    // Auth is now handled by middleware
    const userClient = await createClient()

    // Use admin client to fetch version history
    const adminClient = await createAdminClient()

    const { data: versions, error: versionsError } = await adminClient
      .from('question_versions')
      .select(`
        id,
        version_major,
        version_minor,
        version_patch,
        version_string,
        update_type,
        change_summary,
        question_data,
        created_at,
        changed_by
      `)
      .eq('question_id', questionId)
      .order('version_major', { ascending: false })
      .order('version_minor', { ascending: false })
      .order('version_patch', { ascending: false })

    if (versionsError) {
      console.error('Error fetching version history:', versionsError)
      return NextResponse.json(
        { error: 'Failed to fetch version history' },
        { status: 500 }
      )
    }

    // Fetch user data for each version
    const versionsWithUsers = await Promise.all(
      (versions || []).map(async (version) => {
        const { data: user } = await adminClient
          .from('users')
          .select('first_name, last_name, email')
          .eq('id', version.changed_by)
          .single()

        return {
          ...version,
          changer: user || { first_name: 'Unknown', last_name: 'User', email: '' }
        }
      })
    )

    return NextResponse.json({
      success: true,
      versions: versionsWithUsers
    })

  } catch (error) {
    console.error('Error in version history API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
