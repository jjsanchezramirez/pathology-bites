// src/app/api/user/dashboard/goals/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'

// Simple goal categories - keeping it focused
const GOAL_CATEGORIES = {
  questions: 'Questions',
  study_time: 'Study Time', 
  quizzes: 'Quizzes',
  accuracy: 'Accuracy',
  streak: 'Study Streak'
} as const

// GET /api/user/dashboard/goals
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'all' // daily, weekly, all
    const active = searchParams.get('active') !== 'false' // default to active only

    // Build query
    let query = supabase
      .from('user_goals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (type !== 'all') {
      query = query.eq('type', type)
    }

    if (active) {
      query = query.eq('is_active', true)
    }

    const { data: goals, error } = await query

    if (error) {
      console.error('Error fetching goals:', error)
      return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 })
    }

    // Group goals by type
    const dailyGoals = goals?.filter(g => g.type === 'daily') || []
    const weeklyGoals = goals?.filter(g => g.type === 'weekly') || []

    // Calculate progress and time remaining
    const now = new Date()
    const processedGoals = goals?.map(goal => {
      const progress = goal.target_value > 0 ? (goal.current_value / goal.target_value) * 100 : 0
      const timeRemaining = new Date(goal.ends_at).getTime() - now.getTime()
      const hoursRemaining = Math.max(0, Math.floor(timeRemaining / (1000 * 60 * 60)))
      
      return {
        ...goal,
        progress: Math.min(100, progress),
        hoursRemaining,
        isExpired: timeRemaining <= 0,
        canComplete: progress >= 100 && !goal.is_completed
      }
    }) || []

    return NextResponse.json({
      success: true,
      data: {
        goals: processedGoals,
        daily: dailyGoals.map(g => processedGoals.find(pg => pg.id === g.id)).filter(Boolean),
        weekly: weeklyGoals.map(g => processedGoals.find(pg => pg.id === g.id)).filter(Boolean),
        stats: {
          total: goals?.length || 0,
          completed: goals?.filter(g => g.is_completed).length || 0,
          active: goals?.filter(g => g.is_active && !g.is_completed).length || 0,
          expired: processedGoals.filter(g => g.isExpired && !g.is_completed).length
        }
      }
    })

  } catch (error) {
    console.error('Error in goals API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/user/dashboard/goals - Create new goal
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type, category, title, description, target_value, unit } = body

    // Validate required fields
    if (!type || !category || !title || !target_value || !unit) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate goal type and category
    if (!['daily', 'weekly'].includes(type)) {
      return NextResponse.json({ error: 'Invalid goal type' }, { status: 400 })
    }

    if (!Object.keys(GOAL_CATEGORIES).includes(category)) {
      return NextResponse.json({ error: 'Invalid goal category' }, { status: 400 })
    }

    // Calculate start and end dates
    const now = new Date()
    let starts_at, ends_at

    if (type === 'daily') {
      starts_at = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      ends_at = new Date(starts_at)
      ends_at.setDate(ends_at.getDate() + 1)
    } else { // weekly
      const dayOfWeek = now.getDay()
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
      starts_at = new Date(now)
      starts_at.setDate(now.getDate() - daysToMonday)
      starts_at.setHours(0, 0, 0, 0)
      ends_at = new Date(starts_at)
      ends_at.setDate(starts_at.getDate() + 7)
    }

    const { data: goal, error } = await supabase
      .from('user_goals')
      .insert({
        user_id: user.id,
        type,
        category,
        title,
        description,
        target_value: parseInt(target_value),
        unit,
        starts_at: starts_at.toISOString(),
        ends_at: ends_at.toISOString(),
        current_value: 0,
        is_completed: false,
        is_active: true
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating goal:', error)
      return NextResponse.json({ error: 'Failed to create goal' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: goal
    })

  } catch (error) {
    console.error('Error in goals POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
