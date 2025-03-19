// src/app/api/auth/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')

    if (code) {
      // Create Supabase client for route handler
      const cookieStore = cookies()
      const supabase = createRouteHandlerClient({ 
        cookies: () => cookieStore
      })
      
      // Exchange code for session
      await supabase.auth.exchangeCodeForSession(code)

      // Redirect back to appropriate page
      const redirectTo = requestUrl.searchParams.get('next') || '/dashboard'
      return NextResponse.redirect(new URL(redirectTo, request.url))
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