import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/shared/services/server'

// Create Supabase client with service role for admin operations
async function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createSupabaseClient(supabaseUrl, supabaseServiceKey)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: questionId } = await params

    // Auth is now handled by middleware
    const userClient = await createClient()
    const { data: { user } } = await userClient.auth.getUser() // Still need user ID for permission checks

    // Still need to get user profile for business logic permission checks  
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

    // First, try a simple query to see if the question exists
    const { data: simpleQuestion, error: simpleError } = await adminClient
      .from('questions')
      .select('*')
      .eq('id', questionId)
      .single()

    if (simpleError || !simpleQuestion) {
      console.error('Simple question fetch error:', simpleError)
      console.error('Question ID:', questionId)
      return NextResponse.json(
        { error: 'Question not found in simple query', details: simpleError?.message },
        { status: 404 }
      )
    }

    // Now try the complex query
    const { data: question, error: questionError } = await adminClient
      .from('questions')
      .select(`
        *,
        question_set:question_sets(
          id,
          name,
          source_type,
          short_form
        ),
        created_by_user:users!questions_created_by_fkey(
          first_name,
          last_name
        ),
        updated_by_user:users!questions_updated_by_fkey(
          first_name,
          last_name
        ),
        question_images(
          image_id,
          question_section,
          order_index,
          image:images(
            id,
            url,
            alt_text,
            description,
            category
          )
        ),
        question_options(
          id,
          text,
          is_correct,
          explanation,
          order_index
        ),
        question_tags(
          tag:tags(
            id,
            name
          )
        )
      `)
      .eq('id', questionId)
      .single()

    if (questionError || !question) {
      console.error('Question fetch error:', questionError)
      console.error('Question ID:', questionId)
      console.error('Question data:', question)
      return NextResponse.json(
        { error: 'Question not found', details: questionError?.message },
        { status: 404 }
      )
    }

    // Check permissions based on question status and user role
    const canAccess =
      profile?.role === 'admin' ||
      (question.created_by === user.id && ['admin', 'creator'].includes(profile?.role)) ||
      (['reviewer', 'admin'].includes(profile?.role) && question.status === 'pending')

    if (!canAccess) {
      return NextResponse.json(
        { error: 'Insufficient permissions to access this question' },
        { status: 403 }
      )
    }

    // Flatten the tags structure and add user names for easier consumption
    const questionWithFlattenedTags = {
      ...question,
      tags: question.question_tags?.map((qt: { tag: any }) => qt.tag).filter(Boolean) || [],
      created_by_name: question.created_by_user
        ? `${question.created_by_user.first_name || ''} ${question.created_by_user.last_name || ''}`.trim() || 'Unknown'
        : 'Unknown',
      updated_by_name: question.updated_by_user
        ? `${question.updated_by_user.first_name || ''} ${question.updated_by_user.last_name || ''}`.trim() || 'Unknown'
        : 'Unknown'
    }

    return NextResponse.json({
      success: true,
      question: questionWithFlattenedTags
    })

  } catch (error) {
    console.error('Error fetching question:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: questionId } = await params
    console.log('PATCH /api/admin/questions/[id] - Question ID:', questionId)
    console.log('PATCH /api/admin/questions/[id] - Params type:', typeof params)
    console.log('PATCH /api/admin/questions/[id] - Params:', params)

    const body = await request.json()
    const {
      questionData,
      changeSummary,
      answerOptions,
      questionImages,
      tagIds,
      categoryId
    } = body

    console.log('PATCH /api/admin/questions/[id] - Body received:', {
      hasQuestionData: !!questionData,
      hasAnswerOptions: !!answerOptions,
      hasQuestionImages: !!questionImages,
      hasTagIds: !!tagIds,
      hasCategoryId: !!categoryId
    })



    // Auth is now handled by middleware
    const userClient = await createClient()
    const { data: { user }, error: authError } = await userClient.auth.getUser() // Still need user ID for permission checks

    if (authError || !user) {
      console.error('PATCH - Auth error:', authError)
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('PATCH - User authenticated:', user.id)

    // Still need to get user profile for business logic permission checks
    const { data: profile, error: profileError } = await userClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('PATCH - Profile error:', profileError)
      return NextResponse.json(
        { error: 'Failed to verify user permissions' },
        { status: 500 }
      )
    }

    console.log('PATCH - User role:', profile.role)

    // Use admin client for the actual operations
    const adminClient = await createAdminClient()
    console.log('PATCH - Admin client created')

    // Get current question to check status and permissions
    console.log('PATCH - Fetching question with ID:', questionId)
    const { data: currentQuestion, error: questionError } = await adminClient
      .from('questions')
      .select('id, status, created_by, version')
      .eq('id', questionId)
      .single()

    console.log('PATCH - Question fetch result:', {
      found: !!currentQuestion,
      error: questionError?.message,
      status: currentQuestion?.status
    })

    if (questionError || !currentQuestion) {
      console.error('PATCH - Question fetch error:', {
        questionId,
        error: questionError,
        message: questionError?.message,
        details: questionError?.details,
        hint: questionError?.hint,
        code: questionError?.code
      })
      return NextResponse.json(
        {
          error: 'Question not found',
          details: questionError?.message,
          questionId
        },
        { status: 404 }
      )
    }

    // Check permissions based on question status
    // Support both 'approved' and 'published' for backwards compatibility
    if (currentQuestion.status === 'published' || currentQuestion.status === 'approved') {
      // Only admins can edit published/approved questions
      if (profile?.role !== 'admin') {
        return NextResponse.json(
          { error: 'Only admins can edit published questions' },
          { status: 403 }
        )
      }

      // For published/approved questions, we'll automatically create a version
      // No need to require updateType - simplified versioning
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
      // Update the main question data - only include valid question table fields
      const validQuestionFields = {
        ...(questionData.title && { title: questionData.title }),
        ...(questionData.stem && { stem: questionData.stem }),
        ...(questionData.difficulty && { difficulty: questionData.difficulty }),
        ...(questionData.teaching_point && { teaching_point: questionData.teaching_point }),
        ...(questionData.question_references !== undefined && { question_references: questionData.question_references }),
        ...(questionData.status && { status: questionData.status }),
        ...(questionData.question_set_id !== undefined && { question_set_id: questionData.question_set_id }),
        updated_by: user.id,
        updated_at: new Date().toISOString()
      }

      const { error: updateError } = await adminClient
        .from('questions')
        .update(validQuestionFields)
        .eq('id', questionId)

      if (updateError) {
        throw new Error(`Failed to update question: ${updateError.message}`)
      }

      // Update answer options if provided
      if (answerOptions) {
        console.log('Updating answer options...')

        // Get existing options for this question
        const { data: existingOptions, error: fetchError } = await adminClient
          .from('question_options')
          .select('id, text, is_correct, explanation, order_index')
          .eq('question_id', questionId)

        if (fetchError) {
          console.error('Error fetching existing options:', fetchError)
          throw new Error(`Failed to fetch existing options: ${fetchError.message}`)
        }

        // Get option IDs that are referenced by quiz attempts
        const { data: referencedOptions, error: referencedError } = await adminClient
          .from('quiz_attempts')
          .select('selected_answer_id')
          .not('selected_answer_id', 'is', null)
          .in('selected_answer_id', existingOptions?.map(opt => opt.id) || [])

        if (referencedError) {
          console.error('Error checking referenced options:', referencedError)
          throw new Error(`Failed to check referenced options: ${referencedError.message}`)
        }

        const referencedOptionIds = new Set(referencedOptions?.map(ref => ref.selected_answer_id) || [])
        console.log('Referenced option IDs:', Array.from(referencedOptionIds))

        // Process incoming options
        const incomingOptionIds = new Set()
        const optionsToUpdate = []
        const optionsToInsert = []

        for (let index = 0; index < answerOptions.length; index++) {
          const option = answerOptions[index]
          const optionData = {
            text: option.text,
            is_correct: option.is_correct,
            explanation: option.explanation || null,
            order_index: index
          }

          if (option.id) {
            // This is an existing option - update it
            incomingOptionIds.add(option.id)
            optionsToUpdate.push({
              id: option.id,
              ...optionData
            })
          } else {
            // This is a new option - insert it
            optionsToInsert.push({
              question_id: questionId,
              ...optionData
            })
          }
        }

        // Update existing options
        for (const option of optionsToUpdate) {
          const { error: updateError } = await adminClient
            .from('question_options')
            .update({
              text: option.text,
              is_correct: option.is_correct,
              explanation: option.explanation,
              order_index: option.order_index
            })
            .eq('id', option.id)

          if (updateError) {
            console.error('Error updating option:', updateError)
            throw new Error(`Failed to update option: ${updateError.message}`)
          }
        }

        // Insert new options
        if (optionsToInsert.length > 0) {
          const { error: insertError } = await adminClient
            .from('question_options')
            .insert(optionsToInsert)

          if (insertError) {
            console.error('Error inserting new options:', insertError)
            throw new Error(`Failed to insert new options: ${insertError.message}`)
          }
        }

        // Delete options that are no longer needed (but only if not referenced)
        const existingOptionIds = new Set(existingOptions?.map(opt => opt.id) || [])
        const optionsToDelete = Array.from(existingOptionIds).filter(id =>
          !incomingOptionIds.has(id) && !referencedOptionIds.has(id)
        )

        if (optionsToDelete.length > 0) {
          const { error: deleteError } = await adminClient
            .from('question_options')
            .delete()
            .in('id', optionsToDelete)

          if (deleteError) {
            console.error('Error deleting unreferenced options:', deleteError)
            throw new Error(`Failed to delete unreferenced options: ${deleteError.message}`)
          }
          console.log(`Deleted ${optionsToDelete.length} unreferenced options`)
        }

        // Log warning for options that couldn't be deleted due to references
        const referencedButNotIncoming = Array.from(existingOptionIds).filter(id =>
          !incomingOptionIds.has(id) && referencedOptionIds.has(id)
        )
        if (referencedButNotIncoming.length > 0) {
          console.warn(`Warning: ${referencedButNotIncoming.length} options could not be deleted because they are referenced by quiz attempts:`, referencedButNotIncoming)
        }

        console.log('Answer options updated successfully')
      } else {
        console.log('No answer options to update')
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
              questionImages.map((img: { image_id: string; question_section: string }, index: number) => ({
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
        console.log('Updating tags...')

        // Delete existing tags
        const { error: deleteTagsError } = await adminClient
          .from('question_tags')
          .delete()
          .eq('question_id', questionId)

        if (deleteTagsError) {
          console.error('Error deleting existing tags:', deleteTagsError)
          throw new Error(`Failed to delete existing tags: ${deleteTagsError.message}`)
        }

        // Insert new tags
        if (tagIds && tagIds.length > 0) {
          // Filter out any null/undefined tag IDs
          const validTagIds = tagIds.filter((tagId: string | null | undefined) =>
            tagId !== null &&
            tagId !== undefined &&
            typeof tagId === 'string' &&
            tagId.trim() !== ''
          )

          console.log('Original tagIds:', tagIds)
          console.log('Filtered validTagIds:', validTagIds)

          if (validTagIds.length > 0) {
            const { error: tagsError } = await adminClient
              .from('question_tags')
              .insert(
                validTagIds.map((tagId: string) => ({
                  question_id: questionId,
                  tag_id: tagId
                }))
              )

            if (tagsError) {
              console.error('Tags update error:', tagsError)
              throw new Error(`Failed to update question tags: ${tagsError.message || JSON.stringify(tagsError)}`)
            }
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

      // Handle versioning for published/approved questions (simplified)
      let versionId = null
      if (currentQuestion.status === 'published' || currentQuestion.status === 'approved') {
        // Use simplified versioning function
        const { data: newVersionId, error: versionError } = await adminClient
          .rpc('create_question_version_simplified', {
            question_id_param: questionId,
            change_summary_param: changeSummary || 'Question updated',
            changed_by_param: user.id
          })

        if (versionError) {
          console.error('Error creating question version:', versionError)
          // Continue without versioning rather than failing the entire update
        } else {
          versionId = newVersionId
        }
      }

      // Get updated question data
      const { data: updatedQuestion, error: fetchError } = await adminClient
        .from('questions')
        .select('id, version, updated_at, status')
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
          ? `Question updated to version ${updatedQuestion.version}`
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
