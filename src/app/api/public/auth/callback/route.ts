// src/app/api/public/auth/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { withRateLimit, authRateLimiter } from '@/shared/utils/api-rate-limiter'

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
        .select('role')
        .eq('id', data.user.id)
        .single()

      // If user doesn't exist, create them
      if (profileError && profileError.code === 'PGRST116') {
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
            quiz_settings: {
              default_question_count: 10,
              default_mode: 'tutor',
              default_timing: 'untimed',
              default_question_type: 'unused',
              default_category_selection: 'all'
            },
            notification_settings: {
              email_notifications: true,
              quiz_reminders: true,
              progress_updates: true
            },
            ui_settings: {
              theme: 'system',
              font_size: 'medium',
              text_zoom: 1.0,
              dashboard_theme_admin: 'default',
              dashboard_theme_user: 'tangerine',
              sidebar_collapsed: false,
              welcome_message_seen: false
            }
          })

        if (settingsError) {
          console.error('Error creating user settings:', settingsError)
          // Don't fail the redirect if settings creation fails - user can still log in
        }
      } else if (profileError) {
        console.error('Error checking user:', profileError)
        return NextResponse.redirect(`${origin}/auth-error?error=user_check_failed&description=Failed to check user account`)
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