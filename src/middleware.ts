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
      '/',
      '/api/auth/callback'
    ].includes(pathname) || 
      pathname.startsWith('/api/auth/callback') ||
      pathname.startsWith('/api/auth/login')  // Add this to exempt the login API

    // Skip session validation completely for public routes
    if (isPublicRoute) {
      return res
    }

    // For protected routes, get the session with better error handling
    let session
    try {
      const { data, error } = await supabase.auth.getSession()
      
      if (error) {
        // For any auth error on protected routes, redirect to login
        console.log('Auth error:', error.message)
        return NextResponse.redirect(new URL('/login', request.url))
      }
      
      session = data.session
    } catch (error) {
      console.error('Session error:', error)
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Add debug logging to see session details
    console.log('Session found:', !!session)
    
    // Protected routes require session
    if ((isAdminRoute || isDashboardRoute) && !session) {
      console.log('No session found, redirecting to login')
      return NextResponse.redirect(new URL('/login', request.url))
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