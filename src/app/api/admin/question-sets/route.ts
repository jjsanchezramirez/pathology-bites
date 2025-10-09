// src/app/api/admin/question-sets/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Auth is now handled by middleware

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '0')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    const search = searchParams.get('search')

    // Build query - simplified to avoid join issues
    let query = supabase
      .from('question_sets')
      .select('*', { count: 'exact' })

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
    }

    // Get total count
    const { count, error: countError } = await query

    if (countError) {
      console.error('Error getting count:', countError)
      throw countError
    }

    // Get paginated data
    const { data, error: dataError } = await query
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (dataError) {
      console.error('Error getting data:', dataError)
      throw dataError
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        questionSets: [],
        totalSets: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
        currentPage: page
      })
    }

    // Get question counts for all sets in a single query (eliminates N+1 problem)
    const setIds = data.map(set => set.id)
    const { data: questionCounts } = await supabase
      .from('questions')
      .select('question_set_id')
      .in('question_set_id', setIds)

    // Create a map of set_id -> question_count
    const countMap = new Map<string, number>()
    questionCounts?.forEach(q => {
      if (q.question_set_id) {
        countMap.set(q.question_set_id, (countMap.get(q.question_set_id) || 0) + 1)
      }
    })

    // Transform the data to include question counts
    const setsWithCounts = data.map(set => ({
      ...set,
      question_count: countMap.get(set.id) || 0
    }))

    return NextResponse.json({
      questionSets: setsWithCounts,
      totalSets: count || 0,
      totalPages: Math.ceil((count || 0) / pageSize),
      currentPage: page
    })

  } catch (error) {
    console.error('Error in admin question sets API:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      {
        error: errorMessage,
        details: error instanceof Error ? error.stack : String(error)
      },
      { status: 500 }
    )
  }
}

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
    const { name, description, sourceType, isActive } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Question set name is required' }, { status: 400 })
    }

    if (!sourceType) {
      return NextResponse.json({ error: 'Source type is required' }, { status: 400 })
    }

    // Create question set with service role to bypass RLS
    const { data, error } = await supabase
      .from('question_sets')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        source_type: sourceType,
        is_active: isActive !== false, // Default to true
        created_by: user.id,
        source_details: {} // Empty object for now
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return NextResponse.json({ error: 'A question set with this name already exists' }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({ questionSet: data })

  } catch (error) {
    console.error('Error creating question set:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
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
    const { setId, updates } = body

    if (!setId || !updates) {
      return NextResponse.json({ error: 'Set ID and updates are required' }, { status: 400 })
    }

    // Update question set with service role to bypass RLS
    const { data, error } = await supabase
      .from('question_sets')
      .update(updates)
      .eq('id', setId)
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ questionSet: data })

  } catch (error) {
    console.error('Error updating question set:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
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
    const { setId } = body

    if (!setId) {
      return NextResponse.json({ error: 'Set ID is required' }, { status: 400 })
    }

    // Check if set has questions
    const { data: questions } = await supabase
      .from('questions')
      .select('id')
      .eq('question_set_id', setId)

    if (questions && questions.length > 0) {
      return NextResponse.json({
        error: 'Cannot delete question set with questions. Please move or delete questions first.'
      }, { status: 400 })
    }

    // Delete the question set
    const { error } = await supabase
      .from('question_sets')
      .delete()
      .eq('id', setId)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting question set:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
