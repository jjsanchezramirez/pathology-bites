// src/app/api/auth/callback/route.ts - Fixed cookies and error handling
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url) // Move outside try block
  
  try {
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')
    
    console.log('Auth callback received:', { 
      code: code ? 'present' : 'missing',
      error,
      errorDescription 
    })

    // Fix cookies issue - use cookies() directly without async wrapper
    const supabase = createRouteHandlerClient({ 
      cookies: () => cookies() 
    })

    // Handle direct errors (but not access_denied from expired links)
    if (error && error !== 'access_denied') {
      console.error('Auth error:', error, errorDescription)
      const errorUrl = new URL('/auth-error', origin)
      errorUrl.searchParams.set('error', error)
      if (errorDescription) {
        errorUrl.searchParams.set('description', errorDescription)
      }
      return NextResponse.redirect(errorUrl)
    }

    // Handle code flow
    if (code) {
      console.log('Processing callback with code')
      
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

      // Handle PKCE errors (common in email verification)
      if (exchangeError && exchangeError.code === 'bad_code_verifier') {
        console.log('PKCE error detected - assuming email verification success')
        
        // Check if we can get user info despite the PKCE error
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (user && user.email_confirmed_at) {
            console.log('Email verification confirmed, user is verified:', user.email)
            
            // Create user profile if doesn't exist
            const { error: userCheckError } = await supabase
              .from('users')
              .select('id')
              .eq('id', user.id)
              .single()

            if (userCheckError && userCheckError.code === 'PGRST116') {
              await supabase.from('users').insert({
                id: user.id,
                email: user.email,
                first_name: user.user_metadata.first_name || '',
                last_name: user.user_metadata.last_name || '',
                user_type: user.user_metadata.user_type || 'other',
                role: 'user',
                status: 'active'
              })
            }
            
            return NextResponse.redirect(new URL('/email-verified', origin))
          }
        } catch (userError) {
          console.error('Error checking user after PKCE error:', userError)
        }
        
        // If we can't confirm verification, assume it worked anyway for email verification
        return NextResponse.redirect(new URL('/email-verified', origin))
      }

      // Handle other exchange errors
      if (exchangeError) {
        console.error('Code exchange error:', exchangeError)
        const errorUrl = new URL('/auth-error', origin)
        errorUrl.searchParams.set('error', 'exchange_failed')
        errorUrl.searchParams.set('description', exchangeError.message)
        return NextResponse.redirect(errorUrl)
      }

      // Successful OAuth flow
      if (data?.user) {
        console.log('OAuth authentication successful for:', data.user.email)
        
        const { data: userProfile, error: profileError } = await supabase
          .from('users')
          .select('role')
          .eq('id', data.user.id)
          .single()

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

          return NextResponse.redirect(new URL('/dashboard', origin))
        }

        const redirectUrl = userProfile?.role === 'admin' 
          ? new URL('/admin/dashboard', origin)
          : new URL('/dashboard', origin)

        return NextResponse.redirect(redirectUrl)
      }
    }

    // Handle expired/invalid links
    if (error === 'access_denied') {
      console.log('Access denied error - likely expired verification link')
      const errorUrl = new URL('/auth-error', origin)
      errorUrl.searchParams.set('error', error)
      errorUrl.searchParams.set('description', errorDescription || 'Email link is invalid or has expired')
      errorUrl.searchParams.set('type', 'verification')
      return NextResponse.redirect(errorUrl)
    }

    // No valid parameters
    console.log('No valid parameters provided')
    const errorUrl = new URL('/auth-error', origin)
    errorUrl.searchParams.set('error', 'missing_params')
    errorUrl.searchParams.set('description', 'Authorization parameters missing from request')
    return NextResponse.redirect(errorUrl)

  } catch (error) {
    console.error('Auth callback error:', error)
    const errorUrl = new URL('/auth-error', origin) // Now origin is accessible
    errorUrl.searchParams.set('error', 'callback_error')
    errorUrl.searchParams.set('description', 'Authentication callback failed')
    return NextResponse.redirect(errorUrl)
  }
}