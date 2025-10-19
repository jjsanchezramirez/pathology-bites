// src/app/api/public/auth/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { withRateLimit, authRateLimiter } from '@/shared/utils/api-rate-limiter'
import {
  DEFAULT_QUIZ_SETTINGS,
  DEFAULT_NOTIFICATION_SETTINGS,
  DEFAULT_UI_SETTINGS
} from '@/shared/constants/user-settings-defaults'

// Create Supabase client with service role for admin operations
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createSupabaseClient(supabaseUrl, supabaseServiceKey)
}

const rateLimitedHandler = withRateLimit(authRateLimiter)

export const GET = rateLimitedHandler(async function(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  // Check if we're in coming soon or maintenance mode
  const isComingSoonMode = process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true'
  const isMaintenanceMode = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true'
  const isAdminOnlyMode = isComingSoonMode || isMaintenanceMode

  if (code) {
    const supabase = await createClient()

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data?.user) {
      /**
       * USER CREATION NOTE:
       * User creation in public.users and user_settings is handled in APPLICATION CODE.
       * This ensures all users have corresponding entries in both tables.
       *
       * Process:
       * 1. Check if user exists in public.users
       * 2. If not, create user record with metadata from auth.users
       * 3. Create default user_settings for the new user
       * 4. Redirect based on user role
       */

      // Check if user exists in database
      let userData = null
      const { data: existingUser, error: profileError } = await supabase
        .from('users')
        .select('id, role, status, deleted_at')
        .eq('id', data.user.id)
        .single()

      // Also check for soft-deleted user by email (in case auth.users was deleted and recreated)
      let softDeletedUser = null
      if (profileError && profileError.code === 'PGRST116' && data.user.email) {
        const { data: emailMatch } = await supabase
          .from('users')
          .select('id, role, status, deleted_at, email')
          .eq('email', data.user.email)
          .eq('status', 'deleted')
          .single()

        if (emailMatch) {
          softDeletedUser = emailMatch
          console.log('Found soft-deleted user by email:', {
            email: data.user.email,
            oldUserId: emailMatch.id,
            newUserId: data.user.id
          })
        }
      }

      // If we found a soft-deleted user by email, restore them with new auth ID
      if (softDeletedUser) {
        console.log('Restoring soft-deleted user with new auth ID:', {
          oldId: softDeletedUser.id,
          newId: data.user.id,
          email: data.user.email,
          role: softDeletedUser.role
        })

        // Use admin client to bypass RLS policies for restoration
        const adminClient = createAdminClient()

        // Delete the old user record first (must be done with admin client)
        const { error: deleteOldUserError } = await adminClient
          .from('users')
          .delete()
          .eq('id', softDeletedUser.id)

        if (deleteOldUserError) {
          console.error('Error deleting old user record:', deleteOldUserError)
        }

        // Delete old user_settings if they exist
        await adminClient
          .from('user_settings')
          .delete()
          .eq('user_id', softDeletedUser.id)

        // Create new user record with new ID but preserve old user's data
        const { data: restoredUser, error: createError } = await adminClient
          .from('users')
          .insert({
            id: data.user.id, // New auth.users ID
            email: data.user.email || softDeletedUser.email,
            first_name: data.user.user_metadata?.first_name || '',
            last_name: data.user.user_metadata?.last_name || '',
            user_type: data.user.user_metadata?.user_type || 'other',
            role: softDeletedUser.role, // Preserve original role (admin/creator/reviewer)
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select('role')
          .single()

        if (createError) {
          console.error('Error creating restored user:', createError)
          return NextResponse.redirect(`${origin}/auth-error?error=user_restore_failed&description=Failed to restore user account`)
        }

        // Create user_settings for the new ID
        const { error: settingsError } = await adminClient
          .from('user_settings')
          .insert({
            user_id: data.user.id,
            quiz_settings: DEFAULT_QUIZ_SETTINGS,
            notification_settings: DEFAULT_NOTIFICATION_SETTINGS,
            ui_settings: DEFAULT_UI_SETTINGS
          })

        if (settingsError) {
          console.error('Error creating user settings for restored user:', settingsError)
          // Don't fail - user can still log in
        }

        userData = restoredUser
        console.log('User restored successfully with new ID:', { userId: data.user.id, role: restoredUser.role })
      } else if (profileError && profileError.code === 'PGRST116') {
        // If user doesn't exist, create them
        // In admin-only modes, prevent new account creation
        if (isAdminOnlyMode) {
          // Sign out the user since we don't want to create a new account
          await supabase.auth.signOut()

          const modeText = isMaintenanceMode ? 'maintenance' : 'coming soon'
          return NextResponse.redirect(`${origin}/auth-error?error=account_creation_disabled&description=New account creation is disabled during ${modeText} mode. Please contact an administrator if you need access.`)
        }

        // Create user in public.users
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({
            id: data.user.id,
            email: data.user.email || '',
            first_name: data.user.user_metadata?.first_name || '',
            last_name: data.user.user_metadata?.last_name || '',
            user_type: data.user.user_metadata?.user_type || 'other',
            role: 'user',
            status: 'active'
          })
          .select('role')
          .single()

        if (createError) {
          console.error('Error creating user:', createError)
          return NextResponse.redirect(`${origin}/auth-error?error=user_creation_failed&description=Failed to create user account`)
        }

        userData = newUser

        // Create default user settings
        const { error: settingsError } = await supabase
          .from('user_settings')
          .insert({
            user_id: data.user.id,
            quiz_settings: DEFAULT_QUIZ_SETTINGS,
            notification_settings: DEFAULT_NOTIFICATION_SETTINGS,
            ui_settings: DEFAULT_UI_SETTINGS
          })

        if (settingsError) {
          console.error('Error creating user settings:', settingsError)
          // Don't fail the redirect if settings creation fails - user can still log in
        }
      } else if (profileError) {
        console.error('Error checking user:', profileError)
        return NextResponse.redirect(`${origin}/auth-error?error=user_check_failed&description=Failed to check user account`)
      } else if (existingUser?.status === 'deleted') {
        // User exists but is soft-deleted - restore them
        console.log('Restoring soft-deleted user:', { userId: data.user.id, email: data.user.email })

        const { data: restoredUser, error: restoreError } = await supabase
          .from('users')
          .update({
            status: 'active',
            deleted_at: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', data.user.id)
          .select('role')
          .single()

        if (restoreError) {
          console.error('Error restoring user:', restoreError)
          return NextResponse.redirect(`${origin}/auth-error?error=user_restore_failed&description=Failed to restore user account`)
        }

        // Check if user_settings exist, create if missing
        const { data: existingSettings } = await supabase
          .from('user_settings')
          .select('user_id')
          .eq('user_id', data.user.id)
          .single()

        if (!existingSettings) {
          console.log('Creating missing user_settings for restored user:', data.user.id)
          const { error: settingsError } = await supabase
            .from('user_settings')
            .insert({
              user_id: data.user.id,
              quiz_settings: DEFAULT_QUIZ_SETTINGS,
              notification_settings: DEFAULT_NOTIFICATION_SETTINGS,
              ui_settings: DEFAULT_UI_SETTINGS
            })

          if (settingsError) {
            console.error('Error creating user settings for restored user:', settingsError)
            // Don't fail - user can still log in
          }
        }

        userData = restoredUser
        console.log('User restored successfully:', { userId: data.user.id, role: restoredUser.role })
      } else {
        userData = existingUser
      }

      // Redirect based on user role - consistent with middleware logic
      const redirectUrl = (userData?.role === 'admin' || userData?.role === 'creator' || userData?.role === 'reviewer')
        ? `${origin}/admin/dashboard`
        : `${origin}/dashboard`

      return NextResponse.redirect(redirectUrl)
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth-error?error=oauth_error&description=Failed to authenticate with OAuth provider`)
})