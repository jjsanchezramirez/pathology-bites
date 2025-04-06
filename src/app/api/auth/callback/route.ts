// src/app/api/auth/callback/route.ts
import { createClient } from '@/lib/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    const type = requestUrl.searchParams.get('type')
    const next = requestUrl.searchParams.get('next')
    
    if (!code) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    
    // Create supabase client
    const supabase = await createClient()
    
    // Exchange code for session
    await supabase.auth.exchangeCodeForSession(code)
    
    // Handle different callback types
    if (type === 'recovery') {
      return NextResponse.redirect(new URL('/reset-password', request.url))
    }

    if (type === 'signup_confirmation') {
      return NextResponse.redirect(new URL(next || '/email-verified', request.url))
    }
    
    return NextResponse.redirect(new URL('/dashboard', request.url))
  } catch (error) {
    console.error('Auth callback error:', error)
    return NextResponse.redirect(new URL('/login?error=unexpected', request.url))
  }
}