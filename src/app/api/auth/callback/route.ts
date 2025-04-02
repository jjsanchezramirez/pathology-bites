// src/app/api/auth/login/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

// Maximum number of retry attempts
const MAX_RETRIES = 3

export async function POST(request: NextRequest) {
  let retryCount = 0
  let lastError = null

  while (retryCount < MAX_RETRIES) {
    try {
      // Get client IP for rate limiting and security
      const ip = request.headers.get('x-forwarded-for') || 
                 request.headers.get('x-real-ip') || 
                 '127.0.0.1'
      
      // Parse request with error handling
      let email, password
      try {
        const body = await request.json()
        email = body.email
        password = body.password
        
        if (!email || !password) {
          return NextResponse.json(
            { error: 'Email and password are required' },
            { status: 400 }
          )
        }
      } catch (parseError) {
        console.error('Request parsing error:', parseError)
        return NextResponse.json(
          { error: 'Invalid request format' },
          { status: 400 }
        )
      }
      
      // Create admin client for authentication (bypasses captcha)
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      
      if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Supabase configuration missing')
      }
      
      const supabaseAdmin = createClient(
        supabaseUrl,
        supabaseServiceKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      )
      
      // Log attempt for security monitoring (omit in dev)
      if (process.env.NODE_ENV === 'production') {
        await supabaseAdmin
          .from('login_attempts')
          .insert({
            email,
            ip_address: ip,
            timestamp: new Date().toISOString(),
            success: false // Will update to true if successful
          })
          .select()
      }
      
      // Rate limiting check
      if (process.env.NODE_ENV === 'production') {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
        
        const { data: recentAttempts, error: attemptsError } = await supabaseAdmin
          .from('login_attempts')
          .select('id')
          .eq('ip_address', ip)
          .eq('success', false)
          .gte('timestamp', fiveMinutesAgo)
        
        if (attemptsError) {
          console.error('Error checking login attempts:', attemptsError)
        } else if (recentAttempts && recentAttempts.length >= 5) {
          return NextResponse.json(
            { error: 'Too many login attempts. Please try again later.' },
            { status: 429 }
          )
        }
      }
      
      // Authenticate with admin client (no captcha)
      const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password
      })
      
      if (error) {
        // Mark as invalid credentials rather than exposing internal error details
        const errorMessage = error.message.includes('Invalid login credentials') 
          ? 'Invalid email or password' 
          : 'Authentication failed'
        
        return NextResponse.json({ error: errorMessage }, { status: 400 })
      }
      
      if (!data.session) {
        return NextResponse.json({ error: "No session returned" }, { status: 400 })
      }
      
      // Update login attempt to successful if we're tracking
      if (process.env.NODE_ENV === 'production') {
        await supabaseAdmin
          .from('login_attempts')
          .update({ success: true })
          .eq('email', email)
          .eq('ip_address', ip)
          .order('timestamp', { ascending: false })
          .limit(1)
      }
      
      // Create a response object
      const response = NextResponse.json({ 
        success: true, 
        user: {
          id: data.user.id,
          email: data.user.email,
          // Omit sensitive data
        }
      }, { status: 200 })
      
      // Get the cookie name Supabase is using
      const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.split('.')[0].split('//')[1]
      const cookieName = projectRef ? `sb-${projectRef}-auth-token` : 'sb-auth-token'
      
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
      console.error(`Login error (attempt ${retryCount + 1}/${MAX_RETRIES}):`, error)
      lastError = error
      retryCount++
      
      // Only retry if this looks like a transient error
      const errorMessage = error instanceof Error ? error.message : String(error)
      const isTransientError = 
        errorMessage.includes('network') || 
        errorMessage.includes('timeout') || 
        errorMessage.includes('fetch') ||
        errorMessage.includes('connection')
      
      if (!isTransientError) {
        break
      }
      
      // Add exponential backoff between retries
      if (retryCount < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)))
      }
    }
  }
  
  // If we've exhausted retries, return a 503 Service Unavailable
  return NextResponse.json(
    { error: 'Service temporarily unavailable. Please try again later.' },
    { status: 503 }
  )
}