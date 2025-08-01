// src/app/api/user/dashboard/goals/batch/progress/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { ActivityGenerator } from '@/shared/services/activity-generator'

// POST /api/user/dashboard/goals/batch/progress - Batch update goals from quiz completion
export async function POST(request: NextRequest) {
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
      let shouldUpdate = false
      
      switch (goal.category) {
        case 'questions':
          increment = questionsAnswered
          shouldUpdate = questionsAnswered > 0
          break
        case 'quizzes':
          increment = quizzesCompleted
          shouldUpdate = quizzesCompleted > 0
          break
        case 'study_time':
          increment = studyTimeMinutes
          shouldUpdate = studyTimeMinutes > 0
          break
        case 'accuracy':
          if (accuracy !== null) {
            // For accuracy, we set the value rather than increment
            const { data: updated, error: updateError } = await supabase
              .from('user_goals')
              .update({ 
                current_value: accuracy,
                updated_at: now.toISOString()
              })
              .eq('id', goal.id)
              .select()
              .single()
            
            if (!updateError && updated) {
              updatedGoals.push(updated)
            }
          }
          continue
        default:
          continue
      }

      if (shouldUpdate && increment > 0) {
        const newValue = Math.min(goal.current_value + increment, goal.target_value)
        const isCompleted = newValue >= goal.target_value && !goal.is_completed

        const updateData: any = {
          current_value: newValue,
          updated_at: now.toISOString()
        }

        if (isCompleted) {
          updateData.is_completed = true
          updateData.completed_at = now.toISOString()
          completedGoals.push(goal)
        }

        const { data: updated, error: updateError } = await supabase
          .from('user_goals')
          .update(updateData)
          .eq('id', goal.id)
          .select()
          .single()

        if (!updateError && updated) {
          updatedGoals.push(updated)
        }
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
        updatedGoals: updatedGoals.length,
        completedGoals: completedGoals.length,
        message: `Updated ${updatedGoals.length} goals, completed ${completedGoals.length} goals`
      }
    })

  } catch (error) {
    console.error('Error in batch goal progress API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
