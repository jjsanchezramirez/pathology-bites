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
 * POST /api/admin/questions/:id/copy
 * 
 * Create a copy of an existing question
 * - Creates a new draft question based on the original
 * - Copies all question data, options, and images
 * - Sets status to 'draft' and assigns to current user
 * - Increments version number if copying from same user
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: originalQuestionId } = await params

    // Use regular client for auth
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use admin client for database operations
    const supabase = createAdminClient()

    // Fetch the original question with all related data
    const { data: originalQuestion, error: fetchError } = await supabase
      .from('questions')
      .select(`
        *,
        question_options(*),
        question_images(*),
        question_tags(tag_id),
        question_categories(category_id)
      `)
      .eq('id', originalQuestionId)
      .single()

    if (fetchError || !originalQuestion) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      )
    }

    // Check if user has permission to copy this question
    // Users can copy their own questions or any published questions
    const canCopy = originalQuestion.created_by === user.id ||
                   originalQuestion.status === 'published'

    if (!canCopy) {
      return NextResponse.json(
        { error: 'You do not have permission to copy this question' },
        { status: 403 }
      )
    }

    // Prepare the new question data
    const newQuestionData = {
      title: `${originalQuestion.title} (Copy)`,
      stem: originalQuestion.stem,
      teaching_point: originalQuestion.teaching_point,
      question_references: originalQuestion.question_references,
      difficulty: originalQuestion.difficulty,
      yield: originalQuestion.yield,
      status: 'draft',
      created_by: user.id,
      question_set_id: originalQuestion.question_set_id,
      version: originalQuestion.created_by === user.id ? (originalQuestion.version || 1) + 1 : 1,
      metadata: {
        ...originalQuestion.metadata,
        copied_from: originalQuestionId,
        copied_at: new Date().toISOString(),
        copied_by: user.id
      }
    }

    // Create the new question
    const { data: newQuestion, error: createError } = await supabase
      .from('questions')
      .insert(newQuestionData)
      .select()
      .single()

    if (createError || !newQuestion) {
      console.error('Error creating question copy:', createError)
      return NextResponse.json(
        { error: 'Failed to create question copy' },
        { status: 500 }
      )
    }

    // Copy question options
    if (originalQuestion.question_options && originalQuestion.question_options.length > 0) {
      const newOptions = originalQuestion.question_options.map((option: any) => ({
        question_id: newQuestion.id,
        text: option.text,
        is_correct: option.is_correct,
        explanation: option.explanation,
        order_index: option.order_index
      }))

      const { error: optionsError } = await supabase
        .from('question_options')
        .insert(newOptions)

      if (optionsError) {
        console.error('Error copying question options:', optionsError)
        // Don't fail the entire operation, but log the error
      }
    }

    // Copy question images
    if (originalQuestion.question_images && originalQuestion.question_images.length > 0) {
      const newImages = originalQuestion.question_images.map((image: any) => ({
        question_id: newQuestion.id,
        image_id: image.image_id,
        question_section: image.question_section,
        order_index: image.order_index
      }))

      const { error: imagesError } = await supabase
        .from('question_images')
        .insert(newImages)

      if (imagesError) {
        console.error('Error copying question images:', imagesError)
        // Don't fail the entire operation, but log the error
      }
    }

    // Copy question tags
    if (originalQuestion.question_tags && originalQuestion.question_tags.length > 0) {
      const newTags = originalQuestion.question_tags.map((tag: any) => ({
        question_id: newQuestion.id,
        tag_id: tag.tag_id
      }))

      const { error: tagsError } = await supabase
        .from('question_tags')
        .insert(newTags)

      if (tagsError) {
        console.error('Error copying question tags:', tagsError)
        // Don't fail the entire operation, but log the error
      }
    }

    // Copy question categories
    if (originalQuestion.question_categories && originalQuestion.question_categories.length > 0) {
      const newCategories = originalQuestion.question_categories.map((category: any) => ({
        question_id: newQuestion.id,
        category_id: category.category_id
      }))

      const { error: categoriesError } = await supabase
        .from('question_categories')
        .insert(newCategories)

      if (categoriesError) {
        console.error('Error copying question categories:', categoriesError)
        // Don't fail the entire operation, but log the error
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Question copied successfully',
      data: {
        originalQuestionId,
        newQuestionId: newQuestion.id,
        newQuestionTitle: newQuestion.title
      }
    })

  } catch (error) {
    console.error('Error copying question:', error)
    return NextResponse.json(
      { 
        error: 'Failed to copy question',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
