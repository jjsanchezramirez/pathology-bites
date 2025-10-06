// src/app/api/content/learning/modules-paths/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { LearningPathFilters } from '@/features/learning-modules/types/learning-modules'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters
    const filters: LearningPathFilters = {
      category_id: searchParams.get('category_id') || undefined,
      difficulty_level: searchParams.get('difficulty_level') as any || undefined,
      status: searchParams.get('status') as any || 'published',
      is_featured: searchParams.get('is_featured') === 'true' ? true : undefined,
      search: searchParams.get('search') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20')
    }

    // Build query
    let query = supabase
      .from('learning_paths')
      .select(`
        *,
        category:categories(id, name, color),
        thumbnail_image:images(id, url, alt_text),
        modules:learning_path_modules(
          id, sort_order, is_required, custom_description,
          module:learning_modules(
            id, title, slug, description, difficulty_level,
            estimated_duration_minutes, status
          )
        )
      `)

    // Apply filters
    if (filters.category_id) {
      query = query.eq('category_id', filters.category_id)
    }
    
    if (filters.difficulty_level) {
      query = query.eq('difficulty_level', filters.difficulty_level)
    }
    
    if (filters.status) {
      query = query.eq('status', filters.status)
    }
    
    if (filters.is_featured !== undefined) {
      query = query.eq('is_featured', filters.is_featured)
    }
    
    if (filters.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
    }

    // Apply pagination
    const from = ((filters.page || 1) - 1) * (filters.limit || 20)
    const to = from + (filters.limit || 20) - 1
    
    query = query.range(from, to)
    
    // Order by featured first, then by created_at
    query = query.order('is_featured', { ascending: false })
    query = query.order('created_at', { ascending: false })

    const { data: paths, error } = await query

    if (error) {
      console.error('Error fetching learning paths:', error)
      return NextResponse.json(
        { error: 'Failed to fetch learning paths' },
        { status: 500 }
      )
    }

    // Sort modules within each path by sort_order
    paths?.forEach(path => {
      if (path.modules) {
        path.modules.sort((a: any, b: any) => a.sort_order - b.sort_order)
      }
    })

    // Get total count for pagination
    const { count: totalCount } = await supabase
      .from('learning_paths')
      .select('*', { count: 'exact', head: true })
      .eq('status', filters.status || 'published')

    return NextResponse.json({
      data: paths,
      pagination: {
        page: filters.page || 1,
        limit: filters.limit || 20,
        total: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / (filters.limit || 20))
      }
    })

  } catch (error) {
    console.error('Unexpected error in learning paths API:', error)
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

    // Extract modules data if provided
    const { modules, ...pathData } = body

    // Create the learning path
    const { data: path, error } = await supabase
      .from('learning_paths')
      .insert({
        ...pathData,
        created_by: user.id,
        status: pathData.status || 'draft'
      })
      .select(`
        *,
        category:categories(id, name, color),
        thumbnail_image:images(id, url, alt_text)
      `)
      .single()

    if (error) {
      console.error('Error creating learning path:', error)
      return NextResponse.json(
        { error: 'Failed to create learning path' },
        { status: 500 }
      )
    }

    // Add modules to the path if provided
    if (modules && modules.length > 0) {
      const moduleInserts = modules.map((module: any) => ({
        learning_path_id: path.id,
        module_id: module.module_id,
        sort_order: module.sort_order,
        is_required: module.is_required ?? true,
        unlock_criteria: module.unlock_criteria,
        custom_description: module.custom_description
      }))

      const { error: modulesError } = await supabase
        .from('learning_path_modules')
        .insert(moduleInserts)

      if (modulesError) {
        console.error('Error adding modules to learning path:', modulesError)
        // Don't fail the entire operation, just log the error
      }
    }

    return NextResponse.json({ data: path }, { status: 201 })

  } catch (error) {
    console.error('Unexpected error creating learning path:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
