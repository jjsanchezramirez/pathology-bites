// src/app/api/admin/learning-modules/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Auth is now handled by middleware
    const { data: { user } } = await supabase.auth.getUser() // Still need user ID for created_by

    // Still need role check for business logic
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'creator'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Admin or creator permissions required' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') || undefined
    const category_id = searchParams.get('category_id') || undefined
    const search = searchParams.get('search') || undefined

    // Build query for admin view (includes all statuses)
    let query = supabase
      .from('learning_modules')
      .select(`
        *,
        category:categories(id, name, color),
        parent_module:learning_modules!parent_module_id(id, title),
        child_modules:learning_modules!parent_module_id(count),
        created_by_user:user_profiles!created_by(id, first_name, last_name, email),
        reviewed_by_user:user_profiles!reviewed_by(id, first_name, last_name, email),
        images:module_images(count),
        sessions:module_sessions(count),
        attempts:module_attempts(count)
      `)

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }
    
    if (category_id) {
      query = query.eq('category_id', category_id)
    }
    
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
    }

    // Apply pagination
    const from = (page - 1) * limit
    const to = from + limit - 1
    
    query = query.range(from, to)
    query = query.order('created_at', { ascending: false })

    const { data: modules, error } = await query

    if (error) {
      console.error('Error fetching admin learning modules:', error)
      return NextResponse.json(
        { error: 'Failed to fetch learning modules' },
        { status: 500 }
      )
    }

    // Get total count
    let countQuery = supabase
      .from('learning_modules')
      .select('*', { count: 'exact', head: true })

    if (status) countQuery = countQuery.eq('status', status)
    if (category_id) countQuery = countQuery.eq('category_id', category_id)
    if (search) countQuery = countQuery.or(`title.ilike.%${search}%,description.ilike.%${search}%`)

    const { count: totalCount } = await countQuery

    return NextResponse.json({
      data: modules,
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit)
      }
    })

  } catch (error) {
    console.error('Unexpected error in admin learning modules API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Auth is now handled by middleware
    const { data: { user } } = await supabase.auth.getUser() // Still need user ID for created_by

    // Still need role check for business logic
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'creator'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Admin or creator permissions required' },
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

    // Extract image and prerequisite data
    const { image_ids, prerequisite_module_ids, ...moduleData } = body

    // Create the module
    const { data: module, error } = await supabase
      .from('learning_modules')
      .insert({
        ...moduleData,
        created_by: user.id,
        status: moduleData.status || 'draft'
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

    // Add images if provided
    if (image_ids && image_ids.length > 0) {
      const imageInserts = image_ids.map((imageId: string, index: number) => ({
        module_id: module.id,
        image_id: imageId,
        usage_type: 'content',
        sort_order: index
      }))

      await supabase
        .from('module_images')
        .insert(imageInserts)
    }

    // Add prerequisites if provided
    if (prerequisite_module_ids && prerequisite_module_ids.length > 0) {
      const prerequisiteInserts = prerequisite_module_ids.map((prereqId: string) => ({
        module_id: module.id,
        prerequisite_module_id: prereqId,
        requirement_type: 'required'
      }))

      await supabase
        .from('module_prerequisites')
        .insert(prerequisiteInserts)
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

// Bulk operations endpoint
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Auth is now handled by middleware
    const { data: { user } } = await supabase.auth.getUser() // Still need user ID for reviewed_by

    // Still need role check for business logic
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin permissions required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { action, module_ids, data: updateData } = body

    if (!action || !module_ids || !Array.isArray(module_ids)) {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      )
    }

    let result
    switch (action) {
      case 'publish':
        result = await supabase
          .from('learning_modules')
          .update({ 
            status: 'published', 
            published_at: new Date().toISOString(),
            reviewed_by: user.id
          })
          .in('id', module_ids)
        break

      case 'archive':
        result = await supabase
          .from('learning_modules')
          .update({ status: 'archived' })
          .in('id', module_ids)
        break

      case 'update':
        if (!updateData) {
          return NextResponse.json(
            { error: 'Update data required' },
            { status: 400 }
          )
        }
        result = await supabase
          .from('learning_modules')
          .update(updateData)
          .in('id', module_ids)
        break

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

    if (result.error) {
      console.error('Error in bulk operation:', result.error)
      return NextResponse.json(
        { error: 'Bulk operation failed' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      message: `Bulk ${action} completed successfully`,
      affected_count: module_ids.length
    })

  } catch (error) {
    console.error('Unexpected error in bulk operation:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
