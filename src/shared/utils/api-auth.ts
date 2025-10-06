// Authentication Middleware
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export interface AuthResult {
  isAuthenticated: boolean
  user?: any
  isAdmin?: boolean
  response?: NextResponse
}

export async function requireAuth(request: NextRequest): Promise<AuthResult> {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set() {}, // Not needed for server-side auth check
          remove() {} // Not needed for server-side auth check
        }
      }
    )

    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return {
        isAuthenticated: false,
        response: NextResponse.json(
          { 
            success: false, 
            error: 'Authentication required' 
          },
          { status: 401 }
        )
      }
    }

    return {
      isAuthenticated: true,
      user
    }
  } catch (error) {
    return {
      isAuthenticated: false,
      response: NextResponse.json(
        { 
          success: false, 
          error: 'Authentication failed' 
        },
        { status: 401 }
      )
    }
  }
}

export async function requireAdmin(request: NextRequest): Promise<AuthResult> {
  const authResult = await requireAuth(request)
  
  if (!authResult.isAuthenticated) {
    return authResult
  }

  // Check if user has admin role
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set() {},
        remove() {}
      }
    }
  )

  const { data: profile, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', authResult.user.id)
    .single()

  if (error || profile?.role !== 'admin') {
    return {
      isAuthenticated: true,
      user: authResult.user,
      isAdmin: false,
      response: NextResponse.json(
        { 
          success: false, 
          error: 'Admin privileges required' 
        },
        { status: 403 }
      )
    }
  }

  return {
    isAuthenticated: true,
    user: authResult.user,
    isAdmin: true
  }
}

// Usage example:
/*
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth.isAuthenticated) {
    return auth.response!
  }
  
  // User is authenticated, proceed with endpoint logic
  const user = auth.user
  // ...
}
*/