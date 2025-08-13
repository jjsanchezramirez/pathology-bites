// src/app/api/learning-modules/[id]/route.ts

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
    
    // Check if user wants to include user progress
    const includeProgress = searchParams.get('include_progress') === 'true'
    
    // Get the module with all related data
    const { data: module, error } = await supabase
      .from('learning_modules')
      .select(`
        *,
        category:categories(id, name, color, description),
        parent_module:learning_modules!parent_module_id(id, title, slug),
        child_modules:learning_modules!parent_module_id(
          id, title, slug, description, difficulty_level, 
          estimated_duration_minutes, sort_order, status
        ),
        images:module_images(
          id, usage_type, sort_order, caption, alt_text, content_section,
          image:images(id, url, alt_text, description)
        ),
        prerequisites:module_prerequisites!module_id(
          id, requirement_type, minimum_score,
          prerequisite_module:learning_modules!prerequisite_module_id(
            id, title, slug, difficulty_level
          )
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Learning module not found' },
          { status: 404 }
        )
      }
      console.error('Error fetching learning module:', error)
      return NextResponse.json(
        { error: 'Failed to fetch learning module' },
        { status: 500 }
      )
    }

    // If user is authenticated and wants progress, fetch user-specific data
    let userProgress = null
    if (includeProgress) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Get user's sessions for this module
        const { data: sessions } = await supabase
          .from('module_sessions')
          .select('*')
          .eq('module_id', id)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        // Get user's attempts for this module
        const { data: attempts } = await supabase
          .from('module_attempts')
          .select('*')
          .eq('module_id', id)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (sessions || attempts) {
          userProgress = {
            sessions: sessions || [],
            attempts: attempts || [],
            latest_attempt: attempts?.[0] || null,
            is_completed: attempts?.some(a => a.completion_status === 'completed') || false,
            best_score: attempts?.reduce((max, a) => 
              Math.max(max, a.assessment_score || 0), 0) || null,
            total_time_spent: sessions?.reduce((total, s) => 
              total + (s.duration_minutes || 0), 0) || 0
          }
        }
      }
    }

    // Sort child modules by sort_order
    if (module.child_modules) {
      module.child_modules.sort((a: any, b: any) => a.sort_order - b.sort_order)
    }

    // Sort images by sort_order
    if (module.images) {
      module.images.sort((a: any, b: any) => a.sort_order - b.sort_order)
    }

    const response = {
      data: {
        ...module,
        user_progress: userProgress
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Unexpected error in learning module API:', error)
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

    // Check if user has permission to edit this module
    const { data: module } = await supabase
      .from('learning_modules')
      .select('created_by')
      .eq('id', id)
      .single()

    if (!module) {
      return NextResponse.json(
        { error: 'Learning module not found' },
        { status: 404 }
      )
    }

    // Check if user is admin, content creator, or the creator of this module
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    const canEdit = profile && (
      ['admin', 'creator'].includes(profile.role) ||
      module.created_by === user.id
    )

    if (!canEdit) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    
    // Update the module
    const { data: updatedModule, error } = await supabase
      .from('learning_modules')
      .update({
        ...body,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        category:categories(id, name, color)
      `)
      .single()

    if (error) {
      console.error('Error updating learning module:', error)
      return NextResponse.json(
        { error: 'Failed to update learning module' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: updatedModule })

  } catch (error) {
    console.error('Unexpected error updating learning module:', error)
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

    // Check if module has child modules
    const { data: childModules } = await supabase
      .from('learning_modules')
      .select('id')
      .eq('parent_module_id', id)

    if (childModules && childModules.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete module with child modules' },
        { status: 400 }
      )
    }

    // Delete the module (cascade will handle related records)
    const { error } = await supabase
      .from('learning_modules')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting learning module:', error)
      return NextResponse.json(
        { error: 'Failed to delete learning module' },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: 'Learning module deleted successfully' })

  } catch (error) {
    console.error('Unexpected error deleting learning module:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
