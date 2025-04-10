// src/utils/supabase/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  })
  
  // Check for auth errors in the URL hash
  const url = request.nextUrl.clone()
  const hash = url.hash
  
  // If we have auth errors in the hash, redirect to our error page
  if (hash && hash.includes('error=') && hash.includes('error_code=')) {
    console.log('Detected auth error in hash, redirecting to auth-error page')
    
    // Extract the error info from the hash
    const hashParams = new URLSearchParams(hash.substring(1))
    
    // Create a proper URL with query params instead of hash
    const errorUrl = new URL('/auth-error', request.url)
    errorUrl.searchParams.set('error', hashParams.get('error') || '')
    errorUrl.searchParams.set('code', hashParams.get('error_code') || '')
    errorUrl.searchParams.set('description', hashParams.get('error_description') || '')
    
    return NextResponse.redirect(errorUrl)
  }
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )
  
  // Get authenticated user data - IMPORTANT: don't remove this
  const { data: { user } } = await supabase.auth.getUser()
  
  // Define protected routes - Similar to what you had before
  const authRoutes = ['/dashboard', '/profile', '/settings']
  const adminRoutes = ['/admin']
  const publicRoutes = [
    '/login', 
    '/signup', 
    '/forgot-password', 
    '/reset-password', 
    '/verify-email', 
    '/check-email', 
    '/email-verified',
    '/auth-error',
    '/api/auth/callback',
    '/api/auth/verify-email',
    '/debug'  // Keep debug page accessible
  ]
  
  const path = request.nextUrl.pathname
  const isAuthRoute = authRoutes.some(route => path.startsWith(route))
  const isAdminRoute = adminRoutes.some(route => path.startsWith(route))
  const isPublicRoute = publicRoutes.some(route => path === route || path.startsWith(route))
  
  // Special case for email verification flow
  const isEmailVerificationFlow = 
    path === '/email-verified' || 
    (path === '/api/auth/callback' && request.nextUrl.searchParams.get('type') === 'signup_confirmation') ||
    path === '/api/auth/verify-email' ||
    (path === '/email-verified' && request.nextUrl.searchParams.get('verified') === 'true')
  
  // IMPORTANT: Always allow access to email verification flow, even for authenticated users
  if (isEmailVerificationFlow) {
    return response
  }
  
  // If we have a user
  if (user) {
    // Check if they're attempting to access a public route (login/signup)
    // But exclude the email verification flow which we already handled above
    if (isPublicRoute && !isEmailVerificationFlow) {
      try {
        // Check user role from database
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single()

        if (userData?.role === 'admin') {
          // Redirect admins to admin dashboard
          const redirectUrl = new URL('/admin/dashboard', request.url)
          return NextResponse.redirect(redirectUrl)
        } else {
          // Redirect regular users to user dashboard
          const redirectUrl = new URL('/dashboard', request.url)
          return NextResponse.redirect(redirectUrl)
        }
      } catch (error) {
        console.error('Error fetching user role:', error)
        const redirectUrl = new URL('/dashboard', request.url)
        return NextResponse.redirect(redirectUrl)
      }
    }
    
    // If user is trying to access admin routes but isn't an admin
    if (isAdminRoute) {
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single()

        if (userData?.role !== 'admin') {
          const redirectUrl = new URL('/dashboard', request.url)
          return NextResponse.redirect(redirectUrl)
        }
      } catch (error) {
        console.error('Error fetching user role:', error)
        const redirectUrl = new URL('/dashboard', request.url)
        return NextResponse.redirect(redirectUrl)
      }
    }
  } else if (!user && (isAuthRoute || isAdminRoute)) {
    // If no user is logged in and they're trying to access protected routes
    const redirectUrl = new URL('/login', request.url)
    return NextResponse.redirect(redirectUrl)
  }

  return response
}