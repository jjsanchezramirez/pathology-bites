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
       * User creation in public.users and user_settings is handled AUTOMATICALLY by database triggers.
       * When a user is created in auth.users (via OAuth), the following triggers fire:
       *
       * 1. Trigger: on_auth_user_created (AFTER INSERT on auth.users)
       *    - Calls: handle_new_user()
       *    - Creates record in public.users with user metadata
       *    - Calls create_user_settings_for_new_user() to create default settings
       *
       * No manual user creation is needed here. The trigger handles everything.
       * See: supabase/migrations/20250119000002_fix_user_creation_trigger.sql
       */

      // Check if user exists in database
      const { data: userData, error: profileError } = await supabase
        .from('users')
        .select('role')
        .eq('id', data.user.id)
        .single()

      // In admin-only modes, prevent new account creation
      if (profileError && profileError.code === 'PGRST116' && isAdminOnlyMode) {
        // Sign out the user since we don't want to create a new account
        await supabase.auth.signOut()

        const modeText = isMaintenanceMode ? 'maintenance' : 'coming soon'
        return NextResponse.redirect(`${origin}/auth-error?error=account_creation_disabled&description=New account creation is disabled during ${modeText} mode. Please contact an administrator if you need access.`)
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