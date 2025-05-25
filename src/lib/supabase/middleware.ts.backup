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
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()
      
      if (userData?.role !== 'admin') {
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

  return supabaseResponse
}