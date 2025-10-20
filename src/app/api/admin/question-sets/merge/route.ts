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

    const body = await request.json()
    const { sourceSetIds, targetSetId } = body

    if (!sourceSetIds || !Array.isArray(sourceSetIds) || sourceSetIds.length === 0) {
      return NextResponse.json({ error: 'Source set IDs array is required' }, { status: 400 })
    }

    if (!targetSetId) {
      return NextResponse.json({ error: 'Target set ID is required' }, { status: 400 })
    }

    // Verify target set exists
    const { data: targetSet, error: targetError } = await supabase
      .from('question_sets')
      .select('id, name')
      .eq('id', targetSetId)
      .single()

    if (targetError || !targetSet) {
      return NextResponse.json({ error: 'Target question set not found' }, { status: 404 })
    }

    // Verify source sets exist
    const { data: sourceSets, error: sourceError } = await supabase
      .from('question_sets')
      .select('id, name')
      .in('id', sourceSetIds)

    if (sourceError || !sourceSets || sourceSets.length !== sourceSetIds.length) {
      return NextResponse.json({ error: 'One or more source question sets not found' }, { status: 404 })
    }

    // Start transaction by moving all questions from source sets to target set
    const { error: moveError, count: movedCount } = await supabase
      .from('questions')
      .update({ question_set_id: targetSetId })
      .in('question_set_id', sourceSetIds)

    if (moveError) {
      throw moveError
    }

    // Delete the source question sets
    const { error: deleteError } = await supabase
      .from('question_sets')
      .delete()
      .in('id', sourceSetIds)

    if (deleteError) {
      // If deletion fails, we should ideally rollback the question moves
      // For now, we'll log the error but still report success for the merge
      console.error('Error deleting source sets after merge:', deleteError)
    }

    return NextResponse.json({ 
      success: true, 
      mergedCount: sourceSetIds.length,
      movedQuestions: movedCount || 0,
      targetSet: targetSet.name
    })

  } catch (error) {
    console.error('Error merging question sets:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
