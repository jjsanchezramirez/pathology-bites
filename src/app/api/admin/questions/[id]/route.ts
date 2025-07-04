import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Create Supabase client with service role for admin operations
async function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseUrl, supabaseServiceKey)
}

// Create regular client for user authentication
async function createUserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  return createClient(supabaseUrl, supabaseAnonKey)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: questionId } = await params
    const body = await request.json()
    const { 
      questionData, 
      updateType, 
      changeSummary,
      answerOptions,
      questionImages,
      tagIds,
      categoryId
    } = body

    // Check user authentication
    const userClient = await createUserClient()
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin for published questions
    const { data: profile, error: profileError } = await userClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError) {
      return NextResponse.json(
        { error: 'Failed to verify user permissions' },
        { status: 500 }
      )
    }

    // Use admin client for the actual operations
    const adminClient = await createAdminClient()

    // Get current question to check status and permissions
    const { data: currentQuestion, error: questionError } = await adminClient
      .from('questions')
      .select('id, status, created_by, version_major, version_minor, version_patch')
      .eq('id', questionId)
      .single()

    if (questionError || !currentQuestion) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      )
    }

    // Check permissions based on question status
    if (currentQuestion.status === 'published') {
      // Only admins can edit published questions
      if (profile?.role !== 'admin') {
        return NextResponse.json(
          { error: 'Only admins can edit published questions' },
          { status: 403 }
        )
      }

      // For published questions, updateType is required
      if (!updateType || !['patch', 'minor', 'major'].includes(updateType)) {
        return NextResponse.json(
          { error: 'Update type (patch, minor, major) is required for published questions' },
          { status: 400 }
        )
      }
    } else {
      // For non-published questions, check if user is creator or admin
      if (currentQuestion.created_by !== user.id && profile?.role !== 'admin') {
        return NextResponse.json(
          { error: 'You can only edit your own questions or be an admin' },
          { status: 403 }
        )
      }
    }

    // Start transaction-like operations
    try {
      // Update the main question data
      const { error: updateError } = await adminClient
        .from('questions')
        .update({
          ...questionData,
          current_editor_id: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', questionId)

      if (updateError) {
        throw new Error(`Failed to update question: ${updateError.message}`)
      }

      // Update answer options if provided
      if (answerOptions) {
        // Delete existing options
        await adminClient
          .from('question_options')
          .delete()
          .eq('question_id', questionId)

        // Insert new options
        if (answerOptions.length > 0) {
          const { error: optionsError } = await adminClient
            .from('question_options')
            .insert(
              answerOptions.map((option: any, index: number) => ({
                question_id: questionId,
                text: option.text,
                is_correct: option.is_correct,
                explanation: option.explanation || null,
                order_index: index
              }))
            )

          if (optionsError) {
            throw new Error(`Failed to update answer options: ${optionsError.message}`)
          }
        }
      }

      // Update question images if provided
      if (questionImages) {
        // Delete existing question images
        await adminClient
          .from('question_images')
          .delete()
          .eq('question_id', questionId)

        // Insert new question images
        if (questionImages.length > 0) {
          const { error: imagesError } = await adminClient
            .from('question_images')
            .insert(
              questionImages.map((img: any, index: number) => ({
                question_id: questionId,
                image_id: img.image_id,
                question_section: img.question_section,
                order_index: index
              }))
            )

          if (imagesError) {
            throw new Error(`Failed to update question images: ${imagesError.message}`)
          }
        }
      }

      // Update question tags if provided
      if (tagIds !== undefined) {
        // Delete existing tags
        await adminClient
          .from('questions_tags')
          .delete()
          .eq('question_id', questionId)

        // Insert new tags
        if (tagIds.length > 0) {
          const { error: tagsError } = await adminClient
            .from('questions_tags')
            .insert(
              tagIds.map((tagId: string) => ({
                question_id: questionId,
                tag_id: tagId
              }))
            )

          if (tagsError) {
            throw new Error(`Failed to update question tags: ${tagsError.message}`)
          }
        }
      }

      // Update category if provided
      if (categoryId !== undefined) {
        const { error: categoryError } = await adminClient
          .from('questions')
          .update({ category_id: categoryId || null })
          .eq('id', questionId)

        if (categoryError) {
          throw new Error(`Failed to update question category: ${categoryError.message}`)
        }
      }

      // Handle versioning for published questions
      let versionId = null
      if (currentQuestion.status === 'published' && updateType) {
        // Get complete question data for snapshot
        const { data: snapshotData, error: snapshotError } = await adminClient
          .rpc('get_question_snapshot_data', { question_id_param: questionId })

        if (snapshotError) {
          console.error('Error getting question snapshot:', snapshotError)
          // Continue without versioning rather than failing the entire update
        } else {
          // Update version using atomic function
          const { data: newVersionId, error: versionError } = await adminClient
            .rpc('update_question_version', {
              question_id_param: questionId,
              update_type_param: updateType,
              change_summary_param: changeSummary || null,
              question_data_param: snapshotData
            })

          if (versionError) {
            console.error('Error updating question version:', versionError)
            // Continue without versioning rather than failing the entire update
          } else {
            versionId = newVersionId
          }
        }
      }

      // Get updated question data
      const { data: updatedQuestion, error: fetchError } = await adminClient
        .from('questions')
        .select('id, version_string, version_major, version_minor, version_patch, updated_at, status')
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
        question: updatedQuestion,
        versionId,
        message: versionId 
          ? `Question updated to version ${updatedQuestion.version_string}`
          : 'Question updated successfully'
      })

    } catch (error) {
      console.error('Error during question update:', error)
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to update question' },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Error in question update API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
