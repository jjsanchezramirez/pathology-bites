// src/hooks/use-auth-status.ts
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User, Session } from '@supabase/supabase-js'

export function useAuthStatus() {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    let mounted = true

    const initAuth = async () => {
      try {
        // Wait for hydration
        if (typeof window === 'undefined') return
        
        setIsHydrated(true)
        setIsLoading(true)
        setError(null)

        // Get current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (!mounted) return

        if (sessionError) {
          console.error('Session error:', sessionError)
          setError(sessionError)
          setSession(null)
          setUser(null)
          setIsAuthenticated(false)
        } else {
          setSession(session)
          setUser(session?.user ?? null)
          setIsAuthenticated(!!(session?.user))
          setError(null)
        }
      } catch (err) {
        if (!mounted) return
        console.error('Auth initialization error:', err)
        setError(err instanceof Error ? err : new Error('Auth failed'))
        setSession(null)
        setUser(null)
        setIsAuthenticated(false)
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    initAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!mounted) return

        console.log('Auth state changed:', event, newSession ? 'has session' : 'no session')
        
        setSession(newSession)
        setUser(newSession?.user ?? null)
        setIsAuthenticated(!!(newSession?.user))
        setIsLoading(false)
        setError(null)

        // Handle sign out
        if (event === 'SIGNED_OUT') {
          setSession(null)
          setUser(null)
          setIsAuthenticated(false)
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, []) // Empty dependency array - only run once

  const refreshAuth = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const { data: { session }, error } = await supabase.auth.refreshSession()
      
      if (error) {
        console.error('Refresh error:', error)
        setError(error)
      } else {
        setSession(session)
        setUser(session?.user ?? null)
        setIsAuthenticated(!!(session?.user))
      }
    } catch (err) {
      console.error('Refresh session error:', err)
      setError(err instanceof Error ? err : new Error('Refresh failed'))
    } finally {
      setIsLoading(false)
    }
  }

  return {
    user,
    session,
    isLoading,
    isAuthenticated,
    error,
    isHydrated,
    refreshAuth,
    retry: refreshAuth
  }
}

// Backward compatibility exports
export const useAuthRobust = useAuthStatus

export function useAuth() {
  const { user, session, isAuthenticated, isLoading, error } = useAuthStatus()
  
  return {
    user,
    session,
    isAuthenticated,
    isLoading,
    error
  }
}