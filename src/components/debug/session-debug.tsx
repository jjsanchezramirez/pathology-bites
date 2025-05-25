// src/components/debug/session-debug.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Session, User, AuthError } from '@supabase/supabase-js'

interface AuthUserResponse {
  user: User | null
}

interface AuthSessionResponse {
  session: Session | null
}

interface RefreshResult {
  data: {
    user: User | null
    session: Session | null
  } | null
  error: AuthError | null
}

interface DebugInfo {
  loading?: boolean
  user?: User | null
  session?: Session | null
  error?: AuthError | null
  cookies?: string[]
  userMethod?: AuthUserResponse
  sessionMethod?: AuthSessionResponse
  authListener?: string
  refreshResult?: RefreshResult
}

export function SessionDebugComponent() {
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({ loading: true })

  useEffect(() => {
    const supabase = createClient()
    
    console.log('🔍 Client Debug: Starting session check...')
    
    // Check cookies manually
    const allCookies = document.cookie.split(';').map(c => c.trim())
    const supabaseCookies = allCookies.filter(c => c.includes('sb-'))
    
    console.log('🍪 All cookies found:', allCookies.length)
    console.log('🍪 Supabase cookies:', supabaseCookies)

    async function checkAuth() {
      try {
        // Method 1: getUser()
        console.log('🔍 Method 1: Checking getUser()...')
        const { data: userData, error: userError } = await supabase.auth.getUser()
        console.log('👤 getUser result:', { user: userData.user, error: userError })

        // Method 2: getSession() 
        console.log('🔍 Method 2: Checking getSession()...')
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        console.log('🔐 getSession result:', { session: sessionData.session, error: sessionError })

        setDebugInfo(prev => ({
          ...prev,
          loading: false,
          user: userData.user,
          session: sessionData.session,
          error: userError || sessionError,
          cookies: supabaseCookies,
          userMethod: userData,
          sessionMethod: sessionData
        }))

        // Method 3: Check if we can manually read session from cookies
        console.log('🔍 Method 3: Checking manual cookie parsing...')
        const authCookie = supabaseCookies.find(c => c.includes('auth-token'))
        console.log('🍪 Auth cookie found:', !!authCookie)
        if (authCookie) {
          console.log('🍪 Auth cookie preview:', authCookie.substring(0, 100) + '...')
        }

      } catch (error) {
        console.error('❌ Client auth check failed:', error)
        setDebugInfo(prev => ({
          ...prev,
          loading: false,
          error: error as AuthError
        }))
      }
    }

    checkAuth()

    // Set up auth listener
    console.log('👂 Setting up auth state listener...')
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔄 Auth state change:', { event, hasSession: !!session, userEmail: session?.user?.email })
      setDebugInfo(prev => ({
        ...prev,
        authListener: `Last event: ${event} at ${new Date().toLocaleTimeString()}`,
        session: session,
        user: session?.user || null
      }))
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const refreshAuth = async () => {
    console.log('🔄 Manual refresh triggered...')
    const supabase = createClient()
    const { data, error } = await supabase.auth.refreshSession()
    console.log('🔄 Refresh result:', { data, error })
    setDebugInfo(prev => ({ 
      ...prev, 
      refreshResult: { data, error } 
    }))
  }

  const clearAndReload = () => {
    // Clear all cookies
    document.cookie.split(";").forEach(c => {
      const eqPos = c.indexOf("=")
      const name = eqPos > -1 ? c.substr(0, eqPos) : c
      document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/"
      document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=localhost"
    })
    
    // Clear localStorage
    localStorage.clear()
    sessionStorage.clear()
    
    window.location.reload()
  }

  if (debugInfo.loading) {
    return <div className="p-4 bg-blue-50 rounded">Loading client auth debug...</div>
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg border">
        <h3 className="text-lg font-semibold mb-4">Detailed Client-Side Debug</h3>
        
        {/* User Info */}
        <div className="mb-4">
          <h4 className="font-medium mb-2">User (getUser method):</h4>
          <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
            {JSON.stringify(debugInfo.user, null, 2)}
          </pre>
        </div>

        {/* Session Info */}
        <div className="mb-4">
          <h4 className="font-medium mb-2">Session (getSession method):</h4>
          <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
            {JSON.stringify(debugInfo.session ? {
              user: debugInfo.session.user?.email,
              expires_at: debugInfo.session.expires_at,
              access_token: debugInfo.session.access_token ? 'EXISTS' : 'MISSING',
              refresh_token: debugInfo.session.refresh_token ? 'EXISTS' : 'MISSING'
            } : null, null, 2)}
          </pre>
        </div>

        {/* Cookies */}
        <div className="mb-4">
          <h4 className="font-medium mb-2">Supabase Cookies ({(debugInfo.cookies || []).length}):</h4>
          <div className="bg-gray-100 p-3 rounded text-sm">
            {(debugInfo.cookies || []).length > 0 ? (
              debugInfo.cookies!.map((cookie, i) => (
                <div key={i} className="mb-1 font-mono text-xs">
                  {cookie.substring(0, 80)}...
                </div>
              ))
            ) : (
              <div className="text-red-600">❌ No Supabase cookies found!</div>
            )}
          </div>
        </div>

        {/* Auth Listener Status */}
        <div className="mb-4">
          <h4 className="font-medium mb-2">Auth Listener:</h4>
          <div className="bg-gray-100 p-3 rounded text-sm">
            {debugInfo.authListener || 'No events yet'}
          </div>
        </div>

        {/* Error */}
        {debugInfo.error && (
          <div className="mb-4">
            <h4 className="font-medium mb-2 text-red-600">Error:</h4>
            <pre className="bg-red-50 p-3 rounded text-sm text-red-700">
              {JSON.stringify(debugInfo.error, null, 2)}
            </pre>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button 
            onClick={refreshAuth}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Refresh Session
          </button>
          <button 
            onClick={clearAndReload}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Clear All & Reload
          </button>
        </div>

        {/* Refresh Result */}
        {debugInfo.refreshResult && (
          <div className="mt-4">
            <h4 className="font-medium mb-2">Refresh Result:</h4>
            <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
              {JSON.stringify(debugInfo.refreshResult, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}