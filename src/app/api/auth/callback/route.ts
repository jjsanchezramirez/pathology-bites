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
    
    console.log('Callback params:', { 
      code: code ? 'exists' : 'missing', 
      type, 
      next,
      fullUrl: request.url
    })
    
    if (!code) {
      console.log('No code provided, redirecting to auth-error')
      const errorUrl = new URL('/auth-error', request.url)
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
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set({
                name,
                value,
                ...options
              })
              response.cookies.set({
                name,
                value,
                ...options
              })
            })
          },
        },
      }
    )
    
    // Exchange code for session with better error handling
    try {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
      
      if (exchangeError) {
        console.error('Failed to exchange code for session:', exchangeError)
        
        // Improved handling for PKCE errors
        if (exchangeError.message.includes('code challenge') || 
            exchangeError.message.includes('code verifier')) {
          const errorUrl = new URL('/auth-error', request.url)
          errorUrl.searchParams.set('error', 'exchange_failed')
          errorUrl.searchParams.set('code', exchangeError.status?.toString() || '400')
          errorUrl.searchParams.set('description', 'Verification link is invalid or has already been used. Please request a new verification link.')
          return NextResponse.redirect(errorUrl)
        }
        
        // Generic error handling
        const errorUrl = new URL('/auth-error', request.url)
        errorUrl.searchParams.set('error', 'exchange_failed')
        errorUrl.searchParams.set('code', exchangeError.status?.toString() || '')
        errorUrl.searchParams.set('description', exchangeError.message)
        return NextResponse.redirect(errorUrl)
      }
    } catch (exchangeError) {
      console.error('Exception during code exchange:', exchangeError)
      const errorUrl = new URL('/auth-error', request.url)
      errorUrl.searchParams.set('error', 'exchange_failed')
      errorUrl.searchParams.set('description', exchangeError instanceof Error ? exchangeError.message : 'Failed to process authentication')
      return NextResponse.redirect(errorUrl)
    }
    
    // For signup confirmation, redirect to verified page
    if (type === 'signup_confirmation') {
      console.log('Signup confirmation, redirecting to email-verified page')
      
      // Create redirect response and preserve cookies
      response = NextResponse.redirect(new URL('/email-verified?verified=true', request.url))
      
      return response
    }
    
    // Get authenticated user data
    const { data: { user } } = await supabase.auth.getUser()
    console.log('User authenticated:', user?.id)
    
    // For other flows, continue with existing logic
    if (user) {
      console.log('Checking if user exists in database')
      
      const { data: existingUser, error: userCheckError } = await supabase
        .from('users')
        .select('id, role')
        .eq('id', user.id)
        .single()
      
      if (userCheckError || !existingUser) {
        console.log('Creating new user profile')
        
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
          
          console.log('User profile created')
        } catch (error) {
          console.error('Failed to create user profile:', error)
        }
      }
      
      // If we have a 'next' parameter, prioritize it for redirection
      if (next) {
        console.log(`Redirecting to specified next path: ${next}`)
        response = NextResponse.redirect(new URL(next, request.url))
        return response
      }
      
      // For coming soon mode, add a bypass parameter to allow access
      const comingSoonMode = process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true'
      const redirectParams = comingSoonMode ? '?bypass=true' : ''
      
      // Redirect based on role
      let redirectUrl;
      if (existingUser?.role === 'admin') {
        redirectUrl = new URL(`/admin/dashboard${redirectParams}`, request.url)
      } else {
        redirectUrl = new URL(`/dashboard${redirectParams}`, request.url)
      }
      
      // Create the redirect response
      response = NextResponse.redirect(redirectUrl)
      
      return response
    }
    
    // Default fallback
    response = NextResponse.redirect(new URL('/dashboard', request.url))
    return response
    
  } catch (error) {
    console.error('Auth callback error:', error)
    const errorUrl = new URL('/auth-error', request.url)
    errorUrl.searchParams.set('error', 'unexpected')
    errorUrl.searchParams.set('description', error instanceof Error ? error.message : 'An unexpected error occurred')
    return NextResponse.redirect(errorUrl)
  }
}