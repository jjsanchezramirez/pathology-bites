// src/utils/supabase/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
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
    '/api/auth/callback'
  ]
  
  const path = request.nextUrl.pathname
  const isAuthRoute = authRoutes.some(route => path.startsWith(route))
  const isAdminRoute = adminRoutes.some(route => path.startsWith(route))
  const isPublicRoute = publicRoutes.some(route => path === route)

  // If we have a user
  if (user) {
    // Check if they're attempting to access a public route (login/signup)
    if (isPublicRoute) {
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