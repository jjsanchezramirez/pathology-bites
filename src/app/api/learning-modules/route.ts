// src/app/api/learning-modules/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { LearningModuleFilters } from '@/features/learning-modules/types/learning-modules'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters
    const filters: LearningModuleFilters = {
      category_id: searchParams.get('category_id') || undefined,
      difficulty_level: searchParams.get('difficulty_level') as any || undefined,
      content_type: searchParams.get('content_type') as any || undefined,
      status: searchParams.get('status') as any || 'published',
      is_featured: searchParams.get('is_featured') === 'true' ? true : undefined,
      parent_module_id: searchParams.get('parent_module_id') || undefined,
      search: searchParams.get('search') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20')
    }

    // Handle special case for root modules
    if (searchParams.get('parent_module_id') === 'null') {
      filters.parent_module_id = null as any
    }

    // Build query
    let query = supabase
      .from('learning_modules')
      .select(`
        *,
        category:categories(id, name, color),
        parent_module:learning_modules!parent_module_id(id, title),
        child_modules:learning_modules!parent_module_id(count),
        images:module_images(
          id,
          usage_type,
          sort_order,
          caption,
          alt_text,
          image:images(id, url, alt_text, description)
        )
      `)

    // Apply filters
    if (filters.category_id) {
      query = query.eq('category_id', filters.category_id)
    }
    
    if (filters.difficulty_level) {
      query = query.eq('difficulty_level', filters.difficulty_level)
    }
    
    if (filters.content_type) {
      query = query.eq('content_type', filters.content_type)
    }
    
    if (filters.status) {
      query = query.eq('status', filters.status)
    }
    
    if (filters.is_featured !== undefined) {
      query = query.eq('is_featured', filters.is_featured)
    }
    
    if (filters.parent_module_id !== undefined) {
      if (filters.parent_module_id === null) {
        query = query.is('parent_module_id', null)
      } else {
        query = query.eq('parent_module_id', filters.parent_module_id)
      }
    }
    
    if (filters.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
    }

    // Apply pagination
    const from = ((filters.page || 1) - 1) * (filters.limit || 20)
    const to = from + (filters.limit || 20) - 1
    
    query = query.range(from, to)
    
    // Order by sort_order, then by created_at
    query = query.order('sort_order', { ascending: true })
    query = query.order('created_at', { ascending: false })

    const { data: modules, error, count } = await query

    if (error) {
      console.error('Error fetching learning modules:', error)
      return NextResponse.json(
        { error: 'Failed to fetch learning modules' },
        { status: 500 }
      )
    }

    // Get total count for pagination
    const { count: totalCount } = await supabase
      .from('learning_modules')
      .select('*', { count: 'exact', head: true })
      .eq('status', filters.status || 'published')

    return NextResponse.json({
      data: modules,
      pagination: {
        page: filters.page || 1,
        limit: filters.limit || 20,
        total: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / (filters.limit || 20))
      }
    })

  } catch (error) {
    console.error('Unexpected error in learning modules API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if user has admin or content creator role
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'creator'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    
    // Generate slug if not provided
    if (!body.slug && body.title) {
      body.slug = body.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
    }

    // Create the module
    const { data: module, error } = await supabase
      .from('learning_modules')
      .insert({
        ...body,
        created_by: user.id,
        status: body.status || 'draft'
      })
      .select(`
        *,
        category:categories(id, name, color)
      `)
      .single()

    if (error) {
      console.error('Error creating learning module:', error)
      return NextResponse.json(
        { error: 'Failed to create learning module' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: module }, { status: 201 })

  } catch (error) {
    console.error('Unexpected error creating learning module:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
