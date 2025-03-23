// src/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

export async function middleware(request: NextRequest) {
  try {
    // Create response and client
    const res = NextResponse.next()
    const supabase = createMiddlewareClient({ req: request, res })
    
    const pathname = request.nextUrl.pathname

    // Auth callback bypass - always allow access to auth callbacks and the home page
    if (pathname === '/api/auth/callback' || 
      pathname.startsWith('/api/auth/callback?') || 
      pathname === '/') {
    return res
    }

    // Define routes for easier checking
    const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/')
    const isDashboardRoute = pathname === '/dashboard' || pathname.startsWith('/dashboard/')
    const isPublicRoute = [
      '/login', 
      '/signup', 
      '/forgot-password', 
      '/reset-password', 
      '/verify-email', 
      '/check-email', 
      '/email-verified',
      '/api/auth/callback'  // Add this line
    ].includes(pathname) || pathname.startsWith('/api/auth/callback');    

    // Get session with error handling
    let session;
    try {
      const { data, error } = await supabase.auth.getSession()
      
      // Handle the specific refresh token error
      if (error && 
          (error.message?.includes('Refresh Token Not Found') || 
          error.message?.includes('Invalid Refresh Token') || 
          error.code === 'refresh_token_not_found')) {
        console.log('Refresh token issue detected, clearing cookies')
        
        // Clear the problematic auth cookies
        const response = NextResponse.next()
        response.cookies.delete('sb-access-token')
        response.cookies.delete('sb-refresh-token')
        
        // For public routes, allow access even with session errors
        if (isPublicRoute) {
          return response
        }
        
        // For protected routes, redirect to login
        return NextResponse.redirect(new URL('/login', request.url))
      }
      
      if (error) throw error
      session = data.session
    } catch (sessionError) {
      console.error('Session error:', sessionError)
      
      // If it's not a public route, redirect to login
      if (!isPublicRoute) {
        return NextResponse.redirect(new URL('/login', request.url))
      }
      
      // For public routes, allow access even with session errors
      return res
    }

    // Handle public routes
    if (isPublicRoute) {
      if (!session) {
        return res
      }

      // If logged in on public route, redirect to dashboard by default
      try {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single()

        // If user not found in users table but exists in auth
        if (userError && userError.code === 'PGRST116') {
          // Create the user record
          const { error: insertError } = await supabase
            .from('users')
            .insert({
              id: session.user.id,
              email: session.user.email,
              role: 'user',
              user_type: session.user.user_metadata?.user_type || 'other',
              first_name: session.user.user_metadata?.first_name || '',
              last_name: session.user.user_metadata?.last_name || ''
            })
          
          if (insertError) console.error('Error creating user record:', insertError)
          
          // Redirect to dashboard
          return NextResponse.redirect(new URL('/dashboard', request.url))
        }

        if (userError) throw userError

        const redirectUrl = new URL(
          userData?.role === 'admin' ? '/admin' : '/dashboard',
          request.url
        )
        return NextResponse.redirect(redirectUrl)
      } catch (error) {
        console.error('User data fetch error:', error)
        // If we can't get user data, redirect to dashboard
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }

    // Protected routes require session
    if ((isAdminRoute || isDashboardRoute) && !session) {
      console.log('No session found, redirecting to home')
      return NextResponse.redirect(new URL('/', request.url))
    }

    // Handle the fringe scenario where there's no current session
    try {
      // Role-based access control
      if (session && (isAdminRoute || isDashboardRoute)) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single()

        if (userError) {
          console.error('User data fetch error:', userError)
          // If we can't get user data, redirect to home page as a fallback
          return NextResponse.redirect(new URL('/', request.url))
        }

        // Admin routes protection
        if (isAdminRoute && userData?.role !== 'admin') {
          return NextResponse.redirect(new URL('/dashboard', request.url))
        }

        // Optional: Redirect admins from dashboard
        if (isDashboardRoute && userData?.role === 'admin') {
          return NextResponse.redirect(new URL('/admin', request.url))
        }
      }
    } catch (error) {
      console.error('Role check error:', error)
      // If we can't verify the role, redirect to home page as a fallback
      return NextResponse.redirect(new URL('/', request.url))
    }

    // Role-based access control
    if (session && (isAdminRoute || isDashboardRoute)) {
      try {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single()

        // If user not found in users table but exists in auth
        if (userError && userError.code === 'PGRST116') {
          // Create the user record
          const { error: insertError } = await supabase
            .from('users')
            .insert({
              id: session.user.id,
              email: session.user.email,
              role: 'user',
              user_type: session.user.user_metadata?.user_type || 'other',
              first_name: session.user.user_metadata?.first_name || '',
              last_name: session.user.user_metadata?.last_name || ''
            })
          
          if (insertError) {
            console.error('Error creating user record:', insertError)
            return NextResponse.redirect(new URL('/login', request.url))
          }
          
          // Admin routes protection - default new users are not admins
          if (isAdminRoute) {
            return NextResponse.redirect(new URL('/dashboard', request.url))
          }
          
          return res
        }

        if (userError) throw userError

        // Admin routes protection
        if (isAdminRoute && userData?.role !== 'admin') {
          return NextResponse.redirect(new URL('/dashboard', request.url))
        }

        // Optional: Redirect admins from dashboard
        if (isDashboardRoute && userData?.role === 'admin') {
          return NextResponse.redirect(new URL('/admin', request.url))
        }
      } catch (error) {
        console.error('Role check error:', error)
        // If we can't verify the role, redirect to dashboard (safer than giving admin access)
        if (isAdminRoute) {
          return NextResponse.redirect(new URL('/dashboard', request.url))
        }
        return res
      }
    }

    return res
  } catch (error) {
    console.error('Middleware error:', error)
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|images).*)',
  ]
}