// src/lib/supabase/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  try {
    const path = request.nextUrl.pathname
    const searchParams = request.nextUrl.searchParams
    console.log(`Middleware processing: ${path}`)
    
    // CRITICAL: IMMEDIATELY BYPASS FOR CALLBACK AND VERIFICATION ENDPOINTS
    if (path.startsWith('/api/auth/callback') || path.includes('verify')) {
      console.log(`Auth callback/verification accessed: ${path} - bypassing middleware`)
      return NextResponse.next()
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
      '/debug/auth/test',
    ]
    
    // Also bypass middleware for static assets and API routes
    if (authPages.includes(path) || 
        path.startsWith('/api/') || 
        path.startsWith('/_next/') || 
        path.includes('.') ||
        path === '/favicon.ico') {
      console.log(`Auth/API/Static resource accessed: ${path} - allowing direct access`)
      return NextResponse.next()
    }
    
    // Initialize response - FIXED: use const instead of let
    const response = NextResponse.next()
    
    // Create Supabase client
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name) {
            return request.cookies.get(name)?.value
          },
          set(name, value, options) {
            // CRITICAL: Only set cookies on the response
            response.cookies.set({
              name,
              value,
              ...options,
            })
          },
          remove(name, options) {
            // CRITICAL: Only remove cookies from the response
            response.cookies.set({
              name,
              value: '',
              ...options,
            })
          },
        },
      }
    )
    
    // Get user session
    const { data } = await supabase.auth.getSession()
    
    // Log all cookies for debugging
    const authCookies = request.cookies.getAll().filter(
      cookie => cookie.name.startsWith('sb-') || cookie.name.includes('supabase')
    )
    
    // Debug output to check cookie state
    console.log("Auth check result:", {
      hasSession: !!data.session,
      userId: data.session?.user?.id || 'none',
      cookies: authCookies.map(c => c.name).join(', '),
      cookieCount: authCookies.length
    })
    
    // Process auth errors from URL query params
    if (searchParams.has('error') && searchParams.has('description')) {
      if (path !== '/auth-error') {
        console.log('Auth error params detected, redirecting to auth-error page')
        const errorUrl = new URL('/auth-error', request.url)
        searchParams.forEach((value, key) => {
          errorUrl.searchParams.set(key, value)
        })
        return NextResponse.redirect(errorUrl)
      }
    }
    
    // Check for coming soon mode
    const isComingSoonMode = process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true'
    
    // Determine user role for admin check
    let isAdmin = false
    if (data.session?.user) {
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', data.session.user.id)
          .single()
        
        isAdmin = userData?.role === 'admin'
      } catch (error) {
        console.error('Error checking admin status:', error)
      }
    }
    
    // Check bypass flags
    const bypassParam = searchParams.get('bypass')
    const hasAdminAccess = bypassParam === 'true' || isAdmin
    
    // Process coming soon mode redirects
    if (isComingSoonMode && 
        !data.session?.user && 
        !hasAdminAccess && 
        path !== '/coming-soon' && 
        !path.startsWith('/api/') && 
        !path.includes('.')) {
      console.log(`Coming soon mode active, redirecting ${path} to /coming-soon`)
      return NextResponse.rewrite(new URL('/coming-soon', request.url))
    }
    
    // Define protected routes
    const authRoutes = ['/dashboard', '/profile', '/settings']
    const adminRoutes = ['/admin']
    
    // Route matching
    const isAuthRoute = authRoutes.some(route => path.startsWith(route))
    const isAdminRoute = adminRoutes.some(route => path.startsWith(route))
    
    // Auth-required route protection
    if (!data.session?.user && (isAuthRoute || isAdminRoute)) {
      console.log(`Unauthenticated access to protected route ${path}, redirecting to login`)
      const redirectUrl = new URL('/login', request.url)
      const cleanPath = path.replace(/\?$/, '')
      redirectUrl.searchParams.set('redirect', cleanPath)
      
      // Debug output
      console.log(`Redirecting to login with: ${redirectUrl.toString()}`)
      
      return NextResponse.redirect(redirectUrl)
    }
    
    // Admin route protection
    if (data.session?.user && isAdminRoute && !isAdmin) {
      console.log(`User ${data.session.user.id} attempted to access admin route without admin role`)
      const redirectUrl = new URL('/dashboard', request.url)
      return NextResponse.redirect(redirectUrl)
    }
    
    console.log(`Middleware completed for ${path}`)
    return response
  } catch (error) {
    console.error('Middleware error:', error)
    // Fall through to next handler when there's an error
    return NextResponse.next()
  }
}