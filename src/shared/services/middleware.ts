// lib/supabase/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Cache for user role lookups to prevent race conditions
const roleCache = new Map<string, { role: string; timestamp: number }>()
const ROLE_CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const processingRequests = new Set<string>()

export async function updateSession(request: NextRequest) {
  // CRITICAL: Immediately return for all API routes to avoid interference
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // ULTRA-FAST: Check maintenance/coming soon modes without any setup
  const isMaintenanceMode = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true'
  const isComingSoonMode = process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true'
  
  // Skip all auth setup if not in special modes and path is admin/dashboard
  if (!isMaintenanceMode && !isComingSoonMode) {
    // For dashboard and admin paths, we need auth - but skip everything else
    if (!request.nextUrl.pathname.startsWith('/dashboard') && !request.nextUrl.pathname.startsWith('/admin')) {
      return NextResponse.next()
    }
  }

  try {

    // Simple redirect helper
    function redirect(pathname: string) {
      const url = request.nextUrl.clone()
      url.pathname = pathname
      url.search = ''
      return NextResponse.redirect(url)
    }

    // Set up Supabase ONLY when absolutely needed
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

    // Get user for protected routes
    const { data: { user } } = await supabase.auth.getUser()

    // Ultra-simple maintenance mode (since matcher is now minimal)
    if (isMaintenanceMode && !request.nextUrl.pathname.startsWith('/admin')) {
      return redirect('/maintenance')
    }



    // Ultra-simple auth check (matcher only includes dashboard/admin)
    if (!user) {
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
        return redirect('/dashboard')
      }
    }

    // Redirect admin/creator/reviewer users from /dashboard to /admin/dashboard
    if (request.nextUrl.pathname === '/dashboard' && user) {
      try {
        // First try user metadata for speed
        const metadataRole = user.user_metadata?.role || user.app_metadata?.role

        if (metadataRole === 'admin' || metadataRole === 'creator' || metadataRole === 'reviewer') {
          return redirect('/admin/dashboard')
        }

        // Check database role
        const userRole = await getUserRoleWithCache(user.id, user, supabase)
        if (userRole === 'admin' || userRole === 'creator' || userRole === 'reviewer') {
          return redirect('/admin/dashboard')
        }
      } catch (error) {
        // Silent error handling
      }
    }

    return supabaseResponse
  } catch (error) {
    // Silent error handling - just allow request to proceed
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
      return 'user' // Default fallback
    }

    const dbRole = data?.role || 'user'

    // Cache the database role
    roleCache.set(userId, { role: dbRole, timestamp: Date.now() })

    return dbRole
  } catch (error) {
    return 'user' // Default fallback
  } finally {
    // Remove from processing set
    processingRequests.delete(userId)
  }
}
