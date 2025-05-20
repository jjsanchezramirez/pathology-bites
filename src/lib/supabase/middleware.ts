// src/lib/supabase/middleware.ts - Enhanced Auth Flow
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  // Get the current path and query parameters
  const path = request.nextUrl.pathname
  const searchParams = request.nextUrl.searchParams
  console.log(`Middleware processing: ${path}`)
  
  // Create a default response
  let response = NextResponse.next({
    request,
  })
  
  // CRITICAL: IMMEDIATELY BYPASS FOR CALLBACK AND VERIFICATION ENDPOINTS
  if (path.startsWith('/api/auth/callback') || path.includes('verify')) {
    console.log(`Auth callback/verification accessed: ${path} - bypassing middleware`)
    return response
  }
  
  // CRITICAL: SPECIAL HANDLING FOR AUTH PAGES
  const authPages = [
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
    '/verify-email',
    '/check-email',
    '/email-verified',
    '/auth-error',
    '/debug',
    '/debug/auth',
  ]
  
  // Also bypass middleware for static assets and API routes
  if (authPages.includes(path) || 
      path.startsWith('/api/') || 
      path.startsWith('/_next/') || 
      path.includes('.') ||
      path === '/favicon.ico') {
    console.log(`Auth/API/Static resource accessed: ${path} - allowing direct access`)
    return response
  }
  
  // Create Supabase client for auth check with improved cookie handling
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Update both the request cookies and response cookies
            request.cookies.set({ name, value, ...options })
            response = NextResponse.next({ request })
            response.cookies.set({ name, value, ...options })
          })
        },
      },
    }
  )
  
  // SECURITY IMPROVEMENT: Use getUser instead of getSession
  const { data: { user } } = await supabase.auth.getUser()
  
  // Process auth errors from URL query params (after redirects)
  if (searchParams.has('error') && searchParams.has('description')) {
    // Already on the auth error page or being redirected there, let it process
    if (path !== '/auth-error') {
      console.log('Auth error params detected, redirecting to auth-error page')
      const errorUrl = new URL('/auth-error', request.url)
      // Copy all query parameters to preserve error details
      searchParams.forEach((value, key) => {
        errorUrl.searchParams.set(key, value)
      })
      return NextResponse.redirect(errorUrl)
    }
  }
  
  // Check for auth errors in the URL hash (Supabase-specific)
  const url = request.nextUrl.clone()
  const hash = url.hash
  
  // Handle auth errors from hash fragments
  if (hash && hash.includes('error=') && hash.includes('error_code=')) {
    console.log('Detected auth error in hash, redirecting to auth-error page')
    
    const hashParams = new URLSearchParams(hash.substring(1))
    
    const errorUrl = new URL('/auth-error', request.url)
    errorUrl.searchParams.set('error', hashParams.get('error') || '')
    errorUrl.searchParams.set('code', hashParams.get('error_code') || '')
    errorUrl.searchParams.set('description', hashParams.get('error_description') || '')
    
    return NextResponse.redirect(errorUrl)
  }
  
  // Check for coming soon mode via environment variable
  const isComingSoonMode = process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true'
  
  // Determine user role for admin check
  let isAdmin = false
  if (user) {
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()
      
      isAdmin = userData?.role === 'admin'
    } catch (error) {
      console.error('Error checking admin status:', error)
    }
  }
  
  // Check if we should bypass coming soon mode
  const bypassParam = searchParams.get('bypass')
  const hasAdminAccess = bypassParam === 'true' || isAdmin
  
  // Process coming soon mode redirects with improved logic
  if (isComingSoonMode && 
      !user && // Authenticated users can bypass
      !hasAdminAccess && // Admins can bypass 
      path !== '/coming-soon' && // Don't redirect if already on coming soon page
      !path.startsWith('/api/') && // Don't redirect API routes
      !path.includes('.')) { // Don't redirect static files
    console.log(`Coming soon mode active, redirecting ${path} to /coming-soon`)
    return NextResponse.rewrite(new URL('/coming-soon', request.url))
  }
  
  // Define protected routes
  const authRoutes = ['/dashboard', '/profile', '/settings']
  const adminRoutes = ['/admin']
  
  // Simple path matching
  const isAuthRoute = authRoutes.some(route => path.startsWith(route))
  const isAdminRoute = adminRoutes.some(route => path.startsWith(route))
  
  // If user is not logged in and trying to access protected routes
  if (!user && (isAuthRoute || isAdminRoute)) {
    console.log(`Unauthenticated access to protected route ${path}, redirecting to login`)
    // Preserve the original URL to redirect back after login
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirect', path)
    return NextResponse.redirect(redirectUrl)
  }
  
  // If user is trying to access admin routes but isn't an admin
  if (user && isAdminRoute && !isAdmin) {
    console.log(`User ${user.id} attempted to access admin route without admin role`)
    const redirectUrl = new URL('/dashboard', request.url)
    return NextResponse.redirect(redirectUrl)
  }

  console.log(`Middleware completed for ${path}`)
  return response
}