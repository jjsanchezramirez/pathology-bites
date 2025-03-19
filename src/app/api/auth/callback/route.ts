// src/app/api/auth/callback/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')

    if (code) {
      // Await cookies before using them
      const cookieStore = cookies()
      const supabase = createRouteHandlerClient({ 
        cookies: () => cookieStore 
      })
      
      // Exchange code for session
      const { data: { session }, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
      
      if (exchangeError) {
        console.error('Code exchange error:', exchangeError)
        throw exchangeError
      }

      if (!session?.user) {
        throw new Error('No session or user after code exchange')
      }

      // Check if user profile exists
      const { data: existingProfile, error: profileError } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Profile check error:', profileError)
        throw profileError
      }

      if (!existingProfile) {
        // Create new profile if it doesn't exist
        const { error: createError } = await supabase
          .from('users')
          .insert({
            id: session.user.id,
            email: session.user.email,
            role: 'user',
            first_name: session.user.user_metadata?.first_name || '',
            last_name: session.user.user_metadata?.last_name || '',
            user_type: session.user.user_metadata?.user_type || 'resident',
            status: 'active'
          })

        if (createError) {
          console.error('Profile creation error:', createError)
          throw createError
        }
      }

      // Get the user's role and redirect accordingly
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single()

      // Create response with redirect
      const response = NextResponse.redirect(
        new URL(userData?.role === 'admin' ? '/admin' : '/dashboard', request.url)
      )

      // Set session cookies with proper expiration
      const sessionExpiry = new Date(session.expires_at! * 1000)
      const cookieOptions = {
        path: '/',
        expires: sessionExpiry,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const
      }

      // Set both access and refresh tokens
      response.cookies.set('sb-access-token', session.access_token, cookieOptions)
      if (session.refresh_token) {
        response.cookies.set('sb-refresh-token', session.refresh_token, cookieOptions)
      }

      return response
    }

    // If no code, redirect to login
    return NextResponse.redirect(new URL('/login', request.url))
  } catch (error) {
    console.error('Auth callback error:', error)
    return NextResponse.redirect(
      new URL('/login?error=auth_callback_error', request.url)
    )
  }
}