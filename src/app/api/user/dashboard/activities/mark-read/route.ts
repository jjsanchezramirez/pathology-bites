// src/app/api/dashboard/activities/mark-read/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'

// PUT /api/dashboard/activities/mark-read
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { activityIds } = body

    if (!activityIds || !Array.isArray(activityIds)) {
      return NextResponse.json({ error: 'Activity IDs array is required' }, { status: 400 })
    }

    // Mark activities as read (only for the authenticated user)
    const { error } = await supabase
      .from('user_activities')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .in('id', activityIds)

    if (error) {
      console.error('Error marking activities as read:', error)
      return NextResponse.json({ error: 'Failed to mark activities as read' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Marked ${activityIds.length} activities as read`
    })

  } catch (error) {
    console.error('Error in mark-read API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/dashboard/activities/mark-read?all=true - Mark all as read
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Mark all unread activities as read for this user
    const { error } = await supabase
      .from('user_activities')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)

    if (error) {
      console.error('Error marking all activities as read:', error)
      return NextResponse.json({ error: 'Failed to mark all activities as read' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Marked all activities as read'
    })

  } catch (error) {
    console.error('Error in mark-all-read API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
