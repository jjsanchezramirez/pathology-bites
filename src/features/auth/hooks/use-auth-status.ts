// src/hooks/use-auth-status.ts
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/shared/services/client'
import { User, Session } from '@supabase/supabase-js'
import { sessionSecurity } from '@/features/auth/utils/session-security'
import { authErrorHandler, retryManager, AuthError } from '@/features/auth/utils/error-handling'

export function useAuthStatus() {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [error, setError] = useState<AuthError | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)
  const [securityRisk, setSecurityRisk] = useState<'low' | 'medium' | 'high'>('low')

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
          const authError = authErrorHandler.categorizeError(sessionError)
          setError(authError)
          setSession(null)
          setUser(null)
          setIsAuthenticated(false)
        } else {
          setSession(session)
          setUser(session?.user ?? null)
          setIsAuthenticated(!!(session?.user))
          setError(null)

          // Validate session security if user is authenticated
          if (session?.user) {
            const validation = sessionSecurity.validateSession()
            setSecurityRisk(validation.risk)

            if (!validation.isValid) {
              console.warn('Session security validation failed:', validation.issues)
              // Optionally force re-authentication for high-risk sessions
              if (validation.risk === 'high') {
                const securityError = authErrorHandler.categorizeError(
                  new Error('Session security validation failed')
                )
                setError(securityError)
              }
            }
          }
        }
      } catch (err) {
        if (!mounted) return
        console.error('Auth initialization error:', err)
        const authError = authErrorHandler.categorizeError(err)
        setError(authError)
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
          setSecurityRisk('low')
          sessionSecurity.clearSession()
        } else if (newSession?.user) {
          // Validate session security on auth state changes
          const validation = sessionSecurity.validateSession()
          setSecurityRisk(validation.risk)
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase.auth]) // Empty dependency array - only run once

  const refreshAuth = async () => {
    try {
      await retryManager.executeWithRetry(
        async () => {
          setIsLoading(true)
          setError(null)

          const { data: { session }, error } = await supabase.auth.refreshSession()

          if (error) {
            throw error
          }

          setSession(session)
          setUser(session?.user ?? null)
          setIsAuthenticated(!!(session?.user))
        },
        {
          maxRetries: 3,
          baseDelay: 1000,
          operationId: 'refresh-auth'
        }
      )
    } catch (err) {
      console.error('Refresh session error:', err)
      const authError = authErrorHandler.categorizeError(err)
      setError(authError)
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
    securityRisk,
    refreshAuth,
    retry: refreshAuth
  }
}

// Primary auth hook - this is the main interface for auth state
export const useAuth = useAuthStatus

// Backward compatibility exports (deprecated - use useAuth instead)
export const useAuthRobust = useAuthStatus