// src/app/api/user/profile-visibility/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { z } from 'zod'

const profileVisibilitySchema = z.object({
  visibility: z.enum(['public', 'private'], {
    invalid_type_error: 'Visibility must be either public or private'
  })
})

export async function GET() {
  try {
    const supabase = await createClient()

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current profile visibility from user settings
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('settings')
      .eq('user_id', user.id)
      .single()

    if (settingsError) {
      console.error('Error fetching user settings:', settingsError)
      return NextResponse.json({ error: 'Failed to fetch profile visibility' }, { status: 500 })
    }

    const profileVisibility = settings?.settings?.ui_settings?.profile_visibility || 'private'

    return NextResponse.json({
      success: true,
      visibility: profileVisibility
    })

  } catch (error) {
    console.error('Error fetching profile visibility:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    // Validate request data
    const validation = profileVisibilitySchema.safeParse(body)
    if (!validation.success) {
      const errors = validation.error.errors.map(err => err.message)
      return NextResponse.json({ error: errors.join('. ') }, { status: 400 })
    }

    const { visibility } = validation.data

    // Get current settings
    const { data: currentData, error: getCurrentError } = await supabase
      .from('user_settings')
      .select('settings')
      .eq('user_id', user.id)
      .single()

    if (getCurrentError && getCurrentError.code !== 'PGRST116') {
      console.error('Error fetching current settings:', getCurrentError)
      return NextResponse.json({ error: 'Failed to fetch current settings' }, { status: 500 })
    }

    // Update UI settings with new profile visibility
    const currentSettings = currentData?.settings || {}
    const updatedUISettings = {
      ...currentSettings?.ui_settings,
      profile_visibility: visibility
    }

    const updatedSettings = {
      ...currentSettings,
      ui_settings: updatedUISettings
    }

    // Update the settings using direct SQL
    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        settings: updatedSettings,
        updated_at: new Date().toISOString()
      })
      .select('settings')
      .single()

    if (error) {
      console.error('Error updating profile visibility:', error)
      return NextResponse.json({ error: 'Failed to update profile visibility' }, { status: 500 })
    }

    // Create audit log for profile visibility change
    await supabase
      .from('audit_logs')
      .insert({
        user_id: user.id,
        action: 'profile_visibility_changed',
        table_name: 'user_settings',
        record_id: user.id,
        old_values: { profile_visibility: currentSettings?.ui_settings?.profile_visibility || 'private' },
        new_values: { profile_visibility: visibility },
        metadata: {
          timestamp: new Date().toISOString()
        }
      })

    return NextResponse.json({
      success: true,
      visibility: visibility,
      message: `Profile visibility updated to ${visibility}`
    })

  } catch (error) {
    console.error('Error updating profile visibility:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
