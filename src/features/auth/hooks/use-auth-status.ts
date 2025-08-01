// src/hooks/use-auth-status.ts
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/shared/services/client'
import { User, Session } from '@supabase/supabase-js'
import { sessionSecurity } from '@/features/auth/utils/session-security'
import { authErrorHandler, retryManager, AuthError, handleAuthConflict, isAuthConflictError } from '@/features/auth/utils/error-handling'
import { realtimeService } from '@/shared/services/realtime-service'

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

        // Check if we're on a public page that doesn't need auth
        const isPublicPage = typeof window !== 'undefined' && (
          window.location.pathname.startsWith('/tools/') ||
          window.location.pathname === '/' ||
          window.location.pathname.startsWith('/login') ||
          window.location.pathname.startsWith('/signup')
        )

        // For public pages, set default state and skip auth initialization
        if (isPublicPage) {
          setSession(null)
          setUser(null)
          setIsAuthenticated(false)
          setIsLoading(false)
          setError(null)
          return
        }

        // Get current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (!mounted) return

        if (sessionError) {
          if (process.env.NODE_ENV === 'development') {
            console.debug('Session error:', sessionError)
          }
          const authError = authErrorHandler.categorizeError(sessionError)
          setError(authError)
          setSession(null)
          setUser(null)
          setIsAuthenticated(false)

          // Handle CSRF errors and auth conflicts by redirecting to login
          if (isAuthConflictError(sessionError)) {
            handleAuthConflict('Session conflict detected. Please log in again.')
            return
          }

          // Only show toast for non-empty errors with medium or high severity
          if (typeof window !== 'undefined' && authError.severity !== 'low' && authError.message !== 'Empty or null error object') {
            const { toast } = await import('@/shared/utils/toast')
            toast.error(authError.userMessage, {
              duration: 8000,
              description: `Error: ${authError.message}`
            })
          }
        } else {
          setSession(session)
          setUser(session?.user ?? null)
          setIsAuthenticated(!!(session?.user))
          setError(null)

          // Validate session security if user is authenticated
          if (session?.user && session.expires_at) {
            try {
              const sessionData = {
                access_token: session.access_token,
                expires_at: session.expires_at,
                user: session.user,
                created_at: Math.floor(Date.now() / 1000)
              }
              const validation = sessionSecurity.validateSessionSecurity(sessionData)
              setSecurityRisk(validation.riskLevel === 'none' ? 'low' : validation.riskLevel)

              // Only take action for high-risk sessions that should trigger alerts
              if (!validation.isValid && validation.shouldAlert) {
                // Only log in development mode to reduce console noise
                if (process.env.NODE_ENV === 'development') {
                  console.debug('High-risk session detected:', validation.changes)
                }

                const securityError = authErrorHandler.categorizeError(
                  new Error('Session security validation failed - please sign in again')
                )
                setError(securityError)

                // Clear session data and sign out for high-risk sessions
                sessionSecurity.clearSessionData()
                await supabase.auth.signOut()
                return
              } else if (process.env.NODE_ENV === 'development' && validation.changes.length > 0) {
                // Only log in development for debugging
                console.debug(`Session validation: ${validation.riskLevel} risk with changes:`, validation.changes)
              }
            } catch (securityValidationError) {
              if (process.env.NODE_ENV === 'development') {
                console.debug('Session security validation error:', securityValidationError)
              }
              // Don't fail the entire auth process for security validation errors
              setSecurityRisk('low') // Default to low risk if validation fails
            }
          }
        }
      } catch (err) {
        if (!mounted) return
        if (process.env.NODE_ENV === 'development') {
          console.debug('Auth initialization error:', err)
        }
        const authError = authErrorHandler.categorizeError(err)
        setError(authError)
        setSession(null)
        setUser(null)
        setIsAuthenticated(false)

        // Handle CSRF errors and auth conflicts by redirecting to login
        if (isAuthConflictError(err)) {
          handleAuthConflict('Authentication conflict detected. Please log in again.')
          return
        }

        // Only show toast for non-empty errors with medium or high severity
        if (typeof window !== 'undefined' && authError.severity !== 'low' && authError.message !== 'Empty or null error object') {
          const { toast } = await import('@/shared/utils/toast')
          toast.error(authError.userMessage, {
            duration: 8000,
            description: `Initialization error: ${authError.message}`
          })
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    initAuth()

    // Skip auth listener for public pages
    const isPublicPage = typeof window !== 'undefined' && (
      window.location.pathname.startsWith('/tools/') ||
      window.location.pathname === '/' ||
      window.location.pathname.startsWith('/login') ||
      window.location.pathname.startsWith('/signup')
    )

    if (isPublicPage) {
      return () => {} // Return empty cleanup function
    }

    // Use shared auth subscription to reduce duplicate listeners
    const unsubscribe = realtimeService.addAuthListener((event, newSession) => {
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
        sessionSecurity.clearSessionData()
      } else if (newSession?.user && newSession.expires_at) {
        // Validate session security on auth state changes
        try {
          const sessionData = {
            access_token: newSession.access_token,
            expires_at: newSession.expires_at,
            user: newSession.user,
            created_at: Math.floor(Date.now() / 1000)
          }
          const validation = sessionSecurity.validateSessionSecurity(sessionData)
          setSecurityRisk(validation.riskLevel === 'none' ? 'low' : validation.riskLevel)

          // If session is invalid due to high risk, sign out
          if (!validation.isValid && validation.shouldAlert) {
            console.warn('Session security validation failed, signing out:', validation.changes)
            supabase.auth.signOut()
            return
          }
        } catch (securityValidationError) {
          console.warn('Session security validation error on auth state change:', securityValidationError)
          setSecurityRisk('medium')
        }
      }
    })

    return () => {
      mounted = false
      unsubscribe()
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
      if (process.env.NODE_ENV === 'development') {
        console.debug('Refresh session error:', err)
      }
      const authError = authErrorHandler.categorizeError(err)
      setError(authError)

      // Handle CSRF errors and auth conflicts by redirecting to login
      if (isAuthConflictError(err)) {
        handleAuthConflict('Session refresh failed. Please log in again.')
        return
      }

      // Only show toast for non-empty errors with medium or high severity
      if (typeof window !== 'undefined' && authError.severity !== 'low' && authError.message !== 'Empty or null error object') {
        const { toast } = await import('@/shared/utils/toast')
        toast.error(authError.userMessage, {
          duration: 8000,
          description: `Session refresh failed: ${authError.message}`
        })
      }
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