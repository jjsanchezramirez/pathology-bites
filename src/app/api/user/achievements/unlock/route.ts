// src/app/api/user/achievements/unlock/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { getUserIdFromHeaders } from '@/shared/utils/auth-helpers'

interface UnlockAchievementRequest {
  achievementId: string
  title: string
  description: string
  category: string
  quizId?: string
  subjectId?: string
  metadata?: Record<string, any>
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const userId = getUserIdFromHeaders(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: UnlockAchievementRequest = await request.json()

    // Validate required fields
    if (!body.achievementId || !body.title || !body.description || !body.category) {
      return NextResponse.json(
        { error: 'Missing required fields: achievementId, title, description, category' },
        { status: 400 }
      )
    }

    // Check if achievement already exists for this user
    const { data: existing } = await supabase
      .from('user_achievements')
      .select('id')
      .eq('user_id', userId)
      .eq('group_key', body.achievementId)
      .single()

    if (existing) {
      return NextResponse.json({
        success: false,
        message: 'Achievement already unlocked'
      })
    }

    // Insert new achievement
    const { data: achievement, error: insertError } = await supabase
      .from('user_achievements')
      .insert({
        user_id: userId,
        type: 'achievement',
        title: body.title,
        description: body.description,
        group_key: body.achievementId,
        quiz_id: body.quizId || null,
        subject_id: body.subjectId || null,
        data: body.metadata || {},
        is_read: false,
        priority: 'normal'
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error unlocking achievement:', insertError)
      return NextResponse.json({ error: 'Failed to unlock achievement' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      achievement,
      message: 'Achievement unlocked!'
    })
  } catch (error) {
    console.error('Unexpected error in unlock achievement API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
