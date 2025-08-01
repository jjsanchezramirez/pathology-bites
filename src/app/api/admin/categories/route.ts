// src/app/api/admin/categories/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('Categories API - Authentication error:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userError) {
      console.error('Categories API - User lookup error:', userError)
      return NextResponse.json({ error: 'User lookup failed' }, { status: 500 })
    }

    if (!['admin', 'creator', 'reviewer'].includes(userData?.role)) {
      console.error('Categories API - User does not have required role:', userData?.role)
      return NextResponse.json({ error: 'Forbidden - Admin, Creator, or Reviewer access required' }, { status: 403 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '0')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    const search = searchParams.get('search')

    // Build query
    let query = supabase
      .from('categories')
      .select(`
        *,
        parent:parent_id(name, short_form, color)
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
        const { count: questionCount } = await supabase
          .from('questions')
          .select('*', { count: 'exact', head: true })
          .eq('category_id', category.id)

        return {
          ...category,
          question_count: questionCount || 0,
          parent_name: category.parent?.name,
          parent_short_form: category.parent?.short_form,
          parent_color: category.parent?.color
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

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userError || !['admin', 'creator', 'reviewer'].includes(userData?.role)) {
      return NextResponse.json({ error: 'Forbidden - Admin, Creator, or Reviewer access required' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, parentId, color } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 })
    }

    // Calculate level based on parent
    let level = 1
    if (parentId) {
      const { data: parentData } = await supabase
        .from('categories')
        .select('level')
        .eq('id', parentId)
        .single()

      if (parentData) {
        level = parentData.level + 1
      }
    }

    // Create category with service role to bypass RLS
    const { data, error } = await supabase
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

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userError || !['admin', 'creator', 'reviewer'].includes(userData?.role)) {
      return NextResponse.json({ error: 'Forbidden - Admin, Creator, or Reviewer access required' }, { status: 403 })
    }

    const body = await request.json()
    const { categoryId, name, description, parentId, color } = body

    if (!categoryId || !name || !name.trim()) {
      return NextResponse.json({ error: 'Category ID and name are required' }, { status: 400 })
    }

    // Calculate level based on parent
    let level = 1
    if (parentId) {
      const { data: parentData } = await supabase
        .from('categories')
        .select('level')
        .eq('id', parentId)
        .single()

      if (parentData) {
        level = parentData.level + 1
      }
    }

    // Update category with service role to bypass RLS
    const { data, error } = await supabase
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

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userError || !['admin', 'creator', 'reviewer'].includes(userData?.role)) {
      return NextResponse.json({ error: 'Forbidden - Admin, Creator, or Reviewer access required' }, { status: 403 })
    }

    const body = await request.json()
    const { categoryId } = body

    if (!categoryId) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 })
    }

    // Check if category has children
    const { data: children } = await supabase
      .from('categories')
      .select('id')
      .eq('parent_id', categoryId)

    if (children && children.length > 0) {
      return NextResponse.json({
        error: 'Cannot delete category with subcategories. Please delete subcategories first.'
      }, { status: 400 })
    }

    // First update all questions that reference this category to null
    const { error: relationError } = await supabase
      .from('questions')
      .update({ category_id: null })
      .eq('category_id', categoryId)

    if (relationError) {
      throw relationError
    }

    // Then delete the category
    const { error } = await supabase
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
