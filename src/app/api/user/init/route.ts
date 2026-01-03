// src/app/api/user/init/route.ts
// Combined endpoint for initial user data + settings
// Reduces 2 API calls to 1

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import {
  DEFAULT_QUIZ_SETTINGS,
  DEFAULT_NOTIFICATION_SETTINGS,
  DEFAULT_UI_SETTINGS
} from '@/shared/constants/user-settings-defaults'

export const dynamic = 'force-dynamic'

interface UserInitData {
  userData: unknown
  settings: unknown
}

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = user.id

    // Fetch both user data and settings in parallel
    const [userDataResult, settingsResult, userProfileResult] = await Promise.all([
      // User performance data
      supabase.rpc('get_user_performance_data', { user_id_param: userId }),

      // User settings
      supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle(),

      // User profile (to check if user exists)
      supabase
        .from('users')
        .select('id, role, status')
        .eq('id', userId)
        .maybeSingle()
    ])

    // FALLBACK: If user doesn't exist in database (race condition from OAuth callback)
    if (userProfileResult.error?.code === 'PGRST116' || !userProfileResult.data) {
      console.warn('[UserInit API] User not found in database, creating fallback user:', userId)

      // Create user record
      const { error: createUserError } = await supabase
        .from('users')
        .insert({
          id: userId,
          email: user.email || '',
          first_name: user.user_metadata?.first_name || '',
          last_name: user.user_metadata?.last_name || '',
          user_type: user.user_metadata?.user_type || 'other',
          role: 'user',
          status: 'active'
        })

      if (createUserError) {
        console.error('[UserInit API] Failed to create fallback user:', createUserError)
        // Continue anyway - user might have been created by another concurrent request
      } else {
        console.log('[UserInit API] Fallback user created successfully')
      }
    }

    // Handle user data errors (except "user not found" which is handled above)
    if (userDataResult.error) {
      // Check if error is due to missing function (database not fully set up)
      if (userDataResult.error.code === 'PGRST202') {
        console.warn('[UserInit API] Database function get_user_performance_data not found - using empty performance data')
      } else {
        console.error('[UserInit API] Error fetching user data:', userDataResult.error)
      }
      // Return empty data instead of failing - allows user to continue
      // They might be a new user without any quiz history yet
    }

    // Handle settings (create default if doesn't exist)
    let settings = settingsResult.data
    if (!settings) {
      console.warn('[UserInit API] User settings not found, creating defaults for:', userId)

      // Create default settings using constants
      const { data: newSettings, error: createError } = await supabase
        .from('user_settings')
        .insert({
          user_id: userId,
          quiz_settings: DEFAULT_QUIZ_SETTINGS,
          notification_settings: DEFAULT_NOTIFICATION_SETTINGS,
          ui_settings: DEFAULT_UI_SETTINGS
        })
        .select()
        .single()

      if (createError) {
        console.error('[UserInit API] Error creating settings:', createError)
        // Return default settings rather than failing
        settings = {
          quiz_settings: DEFAULT_QUIZ_SETTINGS,
          notification_settings: DEFAULT_NOTIFICATION_SETTINGS,
          ui_settings: DEFAULT_UI_SETTINGS
        }
      } else {
        settings = newSettings
      }
    }

    const response: UserInitData = {
      userData: userDataResult.data || null,
      settings
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('[UserInit API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

