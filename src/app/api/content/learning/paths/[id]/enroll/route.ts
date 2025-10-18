// src/app/api/content/learning/modules-paths/[id]/enroll/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id: pathId } = await params
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if learning path exists and is published
    const { data: path, error: pathError } = await supabase
      .from('learning_paths')
      .select(`
        id, title, status, enrollment_count,
        modules:learning_path_modules(count)
      `)
      .eq('id', pathId)
      .eq('status', 'published')
      .single()

    if (pathError || !path) {
      return NextResponse.json(
        { error: 'Learning path not found or not available' },
        { status: 404 }
      )
    }

    // Check if user is already enrolled
    const { data: existingEnrollment } = await supabase
      .from('user_learning_path_enrollments')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('learning_path_id', parseInt(pathId))
      .single()

    if (existingEnrollment) {
      if (existingEnrollment.status === 'active') {
        return NextResponse.json(
          { error: 'Already enrolled in this learning path' },
          { status: 400 }
        )
      } else if (existingEnrollment.status === 'completed') {
        return NextResponse.json(
          { error: 'Learning path already completed' },
          { status: 400 }
        )
      } else {
        // Reactivate paused or dropped enrollment
        const { data: enrollment, error } = await supabase
          .from('user_learning_path_enrollments')
          .update({
            status: 'active',
            enrolled_at: new Date().toISOString()
          })
          .eq('id', existingEnrollment.id)
          .select()
          .single()

        if (error) {
          console.error('Error reactivating enrollment:', error)
          return NextResponse.json(
            { error: 'Failed to reactivate enrollment' },
            { status: 500 }
          )
        }

        return NextResponse.json({ data: enrollment })
      }
    }

    // Create new enrollment
    const totalModules = path.modules?.[0]?.count || 0
    
    const { data: enrollment, error } = await supabase
      .from('user_learning_path_enrollments')
      .insert({
        user_id: user.id,
        learning_path_id: parseInt(pathId),
        status: 'active',
        total_modules: totalModules,
        modules_completed: 0,
        progress_percentage: 0,
        total_time_minutes: 0
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating enrollment:', error)
      return NextResponse.json(
        { error: 'Failed to enroll in learning path' },
        { status: 500 }
      )
    }

    // Update enrollment count on the learning path
    await supabase
      .from('learning_paths')
      .update({
        enrollment_count: path.enrollment_count + 1
      })
      .eq('id', pathId)

    return NextResponse.json({ data: enrollment }, { status: 201 })

  } catch (error) {
    console.error('Unexpected error in enrollment API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id: pathId } = await params
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get user's enrollment for this learning path
    const { data: enrollment, error } = await supabase
      .from('user_learning_path_enrollments')
      .select(`
        *,
        learning_path:learning_paths(
          id, title, description, difficulty_level,
          estimated_total_duration_minutes
        )
      `)
      .eq('user_id', user.id)
      .eq('learning_path_id', parseInt(pathId))
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Not enrolled in this learning path' },
          { status: 404 }
        )
      }
      console.error('Error fetching enrollment:', error)
      return NextResponse.json(
        { error: 'Failed to fetch enrollment' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: enrollment })

  } catch (error) {
    console.error('Unexpected error fetching enrollment:', error)
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
    const { id: pathId } = await params
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { status, current_module_id } = body

    // Validate status
    const validStatuses = ['active', 'completed', 'paused', 'dropped']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      )
    }

    // Get current enrollment
    const { data: currentEnrollment } = await supabase
      .from('user_learning_path_enrollments')
      .select('*')
      .eq('user_id', user.id)
      .eq('learning_path_id', parseInt(pathId))
      .single()

    if (!currentEnrollment) {
      return NextResponse.json(
        { error: 'Not enrolled in this learning path' },
        { status: 404 }
      )
    }

    // Prepare update data
    const updateData: any = {
      last_accessed_at: new Date().toISOString()
    }

    if (status) {
      updateData.status = status
      
      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString()
        updateData.progress_percentage = 100
      } else if (status === 'active' && currentEnrollment.started_at === null) {
        updateData.started_at = new Date().toISOString()
      }
    }

    if (current_module_id) {
      updateData.current_module_id = current_module_id
    }

    // Update enrollment
    const { data: enrollment, error } = await supabase
      .from('user_learning_path_enrollments')
      .update(updateData)
      .eq('user_id', user.id)
      .eq('learning_path_id', parseInt(pathId))
      .select()
      .single()

    if (error) {
      console.error('Error updating enrollment:', error)
      return NextResponse.json(
        { error: 'Failed to update enrollment' },
        { status: 500 }
      )
    }

    // If completing the path, increment completion count
    if (status === 'completed' && currentEnrollment.status !== 'completed') {
      // Get current completion count and increment it
      const { data: pathData } = await supabase
        .from('learning_paths')
        .select('completion_count')
        .eq('id', pathId)
        .single()

      const currentCount = pathData?.completion_count || 0
      await supabase
        .from('learning_paths')
        .update({ completion_count: currentCount + 1 })
        .eq('id', pathId)
    }

    return NextResponse.json({ data: enrollment })

  } catch (error) {
    console.error('Unexpected error updating enrollment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
