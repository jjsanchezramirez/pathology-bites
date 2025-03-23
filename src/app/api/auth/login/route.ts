// src/app/api/auth/login/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    
    // Create admin client for authentication (bypasses captcha)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
    
    // Authenticate with admin client (no captcha)
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password
    })
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    
    if (!data.session) {
      return NextResponse.json({ error: "No session returned" }, { status: 400 })
    }
    
    // Create a response object
    const response = NextResponse.json({ 
      success: true, 
      user: data.user
    }, { status: 200 })
    
    // Get the cookie name Supabase is using
    const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.split('.')[0].split('//')[1]
    const cookieName = `sb-${projectRef}-auth-token`
    
    // Set the auth cookie directly
    response.cookies.set(cookieName, JSON.stringify([
      data.session.access_token,
      data.session.refresh_token
    ]), {
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true
    })
    
    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}