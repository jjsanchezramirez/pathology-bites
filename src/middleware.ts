// src/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

export async function middleware(request: NextRequest) {
  const res = NextResponse.next()

  try {
    const supabase = createMiddlewareClient({ req: request, res })
    const { data: { session } } = await supabase.auth.getSession()
    const pathname = request.nextUrl.pathname

    console.log('Current pathname:', pathname)
    console.log('Session exists:', !!session)

    // Handle auth callback with PKCE flow
    if (pathname === '/auth/callback') {
      const code = request.nextUrl.searchParams.get('code')
      const next = request.nextUrl.searchParams.get('next') || '/dashboard'
      
      if (code) {
        return res
      }

      if (request.nextUrl.searchParams.get('type') === 'recovery') {
        return NextResponse.redirect(new URL('/reset-password', request.url))
      }

      return NextResponse.redirect(new URL(next, request.url))
    }

    // Allow access to reset-password page
    if (pathname === '/reset-password') {
      return res
    }

    // Regular auth protection
    if (!session) {
      if (pathname.startsWith('/dashboard') || pathname.startsWith('/admin')) {
        return NextResponse.redirect(new URL('/login', request.url))
      }
    } else {
      // Check admin routes BEFORE any other redirects
      if (pathname.startsWith('/admin')) {
        // Get user role from the users table
        const { data: userData, error } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single()

        console.log('Admin check - User data:', userData)
        console.log('Admin check - Error:', error)

        // If not admin, redirect to dashboard
        if (!userData || userData.role !== 'admin') {
          console.log('Not admin, redirecting to dashboard')
          return NextResponse.redirect(new URL('/dashboard', request.url))
        }
        
        // If admin, allow access by continuing to res
        console.log('Admin access granted')
      }

      // Handle other authenticated routes
      if (pathname === '/login' || pathname === '/signup') {
        return NextResponse.redirect(new URL('/dashboard', request.url))
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
    '/dashboard/:path*',
    '/admin/:path*',
    '/login',
    '/signup',
    '/auth/callback',
    '/reset-password',
  ]
}