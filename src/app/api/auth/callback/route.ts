// src/app/api/auth/callback/route.ts
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    const type = requestUrl.searchParams.get('type')
    const next = requestUrl.searchParams.get('next')
    
    if (!code) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    
    // Create a response object to handle cookies properly
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
    
    // Exchange code for session
    await supabase.auth.exchangeCodeForSession(code)
    
    // Get authenticated user data properly
    const { data: { user } } = await supabase.auth.getUser()
    
    // Handle different callback types
    if (type === 'recovery') {
      response = NextResponse.redirect(new URL('/reset-password', request.url))
      return response
    }

    if (type === 'signup_confirmation') {
      response = NextResponse.redirect(new URL(next || '/email-verified', request.url))
      return response
    }
    
    // Check if user is admin (only if we have a user)
    if (user) {
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()
      
      // Redirect based on role
      if (userData?.role === 'admin') {
        response = NextResponse.redirect(new URL('/admin/dashboard', request.url))
      } else {
        response = NextResponse.redirect(new URL('/dashboard', request.url))
      }
    } else {
      response = NextResponse.redirect(new URL('/dashboard', request.url))
    }
    
    return response
  } catch (error) {
    console.error('Auth callback error:', error)
    return NextResponse.redirect(new URL('/login?error=unexpected', request.url))
  }
}