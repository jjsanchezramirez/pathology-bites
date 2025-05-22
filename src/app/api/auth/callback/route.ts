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
    const errorCode = requestUrl.searchParams.get('error_code')
    const errorDescription = requestUrl.searchParams.get('error_description')
    const redirect = requestUrl.searchParams.get('redirect')
    
    console.log('Callback params:', { 
      code: code ? 'exists' : 'missing', 
      type, 
      next,
      redirect,
      error,
      errorCode,
      fullUrl: request.url
    })
    
    // PRIORITY: Handle errors first - this should catch your expired link case
    if (error) {
      console.log(`Auth error received: ${error} (${errorCode})`)
      const errorUrl = new URL('/auth-error', requestUrl.origin)
      errorUrl.searchParams.set('error', error)
      errorUrl.searchParams.set('description', errorDescription || 'Authentication failed')
      if (errorCode) {
        errorUrl.searchParams.set('error_code', errorCode)
      }
      return NextResponse.redirect(errorUrl, { status: 307 })
    }

    if (!code) {
      console.log('No code provided, redirecting to auth-error')
      const errorUrl = new URL('/auth-error', requestUrl.origin)
      errorUrl.searchParams.set('error', 'missing_code')
      errorUrl.searchParams.set('description', 'Authentication code is missing from the request')
      return NextResponse.redirect(errorUrl, { status: 307 })
    }
    
    // Create supabase client with proper cookie handling
    const response = NextResponse.next()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name) {
            return request.cookies.get(name)?.value
          },
          set(name, value, options) {
            response.cookies.set({
              name,
              value,
              ...options
            })
          },
          remove(name, options) {
            response.cookies.set({
              name,
              value: '',
              ...options
            })
          },
        },
      }
    )
    
    // Exchange code for session
    console.log('Exchanging code for session...')
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    
    if (exchangeError) {
      console.error('Failed to exchange code for session:', exchangeError)
      const errorUrl = new URL('/auth-error', requestUrl.origin)
      errorUrl.searchParams.set('error', 'exchange_failed')
      errorUrl.searchParams.set('description', exchangeError.message)
      return NextResponse.redirect(errorUrl, { status: 307 })
    }
    
    if (!data.session?.user) {
      console.error('No user data in session after exchange')
      const errorUrl = new URL('/auth-error', requestUrl.origin)
      errorUrl.searchParams.set('error', 'no_user')
      errorUrl.searchParams.set('description', 'Failed to create user session')
      return NextResponse.redirect(errorUrl, { status: 307 })
    }
    
    console.log('Session established successfully', {
      user_id: data.session.user.id,
      provider: data.session.user.app_metadata?.provider || 'unknown',
      email_confirmed: data.session.user.email_confirmed_at ? 'yes' : 'no'
    })
    
    // Check if user exists in database
    console.log('Checking if user exists in database')
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, role, created_at')
      .eq('id', data.session.user.id)
      .single()
    
    // Determine if this is email verification vs regular login
    const isNewUser = !existingUser
    const isEmailVerification = type === 'signup' || 
                               type === 'signup_confirmation' ||
                               isNewUser ||
                               (existingUser && new Date(existingUser.created_at).getTime() > (Date.now() - 10 * 60 * 1000)) // Created within last 10 minutes
    
    console.log('User flow determination:', {
      isNewUser,
      isEmailVerification,
      type,
      userCreatedAt: existingUser?.created_at
    })
    
    // Determine redirect destination
    let redirectPath: string
    
    if (isEmailVerification) {
      console.log('Email verification flow detected, redirecting to email-verified page')
      redirectPath = '/email-verified'
      
      // Create user record if it doesn't exist
      if (isNewUser) {
        try {
          console.log('Creating database record for new user')
          await supabase
            .from('users')
            .insert({
              id: data.session.user.id,
              email: data.session.user.email!,
              first_name: data.session.user.user_metadata?.first_name || null,
              last_name: data.session.user.user_metadata?.last_name || null,
              role: 'user',
              user_type: data.session.user.user_metadata?.user_type || 'other',
              status: 'active'
            })
        } catch (dbError) {
          console.error('Error creating user record:', dbError)
          // Continue with redirect even if DB creation fails
        }
      }
    } else if (type === 'recovery') {
      console.log('Password recovery flow detected')
      redirectPath = '/reset-password'
    } else {
      // Regular login - check role and redirect appropriately
      const isAdmin = existingUser?.role === 'admin'
      console.log(`Regular login flow detected, admin: ${isAdmin}`)
      
      // Handle custom redirect parameter
      if (redirect) {
        redirectPath = redirect.replace(/\?$/, '')
      } else if (next) {
        redirectPath = next.replace(/\?$/, '')
      } else if (isAdmin) {
        redirectPath = '/admin/dashboard'
      } else {
        redirectPath = '/dashboard'
      }
    }
    
    // Build final redirect URL
    const queryParams = new URLSearchParams()
    
    // Add bypass for coming soon mode if needed
    if (process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true') {
      queryParams.set('bypass', 'true')
    }
    
    // Add source tracking
    queryParams.set('source', 'auth_callback')
    
    const finalRedirectUrl = new URL(
      `${redirectPath}${queryParams.toString() ? '?' + queryParams.toString() : ''}`,
      requestUrl.origin
    )
    
    console.log(`Finalizing redirect to: ${finalRedirectUrl.toString()}`)
    
    // Create redirect response
    const redirectResponse = NextResponse.redirect(finalRedirectUrl, { status: 307 })
    
    // Transfer auth cookies from supabase client
    const allCookies = response.cookies.getAll()
    
    console.log(`Transferring ${allCookies.length} cookies to response`)
    allCookies.forEach(cookie => {
      redirectResponse.cookies.set(cookie)
      console.log(`Transferred cookie: ${cookie.name}`)
    })
    
    return redirectResponse
    
  } catch (error) {
    console.error('Auth callback uncaught error:', error)
    const errorUrl = new URL('/auth-error', new URL(request.url).origin)
    errorUrl.searchParams.set('error', 'unexpected')
    errorUrl.searchParams.set('description', error instanceof Error ? error.message : 'An unexpected error occurred')
    return NextResponse.redirect(errorUrl, { status: 307 })
  }
}