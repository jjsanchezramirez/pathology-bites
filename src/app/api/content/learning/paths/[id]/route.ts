// src/app/api/content/learning/modules-paths/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params
    const { searchParams } = new URL(request.url)
    
    // Check if user wants to include enrollment data
    const includeEnrollment = searchParams.get('include_enrollment') === 'true'
    
    // Get the learning path with all related data
    const { data: path, error } = await supabase
      .from('learning_paths')
      .select(`
        *,
        category:categories(id, name, color, description),
        thumbnail_image:images(id, url, alt_text, description),
        modules:learning_path_modules(
          id, sort_order, is_required, unlock_criteria, 
          custom_description, estimated_duration_override,
          module:learning_modules(
            id, title, slug, description, content, difficulty_level,
            estimated_duration_minutes, content_type, status, is_featured,
            learning_objectives, view_count, average_rating,
            category:categories(id, name, color),
            images:module_images(
              id, usage_type, sort_order, caption,
              image:images(id, url, alt_text)
            )
          )
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Learning path not found' },
          { status: 404 }
        )
      }
      console.error('Error fetching learning path:', error)
      return NextResponse.json(
        { error: 'Failed to fetch learning path' },
        { status: 500 }
      )
    }

    // Sort modules by sort_order
    if (path.modules) {
      path.modules.sort((a: any, b: any) => a.sort_order - b.sort_order)
      
      // Sort images within each module
      path.modules.forEach((pathModule: any) => {
        if (pathModule.module?.images) {
          pathModule.module.images.sort((a: any, b: any) => a.sort_order - b.sort_order)
        }
      })
    }

    // If user is authenticated and wants enrollment data, fetch user-specific data
    let userEnrollment = null
    if (includeEnrollment) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: enrollment } = await supabase
          .from('user_learning_path_enrollments')
          .select('*')
          .eq('learning_path_id', parseInt(id))
          .eq('user_id', user.id)
          .single()

        userEnrollment = enrollment
      }
    }

    const response = {
      data: {
        ...path,
        user_enrollment: userEnrollment
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Unexpected error in learning path API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if user has permission to edit this path
    const { data: path } = await supabase
      .from('learning_paths')
      .select('created_by')
      .eq('id', id)
      .single()

    if (!path) {
      return NextResponse.json(
        { error: 'Learning path not found' },
        { status: 404 }
      )
    }

    // Check if user is admin, content creator, or the creator of this path
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const canEdit = profile && (
      ['admin', 'creator'].includes(profile.role) ||
      path.created_by === user.id
    )

    if (!canEdit) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { modules, ...pathData } = body
    
    // Update the learning path
    const { data: updatedPath, error } = await supabase
      .from('learning_paths')
      .update({
        ...pathData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        category:categories(id, name, color),
        thumbnail_image:images(id, url, alt_text)
      `)
      .single()

    if (error) {
      console.error('Error updating learning path:', error)
      return NextResponse.json(
        { error: 'Failed to update learning path' },
        { status: 500 }
      )
    }

    // Update modules if provided
    if (modules) {
      // Delete existing modules
      await supabase
        .from('learning_path_modules')
        .delete()
        .eq('learning_path_id', parseInt(id))

      // Insert new modules
      if (modules.length > 0) {
        const moduleInserts = modules.map((module: any) => ({
          learning_path_id: parseInt(id),
          module_id: module.module_id,
          sort_order: module.sort_order,
          is_required: module.is_required ?? true,
          unlock_criteria: module.unlock_criteria,
          custom_description: module.custom_description,
          estimated_duration_override: module.estimated_duration_override
        }))

        const { error: modulesError } = await supabase
          .from('learning_path_modules')
          .insert(moduleInserts)

        if (modulesError) {
          console.error('Error updating learning path modules:', modulesError)
        }
      }
    }

    return NextResponse.json({ data: updatedPath })

  } catch (error) {
    console.error('Unexpected error updating learning path:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if user has admin role (only admins can delete)
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

    // Check if path has enrollments
    const { data: enrollments } = await supabase
      .from('user_learning_path_enrollments')
      .select('id')
      .eq('learning_path_id', parseInt(id))

    if (enrollments && enrollments.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete learning path with active enrollments' },
        { status: 400 }
      )
    }

    // Delete the learning path (cascade will handle related records)
    const { error } = await supabase
      .from('learning_paths')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting learning path:', error)
      return NextResponse.json(
        { error: 'Failed to delete learning path' },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: 'Learning path deleted successfully' })

  } catch (error) {
    console.error('Unexpected error deleting learning path:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
