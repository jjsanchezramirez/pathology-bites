// src/app/api/auth/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { withRateLimit, authRateLimiter } from '@/shared/utils/api-rate-limiter'

const rateLimitedHandler = withRateLimit(authRateLimiter)

export const GET = rateLimitedHandler(async function(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  
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

      // Create user profile if it doesn't exist
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

        return NextResponse.redirect(`${origin}/dashboard`)
      }

      // Redirect based on user role
      const redirectUrl = userData?.role === 'admin' 
        ? `${origin}/admin/dashboard`
        : `${origin}/dashboard`

      return NextResponse.redirect(redirectUrl)
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth-error?error=oauth_error&description=Failed to authenticate with OAuth provider`)
})