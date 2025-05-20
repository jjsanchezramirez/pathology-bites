// src/app/api/auth/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  try {
    console.log('Auth callback triggered')
    
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    const type = requestUrl.searchParams.get('type')
    const next = requestUrl.searchParams.get('next')
    const error = requestUrl.searchParams.get('error')
    const redirect = requestUrl.searchParams.get('redirect')
    
    console.log('Callback params:', { 
      code: code ? 'exists' : 'missing', 
      type, 
      next,
      redirect,
      error,
      fullUrl: request.url
    })
    
    // Check for errors first
    if (error) {
      console.error('Auth error received:', error)
      const errorDescription = requestUrl.searchParams.get('error_description')
      const errorUrl = new URL('/auth-error', requestUrl.origin)
      errorUrl.searchParams.set('error', error)
      errorUrl.searchParams.set('description', errorDescription || 'Authentication failed')
      return NextResponse.redirect(errorUrl)
    }

    if (!code) {
      console.log('No code provided, redirecting to auth-error')
      const errorUrl = new URL('/auth-error', requestUrl.origin)
      errorUrl.searchParams.set('error', 'missing_code')
      errorUrl.searchParams.set('description', 'Authentication code is missing from the request')
      return NextResponse.redirect(errorUrl)
    }
    
    // Create a response object to handle cookies
    let response = NextResponse.next()
    
    // Create the Supabase client with improved cookie handling
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name) {
            return request.cookies.get(name)?.value
          },
          set(name, value, options) {
            request.cookies.set({
              name,
              value,
              ...options
            })
            // Also set cookie on the response to ensure it's stored
            response.cookies.set({
              name,
              value,
              ...options
            })
          },
          remove(name, options) {
            request.cookies.set({
              name,
              value: '',
              ...options
            })
            // Also remove from the response
            response.cookies.set({
              name,
              value: '',
              ...options
            })
          },
        },
      }
    )
    
    // Exchange code for session with better error handling
    try {
      console.log('Exchanging code for session...')
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
      
      if (exchangeError) {
        console.error('Failed to exchange code for session:', exchangeError)
        
        // Improved handling for PKCE errors
        if (exchangeError.message.includes('code challenge') || 
            exchangeError.message.includes('code verifier')) {
          const errorUrl = new URL('/auth-error', requestUrl.origin)
          errorUrl.searchParams.set('error', 'exchange_failed')
          errorUrl.searchParams.set('code', exchangeError.status?.toString() || '400')
          errorUrl.searchParams.set('description', 'Verification link is invalid or has already been used. Please request a new verification link.')
          return NextResponse.redirect(errorUrl)
        }
        
        // Generic error handling
        const errorUrl = new URL('/auth-error', requestUrl.origin)
        errorUrl.searchParams.set('error', 'exchange_failed')
        errorUrl.searchParams.set('code', exchangeError.status?.toString() || '')
        errorUrl.searchParams.set('description', exchangeError.message)
        return NextResponse.redirect(errorUrl)
      }
      
      console.log('Session established successfully')
      
      // Determine action based on session information
      const session = data.session
      const user = session?.user
      
      // Check if this is a signup confirmation (email verification)
      const isSignupConfirmation = type === 'signup_confirmation' || 
        (user && user.email_confirmed_at && !user.last_sign_in_at);
      
      if (isSignupConfirmation) {
        console.log('Email verification flow detected, redirecting to verified page')
        response = NextResponse.redirect(new URL('/email-verified', requestUrl.origin))
        return response
      }
      
      // Check if this is a password reset flow
      const isPasswordReset = type === 'recovery';
      if (isPasswordReset) {
        console.log('Password reset flow detected, redirecting to reset page')
        response = NextResponse.redirect(new URL('/reset-password', requestUrl.origin))
        return response
      }
      
      // Process any redirect parameter provided to the callback
      if (redirect) {
        console.log(`Redirect parameter found: ${redirect}`)
        // Clean the redirect URL to avoid double question marks
        const cleanRedirect = redirect.replace(/\?$/, '')
        // Create the redirect URL
        return NextResponse.redirect(new URL(cleanRedirect, requestUrl.origin))
      }
      
      // For other flows (including OAuth), get user info
      if (user) {
        console.log('User authenticated:', user.id)
        console.log('Checking if user exists in database')
        
        const { data: existingUser, error: userCheckError } = await supabase
          .from('users')
          .select('id, role')
          .eq('id', user.id)
          .single()
        
        if (userCheckError) {
          console.log('User not found in database, creating profile')
          
          try {
            // Extract basic profile info from user metadata
            const metadata = user.user_metadata || {}
            const firstName = metadata.full_name?.split(' ')[0] || metadata.given_name || ''
            const lastName = metadata.full_name?.split(' ').slice(1).join(' ') || metadata.family_name || ''
            
            // Insert user record
            await supabase.from('users').insert({
              id: user.id,
              email: user.email,
              first_name: firstName,
              last_name: lastName,
              role: 'user',
              user_type: 'other'
            })
            
            console.log('User profile created successfully')
            
            // Redirect to dashboard after creating new user
            response = NextResponse.redirect(new URL('/dashboard', requestUrl.origin))
            return response
          } catch (error) {
            console.error('Failed to create user profile:', error)
          }
        }
        
        // If we have a 'next' parameter, use it for redirection
        if (next) {
          console.log(`Redirecting to specified next path: ${next}`)
          // Clean the next URL to avoid double question marks
          const cleanNext = next.replace(/\?$/, '')
          response = NextResponse.redirect(new URL(cleanNext, requestUrl.origin))
          return response
        }
        
        // For coming soon mode, add a bypass parameter to allow access
        const comingSoonMode = process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true'
        const redirectParams = comingSoonMode ? '?bypass=true' : ''
        
        // Redirect based on role
        let redirectUrl;
        if (existingUser?.role === 'admin') {
          redirectUrl = new URL(`/admin/dashboard${redirectParams}`, requestUrl.origin)
        } else {
          redirectUrl = new URL(`/dashboard${redirectParams}`, requestUrl.origin)
        }
        
        console.log(`Redirecting to ${redirectUrl.toString()}`)
        response = NextResponse.redirect(redirectUrl)
        return response
      }
    } catch (exchangeError) {
      console.error('Exception during code exchange:', exchangeError)
      const errorUrl = new URL('/auth-error', requestUrl.origin)
      errorUrl.searchParams.set('error', 'exchange_failed')
      errorUrl.searchParams.set('description', exchangeError instanceof Error ? exchangeError.message : 'Failed to process authentication')
      return NextResponse.redirect(errorUrl)
    }
    
    // Default fallback if we can't determine a specific redirect
    console.log('No specific flow detected, redirecting to login')
    response = NextResponse.redirect(new URL('/login', requestUrl.origin))
    return response
    
  } catch (error) {
    console.error('Auth callback error:', error)
    const errorUrl = new URL('/auth-error', new URL(request.url).origin)
    errorUrl.searchParams.set('error', 'unexpected')
    errorUrl.searchParams.set('description', error instanceof Error ? error.message : 'An unexpected error occurred')
    return NextResponse.redirect(errorUrl)
  }
}