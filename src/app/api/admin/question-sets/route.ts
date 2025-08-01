// src/app/api/admin/question-sets/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'

export async function GET(request: NextRequest) {
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

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '0')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    const search = searchParams.get('search')

    // Build query
    let query = supabase
      .from('sets')
      .select(`
        *,
        created_by_user:created_by(first_name, last_name)
      `, { count: 'exact' })

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
    }

    // Get total count
    const { count } = await query

    // Get paginated data
    const { data, error: dataError } = await query
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (dataError) {
      throw dataError
    }

    // Get question counts for each set
    const setsWithCounts = await Promise.all(
      (data || []).map(async (set) => {
        const { count: questionCount } = await supabase
          .from('questions')
          .select('*', { count: 'exact', head: true })
          .eq('question_set_id', set.id)

        return {
          ...set,
          question_count: questionCount || 0
        }
      })
    )

    return NextResponse.json({
      questionSets: setsWithCounts,
      totalSets: count || 0,
      totalPages: Math.ceil((count || 0) / pageSize),
      currentPage: page
    })

  } catch (error) {
    console.error('Error in admin question sets API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
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
      .from('sets')
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
      .from('sets')
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
      .from('sets')
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
