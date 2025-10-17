// src/app/api/dashboard/activities/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'

// Simple activity types - keeping it focused
const ACTIVITY_TYPES = {
  quiz_completed: 'Quiz Completed',
  quiz_started: 'Quiz Started',
  subject_mastered: 'Subject Mastered',
  study_streak: 'Study Streak',
  performance_milestone: 'Performance Milestone',
  badge_earned: 'Badge Earned',
  weak_area_improved: 'Weak Area Improved'
} as const

// Simple time grouping
function getGroupKey(date: Date): string {
  const now = new Date()
  const activityDate = new Date(date)
  const diffDays = Math.floor((now.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays <= 7) return 'this_week'
  if (diffDays <= 14) return 'last_week'
  return 'earlier'
}

function getGroupTitle(groupKey: string): string {
  const titles: Record<string, string> = {
    today: 'Today',
    yesterday: 'Yesterday',
    this_week: 'This Week',
    last_week: 'Last Week',
    earlier: 'Earlier'
  }
  return titles[groupKey] || groupKey
}

// GET /api/dashboard/activities
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')

    // Build query - simple, no filtering
    const { data: activities, error } = await supabase
      .from('user_activities')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching activities:', error)
      return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 })
    }

    // Group activities by time
    const grouped = new Map()
    
    activities?.forEach(activity => {
      const groupKey = getGroupKey(new Date(activity.created_at))
      
      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, {
          key: groupKey,
          title: getGroupTitle(groupKey),
          activities: [],
          count: 0
        })
      }
      
      grouped.get(groupKey).activities.push(activity)
      grouped.get(groupKey).count++
    })

    // Sort groups by priority
    const sortedGroups = Array.from(grouped.values()).sort((a, b) => {
      const priority = ['today', 'yesterday', 'this_week', 'last_week', 'earlier']
      return priority.indexOf(a.key) - priority.indexOf(b.key)
    })

    // Simple stats
    const stats = {
      total: activities?.length || 0,
      unread: activities?.filter(a => !a.is_read).length || 0,
      byType: activities?.reduce((acc, activity) => {
        acc[activity.type] = (acc[activity.type] || 0) + 1
        return acc
      }, {} as Record<string, number>) || {}
    }

    return NextResponse.json({
      success: true,
      data: {
        groups: sortedGroups,
        stats
      }
    })

  } catch (error) {
    console.error('Error in activities API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/dashboard/activities - Create new activity
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type, title, description, quiz_id, subject_id, data = {}, priority = 'medium' } = body

    // Validate required fields
    if (!type || !title) {
      return NextResponse.json({ error: 'Type and title are required' }, { status: 400 })
    }

    // Validate activity type
    if (!Object.keys(ACTIVITY_TYPES).includes(type)) {
      return NextResponse.json({ error: 'Invalid activity type' }, { status: 400 })
    }

    const now = new Date()
    const groupKey = getGroupKey(now)

    const { data: activity, error } = await supabase
      .from('user_activities')
      .insert({
        user_id: user.id,
        type,
        title,
        description,
        quiz_id,
        subject_id,
        data,
        priority,
        group_key: groupKey,
        is_read: false
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating activity:', error)
      return NextResponse.json({ error: 'Failed to create activity' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: activity
    })

  } catch (error) {
    console.error('Error in activities POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
