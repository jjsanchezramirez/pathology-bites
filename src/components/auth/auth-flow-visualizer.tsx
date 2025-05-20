// src/components/auth/auth-flow-visualizer.tsx
"use client"

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { type User, type Session } from '@supabase/supabase-js'

// More specific types to avoid 'any'
type UserMetadata = {
  [key: string]: string | number | boolean | null | undefined;
}

type DatabaseUser = {
  id: string;
  email?: string;
  role?: string;
  [key: string]: unknown;
}

interface AuthState {
  loading: boolean;
  user: User | null;
  session: Session | null;
  userMetadata: UserMetadata | null;
  databaseUser: DatabaseUser | null;
}

export default function AuthFlowVisualizer() {
  const [authState, setAuthState] = useState<AuthState>({
    loading: true,
    user: null,
    session: null,
    userMetadata: null,
    databaseUser: null
  })
  const { toast } = useToast()
  
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = createClient()
        
        // Get current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('Session error:', sessionError)
          toast({
            variant: "destructive",
            title: "Session Error",
            description: sessionError.message
          })
        }
        
        // Get user data
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        if (userError) {
          console.error('User error:', userError)
          toast({
            variant: "destructive",
            title: "User Error",
            description: userError.message
          })
        }
        
        // Get database user if authenticated
        let databaseUser = null
        if (user) {
          const { data, error: dbError } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single()
            
          if (dbError) {
            console.error('Database user error:', dbError)
            toast({
              variant: "destructive",
              title: "Database Error",
              description: dbError.message
            })
          } else {
            databaseUser = data
          }
        }
        
        setAuthState({
          loading: false,
          user,
          session,
          userMetadata: user?.user_metadata as UserMetadata || null,
          databaseUser: databaseUser as DatabaseUser
        })
        
      } catch (error) {
        console.error('Auth check error:', error)
        toast({
          variant: "destructive",
          title: "Authentication Error",
          description: "Failed to check authentication state"
        })
        setAuthState({
          loading: false,
          user: null,
          session: null,
          userMetadata: null,
          databaseUser: null
        })
      }
    }
    
    checkAuth()
    
    // Set up auth state listener
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      // Removed unused 'session' parameter
      console.log('Auth state changed:', event)
      checkAuth()
    })
    
    return () => {
      subscription.unsubscribe()
    }
  }, [toast]) // Include toast in dependency array
  
  const formatDate = (isoString: string | undefined) => {
    if (!isoString) return 'N/A'
    return new Date(isoString).toLocaleString()
  }
  
  const checkCookies = () => {
    const cookies = document.cookie.split(';').map(c => c.trim())
    const authCookies = cookies.filter(c => 
      c.startsWith('sb-') || 
      c.startsWith('supabase-') || 
      c.includes('auth')
    )
    
    return authCookies
  }
  
  if (authState.loading) {
    return (
      <div className="p-4 border rounded-lg shadow-sm">
        <p className="text-center">Loading authentication data...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 border rounded-lg shadow-sm">
      <h2 className="text-2xl font-bold">Authentication Flow Visualizer</h2>
      
      <div className="space-y-4">
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="font-bold text-green-800">Authentication Status</h3>
          <p className="mt-2">
            {authState.user ? (
              <span className="text-green-600 font-medium">✓ Authenticated</span>
            ) : (
              <span className="text-red-600 font-medium">✗ Not authenticated</span>
            )}
          </p>
        </div>
        
        {/* User Information */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-bold text-blue-800">User Information</h3>
          {authState.user ? (
            <div className="mt-2 space-y-2">
              <p><span className="font-medium">ID:</span> {authState.user.id}</p>
              <p><span className="font-medium">Email:</span> {authState.user.email}</p>
              <p><span className="font-medium">Email Verified:</span> {authState.user.email_confirmed_at ? 'Yes' : 'No'}</p>
              <p><span className="font-medium">Created:</span> {formatDate(authState.user.created_at)}</p>
              <p><span className="font-medium">Last Sign In:</span> {formatDate(authState.user.last_sign_in_at)}</p>
            </div>
          ) : (
            <p className="mt-2 text-gray-600">No user authenticated</p>
          )}
        </div>
        
        {/* Session Information */}
        <div className="bg-purple-50 p-4 rounded-lg">
          <h3 className="font-bold text-purple-800">Session Information</h3>
          {authState.session ? (
            <div className="mt-2 space-y-2">
              <p><span className="font-medium">Session Token:</span> {authState.session.access_token?.substring(0, 10)}...</p>
              <p><span className="font-medium">User ID:</span> {authState.session.user?.id}</p>
              <p><span className="font-medium">Expires:</span> {formatDate(new Date(authState.session.expires_at ? authState.session.expires_at * 1000 : 0).toISOString())}</p>
            </div>
          ) : (
            <p className="mt-2 text-gray-600">No active session</p>
          )}
        </div>
        
        {/* User Metadata */}
        <div className="bg-yellow-50 p-4 rounded-lg">
          <h3 className="font-bold text-yellow-800">User Metadata</h3>
          {authState.userMetadata ? (
            <div className="mt-2">
              <pre className="text-xs p-2 bg-yellow-100 rounded overflow-auto">
                {JSON.stringify(authState.userMetadata, null, 2)}
              </pre>
            </div>
          ) : (
            <p className="mt-2 text-gray-600">No user metadata available</p>
          )}
        </div>
        
        {/* Database User */}
        <div className="bg-red-50 p-4 rounded-lg">
          <h3 className="font-bold text-red-800">Database User Record</h3>
          {authState.databaseUser ? (
            <div className="mt-2">
              <pre className="text-xs p-2 bg-red-100 rounded overflow-auto">
                {JSON.stringify(authState.databaseUser, null, 2)}
              </pre>
            </div>
          ) : (
            <p className="mt-2 text-gray-600">No database user record found</p>
          )}
        </div>
        
        {/* Auth Cookies */}
        <div className="bg-teal-50 p-4 rounded-lg">
          <h3 className="font-bold text-teal-800">Authentication Cookies</h3>
          <div className="mt-2">
            <button 
              className="px-3 py-1 text-sm bg-teal-600 text-white rounded hover:bg-teal-700"
              onClick={() => {
                const cookies = checkCookies()
                toast({
                  title: "Auth Cookies",
                  description: cookies.length > 0 
                    ? `Found ${cookies.length} auth-related cookies` 
                    : "No auth cookies found",
                })
                console.log('Auth cookies:', cookies)
              }}
            >
              Check Auth Cookies
            </button>
            <p className="mt-2 text-xs text-gray-600">Results will be shown in console</p>
          </div>
        </div>
      </div>
    </div>
  )
}