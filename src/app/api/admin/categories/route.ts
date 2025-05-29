// src/app/api/admin/categories/route.ts
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
      .from('categories')
      .select(`
        *,
        parent:parent_id(name)
      `, { count: 'exact' })

    if (search) {
      query = query.ilike('name', `%${search}%`)
    }

    // Get total count
    const { count } = await query

    // Get paginated data
    const { data, error: dataError } = await query
      .order('level, name')
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (dataError) {
      throw dataError
    }

    // Get question counts for each category
    const categoriesWithCounts = await Promise.all(
      (data || []).map(async (category) => {
        const { count: questionCount } = await serviceSupabase
          .from('questions_categories')
          .select('*', { count: 'exact', head: true })
          .eq('category_id', category.id)

        return {
          ...category,
          question_count: questionCount || 0,
          parent_name: category.parent?.name
        }
      })
    )

    return NextResponse.json({
      categories: categoriesWithCounts,
      totalCategories: count || 0,
      totalPages: Math.ceil((count || 0) / pageSize),
      currentPage: page
    })

  } catch (error) {
    console.error('Error in admin categories API:', error)
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
    const { name, description, parentId, color } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 })
    }

    // Calculate level based on parent
    let level = 1
    if (parentId) {
      const { data: parentData } = await serviceSupabase
        .from('categories')
        .select('level')
        .eq('id', parentId)
        .single()

      if (parentData) {
        level = parentData.level + 1
      }
    }

    // Create category with service role to bypass RLS
    const { data, error } = await serviceSupabase
      .from('categories')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        parent_id: parentId || null,
        level,
        color: color?.trim() || null
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return NextResponse.json({ error: 'A category with this name already exists' }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({ category: data })

  } catch (error) {
    console.error('Error creating category:', error)
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
    const { categoryId, name, description, parentId, color } = body

    if (!categoryId || !name || !name.trim()) {
      return NextResponse.json({ error: 'Category ID and name are required' }, { status: 400 })
    }

    // Calculate level based on parent
    let level = 1
    if (parentId) {
      const { data: parentData } = await serviceSupabase
        .from('categories')
        .select('level')
        .eq('id', parentId)
        .single()

      if (parentData) {
        level = parentData.level + 1
      }
    }

    // Update category with service role to bypass RLS
    const { data, error } = await serviceSupabase
      .from('categories')
      .update({
        name: name.trim(),
        description: description?.trim() || null,
        parent_id: parentId || null,
        level,
        color: color?.trim() || null
      })
      .eq('id', categoryId)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return NextResponse.json({ error: 'A category with this name already exists' }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({ category: data })

  } catch (error) {
    console.error('Error updating category:', error)
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
    const { categoryId } = body

    if (!categoryId) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 })
    }

    // Check if category has children
    const { data: children } = await serviceSupabase
      .from('categories')
      .select('id')
      .eq('parent_id', categoryId)

    if (children && children.length > 0) {
      return NextResponse.json({
        error: 'Cannot delete category with subcategories. Please delete subcategories first.'
      }, { status: 400 })
    }

    // First delete all questions_categories relationships
    const { error: relationError } = await serviceSupabase
      .from('questions_categories')
      .delete()
      .eq('category_id', categoryId)

    if (relationError) {
      throw relationError
    }

    // Then delete the category
    const { error } = await serviceSupabase
      .from('categories')
      .delete()
      .eq('id', categoryId)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting category:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
