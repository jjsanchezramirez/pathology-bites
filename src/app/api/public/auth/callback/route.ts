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

      // Create user profile if it doesn't exist (only when not in admin-only mode)
      if (profileError && profileError.code === 'PGRST116') {
        const metadata = data.user.user_metadata
        await supabase.from('users').insert({
          id: data.user.id,
          email: data.user.email,
          first_name: metadata.full_name?.split(' ')[0] || metadata.given_name || '',
          last_name: metadata.full_name?.split(' ').slice(1).join(' ') || metadata.family_name || '',
          role: 'user',
          user_type: 'other',
          status: 'active'
        })

        // Create default user settings for new user
        await supabase.rpc('create_user_settings_for_new_user', { p_user_id: data.user.id })

        return NextResponse.redirect(`${origin}/dashboard`)
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