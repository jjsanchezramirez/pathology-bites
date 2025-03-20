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
    if (pathname.includes('/api/auth/callback') || pathname === '/') {
      return res
    }

    // Define routes for easier checking
    const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/')
    const isDashboardRoute = pathname === '/dashboard' || pathname.startsWith('/dashboard/')
    const isPublicRoute = ['/login', '/signup', '/forgot-password', '/reset-password', '/verify-email', '/check-email', '/email-verified'].includes(pathname)

    // Get session with error handling
    let session;
    try {
      const { data, error } = await supabase.auth.getSession()
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

      // If logged in on public route, redirect based on role
      try {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single()

        if (userError) throw userError

        const redirectUrl = new URL(
          userData?.role === 'admin' ? '/admin' : '/dashboard',
          request.url
        )
        return NextResponse.redirect(redirectUrl)
      } catch (error) {
        console.error('User data fetch error:', error)
        // If we can't get user data, just continue to the requested page
        return res
      }
    }

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
        // If we can't verify the role, redirect to login as a fallback
        return NextResponse.redirect(new URL('/login', request.url))
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