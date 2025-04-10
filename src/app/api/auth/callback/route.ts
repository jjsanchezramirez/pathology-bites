// src/app/api/auth/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
    
    // Use the new async createClient
    const supabase = await createClient()
    
    // Exchange code for session
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) {
      console.error('Failed to exchange code for session:', exchangeError)
      const errorUrl = new URL('/auth-error', request.url)
      errorUrl.searchParams.set('error', 'exchange_failed')
      errorUrl.searchParams.set('code', exchangeError.status?.toString() || '')
      errorUrl.searchParams.set('description', exchangeError.message)
      return NextResponse.redirect(errorUrl)
    }
    
    // For signup confirmation, bypass the middleware by adding a special parameter
    if (type === 'signup_confirmation') {
      console.log('Signup confirmation, redirecting to email-verified page')
      
      // Add a bypass parameter to avoid middleware redirects
      return NextResponse.redirect(new URL('/email-verified?verified=true', request.url))
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
        return NextResponse.redirect(new URL(next, request.url))
      }
      
      // Otherwise, redirect based on role
      if (existingUser?.role === 'admin') {
        return NextResponse.redirect(new URL('/admin/dashboard', request.url))
      } else {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
    
    // Default fallback
    return NextResponse.redirect(new URL('/dashboard', request.url))
  } catch (error) {
    console.error('Auth callback error:', error)
    const errorUrl = new URL('/auth-error', request.url)
    errorUrl.searchParams.set('error', 'unexpected')
    errorUrl.searchParams.set('description', error instanceof Error ? error.message : 'An unexpected error occurred')
    return NextResponse.redirect(errorUrl)
  }
}