// src/app/api/user/settings/route.ts
// API routes for managing user settings

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import {
  DEFAULT_QUIZ_SETTINGS,
  DEFAULT_NOTIFICATION_SETTINGS,
  DEFAULT_UI_SETTINGS,
} from '@/shared/constants/user-settings-defaults'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Auth is handled by middleware
    const userId = request.headers.get('x-user-id')
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user settings using correct schema with separate columns
    const { data, error } = await supabase
      .from('user_settings')
      .select('quiz_settings, notification_settings, ui_settings, created_at, updated_at')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch user settings' },
        { status: 500 }
      )
    }

    // If no settings exist for user, create default settings
    if (!data) {
        const defaultSettings = {
          quiz_settings: DEFAULT_QUIZ_SETTINGS,
          notification_settings: DEFAULT_NOTIFICATION_SETTINGS,
          ui_settings: DEFAULT_UI_SETTINGS,
        }

        // Try to create default settings for the user
        const { data: newData, error: createError } = await supabase
          .from('user_settings')
          .insert({
            user_id: userId,
            quiz_settings: defaultSettings.quiz_settings,
            notification_settings: defaultSettings.notification_settings,
            ui_settings: defaultSettings.ui_settings
          })
          .select('quiz_settings, notification_settings, ui_settings, created_at, updated_at')
          .single()

        if (createError) {
          // Return defaults even if creation fails
          return NextResponse.json({
            success: true,
            data: defaultSettings
          })
        }

        // Return the newly created settings
        return NextResponse.json({
          success: true,
          data: {
            quiz_settings: newData.quiz_settings,
            notification_settings: newData.notification_settings,
            ui_settings: newData.ui_settings,
            created_at: newData.created_at,
            updated_at: newData.updated_at
          }
        })
    }

    // Combine the separate columns into the expected format
    const combinedSettings = {
      quiz_settings: data.quiz_settings || DEFAULT_QUIZ_SETTINGS,
      notification_settings: data.notification_settings || DEFAULT_NOTIFICATION_SETTINGS,
      ui_settings: data.ui_settings || DEFAULT_UI_SETTINGS,
      created_at: data.created_at,
      updated_at: data.updated_at
    }

    console.log('[UserSettings API] Returning settings for user:', userId, 'text_zoom:', combinedSettings.ui_settings.text_zoom)

    return NextResponse.json({
      success: true,
      data: combinedSettings
    })
  } catch (error) {
    console.error('[UserSettings GET] Unexpected error:', error instanceof Error ? error.message : String(error))
    console.error('[UserSettings GET] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Auth is handled by middleware
    const userId = request.headers.get('x-user-id')

    console.log('[UserSettings PATCH] userId:', userId)

    if (!userId) {
      console.error('[UserSettings PATCH] No userId in headers')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { section, settings } = body

    console.log('[UserSettings PATCH] Request:', { section, settings })

    // Validate section
    const validSections = ['quiz_settings', 'notification_settings', 'ui_settings']
    if (!section || !validSections.includes(section)) {
      console.error('[UserSettings PATCH] Invalid section:', section)
      return NextResponse.json(
        { error: 'Invalid section. Must be one of: ' + validSections.join(', ') },
        { status: 400 }
      )
    }

    // Validate settings
    if (!settings || typeof settings !== 'object') {
      console.error('[UserSettings PATCH] Invalid settings:', settings)
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
        default_question_type: (val: any) => typeof val === 'string' && ['all', 'unused', 'needsReview', 'marked', 'mastered', 'incorrect', 'correct'].includes(val),
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

    // Get current settings first using correct schema
    const { data: currentData, error: getCurrentError } = await supabase
      .from('user_settings')
      .select('quiz_settings, notification_settings, ui_settings')
      .eq('user_id', userId)
      .maybeSingle()

    if (getCurrentError) {
      return NextResponse.json(
        { error: 'Failed to fetch current settings' },
        { status: 500 }
      )
    }

    // Prepare the update object based on the section
    const updateData: any = {
      user_id: userId,
      updated_at: new Date().toISOString()
    }

    // Merge the new settings with existing settings for the section
    // This is critical to avoid wiping out other fields in the JSONB object
    if (currentData && currentData[section]) {
      // Merge new settings with existing settings
      updateData[section] = {
        ...currentData[section],
        ...settings
      }
    } else {
      // No existing data for this section, use the new settings
      updateData[section] = settings
    }

    // If no current data exists, we need to provide defaults for other sections
    if (!currentData) {
      if (section !== 'quiz_settings') {
        updateData.quiz_settings = DEFAULT_QUIZ_SETTINGS
      }
      if (section !== 'notification_settings') {
        updateData.notification_settings = DEFAULT_NOTIFICATION_SETTINGS
      }
      if (section !== 'ui_settings') {
        updateData.ui_settings = DEFAULT_UI_SETTINGS
      }
    }

    // Update settings using upsert with correct schema
    console.log('[UserSettings PATCH] Upserting data:', JSON.stringify(updateData, null, 2))

    const { data, error } = await supabase
      .from('user_settings')
      .upsert(updateData, {
        onConflict: 'user_id',  // Use user_id for conflict resolution
        ignoreDuplicates: false  // Update on conflict instead of ignoring
      })
      .select('quiz_settings, notification_settings, ui_settings, created_at, updated_at')
      .maybeSingle()

    if (error) {
      console.error('[UserSettings PATCH] Database error:', error)
      return NextResponse.json(
        { error: 'Failed to update user settings', details: error.message },
        { status: 500 }
      )
    }

    // Check if upsert returned no data (RLS policy might have blocked it)
    if (!data) {
      console.warn('[UserSettings PATCH] Upsert returned no data - RLS policy may have blocked the operation')
      return NextResponse.json(
        { error: 'Failed to update user settings', details: 'No data returned from database' },
        { status: 500 }
      )
    }

    console.log('[UserSettings PATCH] Update successful')

    // Return the combined settings in the expected format
    const combinedSettings = {
      quiz_settings: data.quiz_settings || {},
      notification_settings: data.notification_settings || {},
      ui_settings: data.ui_settings || {},
      created_at: data.created_at,
      updated_at: data.updated_at
    }

    return NextResponse.json({
      success: true,
      data: combinedSettings
    })
  } catch (error) {
    console.error('[UserSettings PATCH] Unexpected error:', error instanceof Error ? error.message : String(error))
    console.error('[UserSettings PATCH] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
