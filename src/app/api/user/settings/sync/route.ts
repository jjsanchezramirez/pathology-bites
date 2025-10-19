// src/app/api/user/settings/sync/route.ts
// Batch sync endpoint for settings (used by sendBeacon on page unload)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import {
  DEFAULT_QUIZ_SETTINGS,
  DEFAULT_NOTIFICATION_SETTINGS,
  DEFAULT_UI_SETTINGS,
} from '@/shared/constants/user-settings-defaults'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Auth is handled by middleware
    const userId = request.headers.get('x-user-id')
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body - can contain multiple sections
    const body = await request.json()
    const { ui_settings, quiz_settings, notification_settings } = body

    // Get current settings first
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

    // Prepare the update object - merge all sections
    const updateData: any = {
      user_id: userId,
      updated_at: new Date().toISOString()
    }

    // Merge each section if provided
    if (ui_settings) {
      updateData.ui_settings = currentData?.ui_settings 
        ? { ...currentData.ui_settings, ...ui_settings }
        : ui_settings
    }

    if (quiz_settings) {
      updateData.quiz_settings = currentData?.quiz_settings
        ? { ...currentData.quiz_settings, ...quiz_settings }
        : quiz_settings
    }

    if (notification_settings) {
      updateData.notification_settings = currentData?.notification_settings
        ? { ...currentData.notification_settings, ...notification_settings }
        : notification_settings
    }

    // If no current data exists, provide defaults for missing sections
    if (!currentData) {
      if (!updateData.quiz_settings) {
        updateData.quiz_settings = DEFAULT_QUIZ_SETTINGS
      }
      if (!updateData.notification_settings) {
        updateData.notification_settings = DEFAULT_NOTIFICATION_SETTINGS
      }
      if (!updateData.ui_settings) {
        updateData.ui_settings = DEFAULT_UI_SETTINGS
      }
    }

    // Update settings using upsert
    const { error } = await supabase
      .from('user_settings')
      .upsert(updateData)

    if (error) {
      console.error('[UserSettings SYNC] Database error:', error)
      return NextResponse.json(
        { error: 'Failed to sync settings', details: error.message },
        { status: 500 }
      )
    }

    console.log('[UserSettings SYNC] Settings synced successfully for user:', userId)
    return NextResponse.json({
      success: true,
      message: 'Settings synced successfully'
    })
  } catch (error) {
    console.error('[SettingsSync] Sync error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

