// lib/supabase/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  // CRITICAL: Immediately return for all API routes to avoid interference
  if (request.nextUrl.pathname.startsWith('/api/')) {
    console.log('API route detected, bypassing middleware:', request.nextUrl.pathname)
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: DO NOT REMOVE auth.getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Define auth pages that don't require authentication
  const authPages = [
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
    '/verify-email',
    '/check-email',
    '/auth-error',
    '/email-verified',
    '/email-already-verified',
    '/password-reset-success',
    '/auth/confirm' // Add this line to allow the auth confirm route
  ]

  const isAuthPage = authPages.some(page =>
    request.nextUrl.pathname.startsWith(page)
  )

  // Allow access to auth pages, static files, and root
  if (isAuthPage ||
      request.nextUrl.pathname.startsWith('/_next/') ||
      request.nextUrl.pathname.includes('.') ||
      request.nextUrl.pathname === '/') {
    return supabaseResponse
  }

  // Redirect unauthenticated users to login for protected routes
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  // Check user role for admin routes
  if (request.nextUrl.pathname.startsWith('/admin')) {
    try {
      // First try to get role from user metadata
      const userRole = user.user_metadata?.role || user.app_metadata?.role

      if (userRole === 'admin') {
        // User has admin role in metadata, allow access
        console.log('Admin access granted via metadata')
        return supabaseResponse
      }

      // Query users table to check role
      const { data: userData, error: roleError } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      if (roleError) {
        console.error('Role check error:', roleError)
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }

      if (userData?.role === 'admin') {
        // User is admin in database, allow access
        console.log('Admin access granted via database:', userData)
        return supabaseResponse
      } else {
        // User is not admin, redirect to dashboard
        console.log('User is not admin, redirecting. Role:', userData?.role)
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    } catch (error) {
      console.error('Error checking admin role:', error)
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  // Redirect non-admin users from /dashboard to /admin/dashboard if they are admin
  if (request.nextUrl.pathname === '/dashboard') {
    try {
      // First try to get role from user metadata
      const userRole = user.user_metadata?.role || user.app_metadata?.role

      if (userRole === 'admin') {
        // User has admin role in metadata, redirect to admin dashboard
        console.log('Redirecting admin user from dashboard to admin dashboard (metadata)')
        const url = request.nextUrl.clone()
        url.pathname = '/admin/dashboard'
        return NextResponse.redirect(url)
      }

      // Query users table to check role
      const { data: userData, error: roleError } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!roleError && userData?.role === 'admin') {
        // User is admin in database, redirect to admin dashboard
        console.log('Redirecting admin user from dashboard to admin dashboard (database)')
        const url = request.nextUrl.clone()
        url.pathname = '/admin/dashboard'
        return NextResponse.redirect(url)
      }
    } catch (error) {
      console.error('Error checking role for dashboard redirect:', error)
      // Continue to regular dashboard on error
    }
  }

  return supabaseResponse
}