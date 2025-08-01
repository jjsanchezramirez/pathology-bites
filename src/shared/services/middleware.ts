// lib/supabase/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Cache for user role lookups to prevent race conditions
const roleCache = new Map<string, { role: string; timestamp: number }>()
const ROLE_CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const processingRequests = new Set<string>()

export async function updateSession(request: NextRequest) {
  console.log(`[Middleware] Processing: ${request.nextUrl.pathname}`)

  // CRITICAL: Immediately return for all API routes to avoid interference
  if (request.nextUrl.pathname.startsWith('/api/')) {
    console.log('API route detected, bypassing middleware:', request.nextUrl.pathname)
    return NextResponse.next()
  }

  try {
    // Check for dev bypass first - if enabled, allow everything
    const bypassParam = request.nextUrl.searchParams.get('bypass')
    const isDevBypass = process.env.NODE_ENV !== 'production' && bypassParam === 'true'

    if (isDevBypass) {
      console.log(`[Middleware] Dev bypass enabled for: ${request.nextUrl.pathname}`)
      return NextResponse.next()
    }

    const isMaintenanceMode = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true'
    const isComingSoonMode = process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true'

    console.log(`[Middleware] Maintenance: ${isMaintenanceMode}, Coming Soon: ${isComingSoonMode}`)

    // Simple redirect helper
    function redirect(pathname: string) {
      const url = request.nextUrl.clone()
      url.pathname = pathname
      url.search = ''
      return NextResponse.redirect(url)
    }

    // Set up Supabase for auth checks (needed for debug panel protection)
    let supabaseResponse = NextResponse.next({ request })

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
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    // Get user for protected route checks
    const { data: { user } } = await supabase.auth.getUser()

    // Special handling for debug interface - disable in production
    if (request.nextUrl.pathname.startsWith('/debug')) {
      if (process.env.NODE_ENV === 'production') {
        return redirect('/404')
      }
    }

    // Maintenance mode: block everything except essentials
    if (isMaintenanceMode) {
      const allowedPaths = [
        '/maintenance',
        '/login',
        '/dashboard',
        '/admin',
        '/api/',
        '/_next/',
        '/favicon.ico'
      ]

      const isAllowed = request.nextUrl.pathname === '/' ||
                       allowedPaths.some(path => request.nextUrl.pathname.startsWith(path))

      console.log(`[Middleware] Path: ${request.nextUrl.pathname}, Allowed: ${isAllowed}`)

      if (!isAllowed) {
        console.log(`[Middleware] Maintenance mode blocking: ${request.nextUrl.pathname}`)
        return redirect('/maintenance')
      }
    }

    // Block signup paths in both coming soon and maintenance modes
    if (isComingSoonMode || isMaintenanceMode) {
      const signupPaths = ['/signup', '/verify-email', '/check-email', '/email-verified', '/email-already-verified']
      const isSignupPath = signupPaths.some(path =>
        request.nextUrl.pathname.startsWith(path)
      )

      if (isSignupPath) {
        console.log(`[Middleware] Blocking signup path: ${request.nextUrl.pathname}`)
        return redirect('/login')
      }
    }



    // Protected routes that require authentication
    const protectedPaths = ['/dashboard', '/admin', '/quiz', '/profile', '/settings']
    const isProtectedPath = protectedPaths.some(path =>
      request.nextUrl.pathname.startsWith(path)
    )

    // Redirect unauthenticated users from protected routes
    if (isProtectedPath && !user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.search = ''
      url.searchParams.set('redirect', request.nextUrl.pathname)
      return NextResponse.redirect(url)
    }

    // Check user role for admin routes
    if (request.nextUrl.pathname.startsWith('/admin') && user) {
      const userRole = await getUserRoleWithCache(user.id, user, supabase)

      if (userRole !== 'admin' && userRole !== 'creator' && userRole !== 'reviewer') {
        console.log('User is not admin, creator, or reviewer, redirecting. Role:', userRole)
        return redirect('/dashboard')
      }
      console.log('Admin/Creator/Reviewer access granted:', userRole)
    }

    // Redirect admin/creator/reviewer users from /dashboard to /admin/dashboard
    if (request.nextUrl.pathname === '/dashboard' && user) {
      try {
        // First try user metadata for speed
        const metadataRole = user.user_metadata?.role || user.app_metadata?.role

        if (metadataRole === 'admin' || metadataRole === 'creator' || metadataRole === 'reviewer') {
          console.log('Redirecting admin/creator/reviewer user from dashboard to admin dashboard (metadata)')
          return redirect('/admin/dashboard')
        }

        // Check database role
        const userRole = await getUserRoleWithCache(user.id, user, supabase)
        if (userRole === 'admin' || userRole === 'creator' || userRole === 'reviewer') {
          console.log('Redirecting admin/creator/reviewer user from dashboard to admin dashboard (database)')
          return redirect('/admin/dashboard')
        }
      } catch (error) {
        console.error('Error checking role for dashboard redirect:', error)
      }
    }

    return supabaseResponse
  } catch (error) {
    console.error('[Middleware] Error processing request:', error)

    // Handle auth timeouts gracefully
    if (error instanceof Error && error.message.includes('timeout')) {
      console.log('[Middleware] Auth timeout detected, allowing request to proceed')
      return NextResponse.next()
    }

    // For other errors, allow the request to proceed to avoid breaking the app
    console.log('[Middleware] Allowing request to proceed despite error')
    return NextResponse.next()
  }
}

// Helper function to get user role with caching and race condition prevention
async function getUserRoleWithCache(userId: string, user: any, supabase: any): Promise<string> {
  // Check if we're already processing this user's role
  if (processingRequests.has(userId)) {
    // Wait a bit and check cache again
    await new Promise(resolve => setTimeout(resolve, 100))
    const cached = roleCache.get(userId)
    if (cached && (Date.now() - cached.timestamp) < ROLE_CACHE_TTL) {
      return cached.role
    }
    // If still processing or cache expired, fall through to database query
  }

  // Check cache first
  const cached = roleCache.get(userId)
  if (cached && (Date.now() - cached.timestamp) < ROLE_CACHE_TTL) {
    return cached.role
  }

  // Mark as processing to prevent race conditions
  processingRequests.add(userId)

  try {
    // First try to get role from user metadata (fastest)
    const metadataRole = user?.user_metadata?.role || user?.app_metadata?.role
    if (metadataRole && ['admin', 'creator', 'reviewer', 'user'].includes(metadataRole)) {
      // Cache the metadata role
      roleCache.set(userId, { role: metadataRole, timestamp: Date.now() })
      return metadataRole
    }

    // Fallback to database query
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error fetching user role from database:', error)
      return 'user' // Default fallback
    }

    const dbRole = data?.role || 'user'

    // Cache the database role
    roleCache.set(userId, { role: dbRole, timestamp: Date.now() })

    return dbRole
  } catch (error) {
    console.error('Error in getUserRoleWithCache:', error)
    return 'user' // Default fallback
  } finally {
    // Remove from processing set
    processingRequests.delete(userId)
  }
}
