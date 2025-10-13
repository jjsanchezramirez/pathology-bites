import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userError || !['admin', 'creator', 'reviewer'].includes(userData?.role)) {
      return NextResponse.json({ error: 'Forbidden - Admin, Creator, or Reviewer access required' }, { status: 403 })
    }

    const { sourceTagIds, targetTagId } = await request.json()
    console.log('Merge request:', { sourceTagIds, targetTagId })

    if (!sourceTagIds || !Array.isArray(sourceTagIds) || sourceTagIds.length === 0) {
      return NextResponse.json(
        { error: 'Source tag IDs are required' },
        { status: 400 }
      )
    }

    if (!targetTagId) {
      return NextResponse.json(
        { error: 'Target tag ID is required' },
        { status: 400 }
      )
    }

    // Ensure target tag is not in source tags list
    if (sourceTagIds.includes(targetTagId)) {
      return NextResponse.json(
        { error: 'Target tag cannot be one of the source tags' },
        { status: 400 }
      )
    }

    // Handle the merge properly by ensuring all questions get the target tag
    // 1. Get all unique question_ids that use any of the source tags
    const { data: sourceQuestionTags, error: fetchError } = await supabase
      .from('question_tags')
      .select('question_id')
      .in('tag_id', sourceTagIds)

    if (fetchError) {
      console.error('Error fetching source question_tags:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch question tags' },
        { status: 500 }
      )
    }

    // Get unique question IDs that had any of the source tags
    const questionIdsToTag = [...new Set(sourceQuestionTags?.map(qt => qt.question_id) || [])]
    console.log('Questions that had source tags:', questionIdsToTag.length, questionIdsToTag)

    // 2. Get all question_tags that already use the target tag to avoid duplicates
    const { data: existingTargetTags, error: targetFetchError } = await supabase
      .from('question_tags')
      .select('question_id')
      .eq('tag_id', targetTagId)
      .in('question_id', questionIdsToTag)

    if (targetFetchError) {
      console.error('Error fetching existing target question_tags:', targetFetchError)
      return NextResponse.json(
        { error: 'Failed to fetch existing target tags' },
        { status: 500 }
      )
    }

    const existingQuestionIds = new Set(existingTargetTags?.map(qt => qt.question_id) || [])
    console.log('Questions that already have target tag:', existingQuestionIds.size, Array.from(existingQuestionIds))

    // 3. Insert target tag for questions that don't already have it (BEFORE deleting source tags)
    // This ensures data integrity - if insert fails, source tags remain intact
    const newQuestionTags = questionIdsToTag
      .filter(questionId => !existingQuestionIds.has(questionId))
      .map(questionId => ({
        question_id: questionId,
        tag_id: targetTagId
      }))
    console.log('New question_tags to insert:', newQuestionTags.length, newQuestionTags)

    if (newQuestionTags.length > 0) {
      const { error: insertError } = await supabase
        .from('question_tags')
        .insert(newQuestionTags)

      if (insertError) {
        console.error('Error inserting new question_tags:', insertError)
        return NextResponse.json(
          { error: 'Failed to reassign questions to target tag' },
          { status: 500 }
        )
      }
    }

    // 4. Delete all source question_tags (AFTER successfully inserting target tags)
    // This prevents data loss if the insert operation fails
    const { error: deleteSourceError } = await supabase
      .from('question_tags')
      .delete()
      .in('tag_id', sourceTagIds)

    if (deleteSourceError) {
      console.error('Error deleting source question_tags:', deleteSourceError)
      return NextResponse.json(
        { error: 'Failed to delete source question tags' },
        { status: 500 }
      )
    }

    // 5. Delete the source tags from the tags table
    const { error: deleteTagsError } = await supabase
      .from('tags')
      .delete()
      .in('id', sourceTagIds)

    if (deleteTagsError) {
      console.error('Error deleting source tags:', deleteTagsError)
      return NextResponse.json(
        { error: 'Failed to delete source tags' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: `Successfully merged ${sourceTagIds.length} tags into target tag`,
      mergedCount: sourceTagIds.length
    })

  } catch (error) {
    console.error('Error in merge tags API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}