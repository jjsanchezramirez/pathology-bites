import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tagId: string }> }
) {
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

    // Await params in Next.js 15
    const { tagId } = await params

    if (!tagId) {
      return NextResponse.json({ error: 'Tag ID is required' }, { status: 400 })
    }

    // Get questions associated with this tag
    const { data: questionTags, error: questionTagsError } = await supabase
      .from('question_tags')
      .select(`
        question_id,
        questions (
          id,
          title,
          stem,
          category_id,
          categories (
            name
          )
        )
      `)
      .eq('tag_id', tagId)

    if (questionTagsError) {
      console.error('Error fetching questions for tag:', questionTagsError)
      return NextResponse.json(
        { error: 'Failed to fetch questions' },
        { status: 500 }
      )
    }

    // Transform the data to a more usable format
    const questions = questionTags?.map(qt => ({
      id: qt.questions?.id,
      title: qt.questions?.title,
      stem: qt.questions?.stem,
      category: qt.questions?.categories?.name
    })) || []

    return NextResponse.json({
      questions,
      count: questions.length
    })

  } catch (error) {
    console.error('Error in tag questions API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}