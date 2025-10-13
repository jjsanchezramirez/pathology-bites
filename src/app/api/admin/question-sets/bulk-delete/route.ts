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
    const { setIds } = body

    if (!setIds || !Array.isArray(setIds) || setIds.length === 0) {
      return NextResponse.json({ error: 'Set IDs array is required' }, { status: 400 })
    }

    // Check if any sets have questions
    const { data: questionsCheck } = await supabase
      .from('questions')
      .select('question_set_id')
      .in('question_set_id', setIds)

    if (questionsCheck && questionsCheck.length > 0) {
      const setsWithQuestions = [...new Set(questionsCheck.map(q => q.question_set_id))]
      return NextResponse.json({
        error: `Cannot delete question sets with questions. ${setsWithQuestions.length} sets have questions. Please move or delete questions first.`
      }, { status: 400 })
    }

    // Delete the question sets
    const { error, count } = await supabase
      .from('question_sets')
      .delete()
      .in('id', setIds)

    if (error) {
      throw error
    }

    return NextResponse.json({ 
      success: true, 
      deletedCount: count || setIds.length 
    })

  } catch (error) {
    console.error('Error bulk deleting question sets:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
