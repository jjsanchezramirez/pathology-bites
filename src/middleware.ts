// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value
        },
        set(name, value, options) {
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name, options) {
          response.cookies.set({
            name,
            value: '',
            ...options,
            maxAge: 0,
          })
        }
      }
    }
  )

  // Get the session and user properly
  const { data: { session } } = await supabase.auth.getSession()
  
  // Get authenticated user data (this is the proper way according to the warning)
  const { data: { user } } = await supabase.auth.getUser()

  // Define protected routes
  const authRoutes = ['/dashboard', '/profile', '/settings']
  const adminRoutes = ['/admin']
  const publicRoutes = ['/login', '/signup', '/forgot-password', '/reset-password', '/verify-email', '/check-email', '/email-verified']
  
  const path = request.nextUrl.pathname
  const isAuthRoute = authRoutes.some(route => path.startsWith(route))
  const isAdminRoute = adminRoutes.some(route => path.startsWith(route))
  const isPublicRoute = publicRoutes.some(route => path === route)

  // If logged in but trying to access public routes (login/signup)
  if (user && isPublicRoute) {
    try {
      // Check user role
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      if (userData?.role === 'admin') {
        return NextResponse.redirect(new URL('/admin/dashboard', request.url))
      } else {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    } catch (error) {
      console.error('Error fetching user role:', error)
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // If not logged in but trying to access protected routes
  if (!user && (isAuthRoute || isAdminRoute)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // If trying to access admin routes without admin role
  if (user && isAdminRoute) {
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      if (userData?.role !== 'admin') {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    } catch (error) {
      console.error('Error fetching user role:', error)
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}