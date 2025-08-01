// src/app/api/debug/generate-activities/route.ts
// Debug endpoint to generate sample activities for testing
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { ActivityGenerator } from '@/shared/services/activity-generator'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Generating sample activities for user:', user.id)

    // Generate some sample activities
    const activities = [
      ActivityGenerator.createQuizCompletedActivity({
        id: 'sample-quiz-1',
        title: 'Cardiovascular Pathology Quiz',
        score: 85,
        totalQuestions: 15,
        timeSpent: 720 // 12 minutes in seconds
      }),
      ActivityGenerator.createQuizCompletedActivity({
        id: 'sample-quiz-2', 
        title: 'Respiratory Pathology Quiz',
        score: 92,
        totalQuestions: 10,
        timeSpent: 480 // 8 minutes in seconds
      }),
      ActivityGenerator.createQuizStartedActivity({
        id: 'sample-quiz-3',
        title: 'Gastrointestinal Pathology Quiz',
        totalQuestions: 20
      }),
      ActivityGenerator.createStudyStreakActivity({
        days: 5,
        isNewRecord: false
      }),
      ActivityGenerator.createPerformanceMilestoneActivity({
        milestone: '90% Accuracy',
        description: 'Achieved 90% accuracy milestone',
        newValue: 90,
        previousValue: 85
      })
    ]

    // Create all activities
    const results = []
    for (const activityData of activities) {
      try {
        const success = await ActivityGenerator.createActivity(user.id, activityData)
        results.push({ activity: activityData.title, success })
      } catch (error) {
        console.error('Failed to create activity:', activityData.title, error)
        results.push({
          activity: activityData.title,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Generated ${results.filter(r => r.success).length} activities`,
      results
    })

  } catch (error) {
    console.error('Error generating activities:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
