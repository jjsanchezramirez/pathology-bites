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
      next 
    })
    
    if (!code) {
      console.log('No code provided, redirecting to login')
      return NextResponse.redirect(new URL('/login', request.url))
    }
    
    // Use the new async createClient
    const supabase = await createClient()
    
    // Exchange code for session
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) {
      console.error('Failed to exchange code for session:', exchangeError)
      return NextResponse.redirect(new URL('/login?error=exchange', request.url))
    }
    
    // Get authenticated user data
    const { data: { user } } = await supabase.auth.getUser()
    console.log('User authenticated:', user?.id)
    
    // If user exists, check for or create a user record in the database
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
          
          console.log('User profile created, redirecting to dashboard')
        } catch (error) {
          console.error('Failed to create user profile:', error)
        }
        
        // Redirect to dashboard
        return NextResponse.redirect(new URL('/dashboard', request.url))
      } else {
        // Existing user - redirect based on role
        console.log('Existing user found with role:', existingUser.role)
        if (existingUser.role === 'admin') {
          return NextResponse.redirect(new URL('/admin/dashboard', request.url))
        } else {
          return NextResponse.redirect(new URL('/dashboard', request.url))
        }
      }
    }
    
    // Default fallback
    return NextResponse.redirect(new URL('/dashboard', request.url))
  } catch (error) {
    console.error('Auth callback error:', error)
    return NextResponse.redirect(new URL('/login?error=unexpected', request.url))
  }
}