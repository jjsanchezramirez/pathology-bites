// src/app/api/user/dashboard/goals/[id]/progress/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'

// Type definitions for goal progress API
interface GoalUpdateData {
  current_value: number
  updated_at: string
  is_completed?: boolean
  completed_at?: string
}
import { ActivityGenerator } from '@/shared/services/activity-generator'

// PUT /api/user/dashboard/goals/[id]/progress - Update goal progress
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { increment = 1, setValue } = body

    // Get the current goal
    const { data: goal, error: fetchError } = await supabase
      .from('user_goals')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !goal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    }

    // Check if goal is still active and not expired
    const now = new Date()
    const endDate = new Date(goal.ends_at)
    
    if (!goal.is_active || now > endDate) {
      return NextResponse.json({ error: 'Goal is not active or has expired' }, { status: 400 })
    }

    // Calculate new value
    let newValue
    if (setValue !== undefined) {
      newValue = parseInt(setValue)
    } else {
      newValue = goal.current_value + increment
    }

    // Ensure value doesn't go below 0 or above target (unless it's accuracy)
    newValue = Math.max(0, newValue)
    if (goal.category !== 'accuracy') {
      newValue = Math.min(newValue, goal.target_value)
    }

    // Check if goal is now completed
    const isCompleted = newValue >= goal.target_value && !goal.is_completed

    // Update the goal
    const updateData: GoalUpdateData = {
      current_value: newValue,
      updated_at: now.toISOString()
    }

    if (isCompleted) {
      updateData.is_completed = true
      updateData.completed_at = now.toISOString()
    }

    const { data: updatedGoal, error: updateError } = await supabase
      .from('user_goals')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating goal:', updateError)
      return NextResponse.json({ error: 'Failed to update goal' }, { status: 500 })
    }

    // If goal was completed, create an activity
    if (isCompleted) {
      const activityData = ActivityGenerator.createGoalAchievedActivity({
        id: goal.id,
        title: goal.title,
        type: goal.type,
        category: goal.category,
        targetValue: goal.target_value
      })
      
      await ActivityGenerator.createActivity(user.id, activityData)
    }

    // Calculate progress
    const progress = goal.target_value > 0 ? (newValue / goal.target_value) * 100 : 0

    return NextResponse.json({
      success: true,
      data: {
        ...updatedGoal,
        progress: Math.min(100, progress),
        wasCompleted: isCompleted
      }
    })

  } catch (error) {
    console.error('Error in goal progress API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/user/dashboard/goals/[id]/progress - Batch update (for quiz completions)
export async function POST(
  request: NextRequest
) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      questionsAnswered = 0, 
      quizzesCompleted = 0, 
      studyTimeMinutes = 0, 
      accuracy = null 
    } = body

    // Get all active goals for this user
    const { data: goals, error: fetchError } = await supabase
      .from('user_goals')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .eq('is_completed', false)

    if (fetchError) {
      console.error('Error fetching goals:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 })
    }

    const now = new Date()
    const updatedGoals = []
    const completedGoals = []

    // Update relevant goals
    for (const goal of goals || []) {
      const endDate = new Date(goal.ends_at)
      if (now > endDate) continue // Skip expired goals

      let increment = 0
      
      switch (goal.category) {
        case 'questions':
          increment = questionsAnswered
          break
        case 'quizzes':
          increment = quizzesCompleted
          break
        case 'study_time':
          increment = studyTimeMinutes
          break
        case 'accuracy':
          if (accuracy !== null) {
            // For accuracy, we set the value rather than increment
            const { data: updated } = await supabase
              .from('user_goals')
              .update({ 
                current_value: accuracy,
                updated_at: now.toISOString()
              })
              .eq('id', goal.id)
              .select()
              .single()
            
            if (updated) updatedGoals.push(updated)
          }
          continue
        default:
          continue
      }

      if (increment > 0) {
        const newValue = Math.min(goal.current_value + increment, goal.target_value)
        const isCompleted = newValue >= goal.target_value

        const updateData: any = {
          current_value: newValue,
          updated_at: now.toISOString()
        }

        if (isCompleted && !goal.is_completed) {
          updateData.is_completed = true
          updateData.completed_at = now.toISOString()
          completedGoals.push(goal)
        }

        const { data: updated } = await supabase
          .from('user_goals')
          .update(updateData)
          .eq('id', goal.id)
          .select()
          .single()

        if (updated) updatedGoals.push(updated)
      }
    }

    // Create activities for completed goals
    for (const goal of completedGoals) {
      const activityData = ActivityGenerator.createGoalAchievedActivity({
        id: goal.id,
        title: goal.title,
        type: goal.type,
        category: goal.category,
        targetValue: goal.target_value
      })
      
      await ActivityGenerator.createActivity(user.id, activityData)
    }

    return NextResponse.json({
      success: true,
      data: {
        updatedGoals,
        completedGoals: completedGoals.length,
        message: `Updated ${updatedGoals.length} goals, completed ${completedGoals.length} goals`
      }
    })

  } catch (error) {
    console.error('Error in batch goal progress API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
