// src/app/api/admin/tags/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const serviceSupabase = createServiceClient()

    const { data: userData, error: userError } = await serviceSupabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userError || userData?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '0')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    const search = searchParams.get('search')

    // Build query
    let query = serviceSupabase
      .from('tags')
      .select('*', { count: 'exact' })

    if (search) {
      query = query.ilike('name', `%${search}%`)
    }

    // Get total count
    const { count } = await query

    // Get paginated data
    const { data, error: dataError } = await query
      .order('name')
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (dataError) {
      throw dataError
    }

    // Get question counts for each tag
    const tagsWithCounts = await Promise.all(
      (data || []).map(async (tag) => {
        const { count: questionCount } = await serviceSupabase
          .from('questions_tags')
          .select('*', { count: 'exact', head: true })
          .eq('tag_id', tag.id)

        return {
          ...tag,
          question_count: questionCount || 0
        }
      })
    )

    return NextResponse.json({
      tags: tagsWithCounts,
      totalTags: count || 0,
      totalPages: Math.ceil((count || 0) / pageSize),
      currentPage: page
    })

  } catch (error) {
    console.error('Error in admin tags API:', error)
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
    const serviceSupabase = createServiceClient()

    const { data: userData, error: userError } = await serviceSupabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userError || userData?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { name } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Tag name is required' }, { status: 400 })
    }

    // Create tag with service role to bypass RLS
    const { data, error } = await serviceSupabase
      .from('tags')
      .insert({ name: name.trim() })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return NextResponse.json({ error: 'A tag with this name already exists' }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({ tag: data })

  } catch (error) {
    console.error('Error creating tag:', error)
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
    const serviceSupabase = createServiceClient()

    const { data: userData, error: userError } = await serviceSupabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userError || userData?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { tagId, name } = body

    if (!tagId || !name || !name.trim()) {
      return NextResponse.json({ error: 'Tag ID and name are required' }, { status: 400 })
    }

    // Update tag with service role to bypass RLS
    const { data, error } = await serviceSupabase
      .from('tags')
      .update({ name: name.trim() })
      .eq('id', tagId)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return NextResponse.json({ error: 'A tag with this name already exists' }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({ tag: data })

  } catch (error) {
    console.error('Error updating tag:', error)
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
    const serviceSupabase = createServiceClient()

    const { data: userData, error: userError } = await serviceSupabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userError || userData?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { tagId } = body

    if (!tagId) {
      return NextResponse.json({ error: 'Tag ID is required' }, { status: 400 })
    }

    // First delete all questions_tags relationships
    const { error: relationError } = await serviceSupabase
      .from('questions_tags')
      .delete()
      .eq('tag_id', tagId)

    if (relationError) {
      throw relationError
    }

    // Then delete the tag
    const { error } = await serviceSupabase
      .from('tags')
      .delete()
      .eq('id', tagId)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting tag:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
