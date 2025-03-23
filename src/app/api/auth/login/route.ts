// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { isIPSuspicious, trackLoginAttempt } from '@/lib/services/security-service'
import { createServerSupabase } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body
    
    // Get IP from request headers
    const forwardedFor = request.headers.get('x-forwarded-for')
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0] : '127.0.0.1'
    
    // Check if IP is suspicious
    const suspicious = await isIPSuspicious(ipAddress)
    if (suspicious) {
      // Apply additional security measures (e.g., require CAPTCHA)
      return NextResponse.json(
        { error: 'Suspicious activity detected. Please solve CAPTCHA to continue.' },
        { status: 403 }
      )
    }
    
    // Attempt login
    const supabase = await createServerSupabase()
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    // Track the login attempt
    await trackLoginAttempt(email, ipAddress, !error)
    
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}