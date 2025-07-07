// lib/supabase/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Cache for user role lookups to prevent race conditions
const roleCache = new Map<string, { role: string; timestamp: number }>()
const ROLE_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Request tracking to prevent concurrent processing of same user
const processingRequests = new Set<string>()

export async function updateSession(request: NextRequest) {
  // CRITICAL: Immediately return for all API routes to avoid interference
  if (request.nextUrl.pathname.startsWith('/api/')) {
    console.log('API route detected, bypassing middleware:', request.nextUrl.pathname)
    return NextResponse.next()
  }

  // Create a unique request identifier to prevent race conditions
  const requestId = `${request.nextUrl.pathname}-${Date.now()}-${Math.random()}`

  try {

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
    // Add timeout to prevent hanging requests
    const userPromise = supabase.auth.getUser()
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Auth timeout')), 5000)
    )

    const {
      data: { user },
    } = await Promise.race([userPromise, timeoutPromise]) as any

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
    '/link-expired', // Add link expired page
    '/auth/confirm' // Add this line to allow the auth confirm route
  ]

  // In Coming Soon mode, block signup pages unless bypass is enabled
  const signupPages = ['/signup', '/verify-email', '/check-email', '/email-verified', '/email-already-verified']
  const isSignupPage = signupPages.some(page =>
    request.nextUrl.pathname.startsWith(page)
  )

  const isAuthPage = authPages.some(page =>
    request.nextUrl.pathname.startsWith(page)
  )

  // Check for bypass parameter in URL
  const bypassParam = request.nextUrl.searchParams.get('bypass')
  const isComingSoonMode = process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true'

  // Define public routes that don't require authentication
  const publicRoutes = [
    '/',
    '/coming-soon',
    '/debug', // Debug pages (including bypass and demo-comparison)
    '/about',
    '/contact',
    '/faq',
    '/privacy',
    '/terms'
  ]

  // Define protected routes that require authentication
  const protectedRoutes = [
    '/dashboard',
    '/admin',
    '/quiz',
    '/profile',
    '/settings'
  ]

  const isPublicRoute = publicRoutes.some(route =>
    request.nextUrl.pathname === route || request.nextUrl.pathname.startsWith(route + '/')
  )

  const isProtectedRoute = protectedRoutes.some(route =>
    request.nextUrl.pathname.startsWith(route)
  )

  // In Coming Soon mode, block signup pages unless bypass is enabled
  if (isComingSoonMode && isSignupPage && bypassParam !== 'true') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Allow access to auth pages, static files, and public routes
  if (isAuthPage ||
      request.nextUrl.pathname.startsWith('/_next/') ||
      request.nextUrl.pathname.includes('.') ||
      isPublicRoute ||
      (isComingSoonMode && bypassParam === 'true')) {
    return supabaseResponse
  }

  // For protected routes, redirect unauthenticated users to login
  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  // For all other routes (including unknown routes), let them pass through
  // This allows Next.js to handle 404 pages properly
  if (!isProtectedRoute) {
    return supabaseResponse
  }

    // Check user role for admin routes
    if (request.nextUrl.pathname.startsWith('/admin')) {
      const userRole = await getUserRoleWithCache(user.id, user, supabase)

      if (userRole === 'admin' || userRole === 'creator' || userRole === 'reviewer') {
        console.log('Admin/Creator/Reviewer access granted:', userRole)
        return supabaseResponse
      } else {
        console.log('User is not admin, creator, or reviewer, redirecting. Role:', userRole)
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    }

  // Redirect non-admin/reviewer users from /dashboard to /admin/dashboard if they are admin or reviewer
  if (request.nextUrl.pathname === '/dashboard') {
    try {
      // First try to get role from user metadata
      const userRole = user.user_metadata?.role || user.app_metadata?.role

      if (userRole === 'admin' || userRole === 'creator' || userRole === 'reviewer') {
        // User has admin, creator, or reviewer role in metadata, redirect to admin dashboard
        console.log('Redirecting admin/creator/reviewer user from dashboard to admin dashboard (metadata)')
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

      if (!roleError && (userData?.role === 'admin' || userData?.role === 'creator' || userData?.role === 'reviewer')) {
        // User is admin, creator, or reviewer in database, redirect to admin dashboard
        console.log('Redirecting admin/creator/reviewer user from dashboard to admin dashboard (database)')
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
  } catch (error) {
    console.error('Middleware error:', error)

    // For auth timeouts or errors, allow the request to proceed
    // but log the issue for monitoring
    if (error instanceof Error && error.message === 'Auth timeout') {
      console.warn('Auth timeout in middleware, allowing request to proceed')
    }

    // Return a basic response to prevent middleware from blocking the app
    return NextResponse.next({
      request,
    })
  }
}

// Helper function to get user role with caching to prevent race conditions
async function getUserRoleWithCache(userId: string, user: any, supabase: any): Promise<string> {
  // Check cache first
  const cached = roleCache.get(userId)
  if (cached && Date.now() - cached.timestamp < ROLE_CACHE_TTL) {
    return cached.role
  }

  // Prevent concurrent requests for the same user
  const requestKey = `role-${userId}`
  if (processingRequests.has(requestKey)) {
    // Wait a bit and try cache again
    await new Promise(resolve => setTimeout(resolve, 100))
    const retryCache = roleCache.get(userId)
    if (retryCache) {
      return retryCache.role
    }
    // Fallback to 'user' if still processing
    return 'user'
  }

  try {
    processingRequests.add(requestKey)

    // First try to get role from user metadata (faster)
    const metadataRole = user.user_metadata?.role || user.app_metadata?.role
    if (metadataRole === 'admin' || metadataRole === 'creator' || metadataRole === 'reviewer') {
      // Cache and return metadata role
      roleCache.set(userId, {
        role: metadataRole,
        timestamp: Date.now()
      })
      return metadataRole
    }

    // Query users table to check role with timeout
    const rolePromise = supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Role query timeout')), 3000)
    )

    const { data: userData, error: roleError } = await Promise.race([
      rolePromise,
      timeoutPromise
    ]) as any

    if (roleError) {
      console.error('Role check error:', roleError)
      return 'user' // Default to user role on error
    }

    const role = userData?.role || 'user'

    // Cache the result
    roleCache.set(userId, {
      role,
      timestamp: Date.now()
    })

    // Clean up old cache entries periodically
    if (roleCache.size > 1000) {
      const now = Date.now()
      for (const [key, value] of roleCache.entries()) {
        if (now - value.timestamp > ROLE_CACHE_TTL) {
          roleCache.delete(key)
        }
      }
    }

    return role
  } catch (error) {
    console.error('Error getting user role:', error)
    return 'user' // Default to user role on error
  } finally {
    processingRequests.delete(requestKey)
  }
}