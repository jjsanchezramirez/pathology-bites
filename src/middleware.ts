import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

export async function middleware(request: NextRequest) {
  try {
    // Create response and client
    const res = NextResponse.next()
    const supabase = createMiddlewareClient({ req: request, res })
    
    const pathname = request.nextUrl.pathname

    // Auth callback bypass
    if (pathname === 'api/auth/callback') {
      return res
    }

    // Get session
    const {
      data: { session },
      error: sessionError
    } = await supabase.auth.getSession()

    // If there's a session error, log and redirect to login
    if (sessionError) {
      console.error('Session error:', sessionError)
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Define routes
    const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/')
    const isDashboardRoute = pathname === '/dashboard' || pathname.startsWith('/dashboard/')
    const isPublicRoute = ['/login', '/signup', '/reset-password'].includes(pathname)

    // Handle public routes
    if (isPublicRoute) {
      if (!session) {
        return res
      }

      // If logged in on public route, redirect based on role
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single()

      const redirectUrl = new URL(
        userData?.role === 'admin' ? '/admin' : '/dashboard',
        request.url
      )
      return NextResponse.redirect(redirectUrl)
    }

    // Protected routes require session
    if ((isAdminRoute || isDashboardRoute) && !session) {
      console.log('No session found, redirecting to login')
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Role-based access control
    if (session && (isAdminRoute || isDashboardRoute)) {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single()

      if (userError) {
        console.error('User role check error:', userError)
        return NextResponse.redirect(new URL('/login', request.url))
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

    return res
  } catch (error) {
    console.error('Middleware error:', error)
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: [
    '/admin',
    '/admin/:path*',
    '/dashboard',
    '/dashboard/:path*',
    '/login',
    '/signup',
    '/reset-password',
    '/api/auth/callback'
  ]
}