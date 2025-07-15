// src/app/api/user/settings/route.ts
// API routes for managing user settings

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user settings using the helper function
    const { data, error } = await supabase
      .rpc('get_user_settings', { p_user_id: user.id })

    if (error) {
      console.error('Error fetching user settings:', error)
      return NextResponse.json(
        { error: 'Failed to fetch user settings' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error) {
    console.error('Error in GET /api/user/settings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { section, settings } = body

    // Validate section
    const validSections = ['quiz_settings', 'notification_settings', 'ui_settings']
    if (!section || !validSections.includes(section)) {
      return NextResponse.json(
        { error: 'Invalid section. Must be one of: ' + validSections.join(', ') },
        { status: 400 }
      )
    }

    // Validate settings
    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { error: 'Settings must be a valid object' },
        { status: 400 }
      )
    }

    // Validate quiz settings if that's what we're updating
    if (section === 'quiz_settings') {
      const validQuizSettings = {
        default_question_count: (val: any) => typeof val === 'number' && [5, 10, 25, 50].includes(val),
        default_mode: (val: any) => typeof val === 'string' && ['tutor', 'practice'].includes(val),
        default_timing: (val: any) => typeof val === 'string' && ['timed', 'untimed'].includes(val),
        default_question_type: (val: any) => typeof val === 'string' && ['all', 'unused', 'incorrect', 'marked', 'correct'].includes(val),
        default_category_selection: (val: any) => typeof val === 'string' && ['all', 'ap_only', 'cp_only', 'custom'].includes(val)
      }

      for (const [key, value] of Object.entries(settings)) {
        if (validQuizSettings[key as keyof typeof validQuizSettings]) {
          if (!validQuizSettings[key as keyof typeof validQuizSettings](value)) {
            return NextResponse.json(
              { error: `Invalid value for ${key}: ${value}` },
              { status: 400 }
            )
          }
        }
      }
    }

    // Update settings using the helper function
    const { data, error } = await supabase
      .rpc('update_user_settings_section', {
        p_user_id: user.id,
        p_section: section,
        p_settings: settings
      })

    if (error) {
      console.error('Error updating user settings:', error)
      return NextResponse.json(
        { error: 'Failed to update user settings' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data
    })
  } catch (error) {
    console.error('Error in PATCH /api/user/settings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
