// src/shared/hooks/use-auth.ts
/**
 * Unified authentication hook
 * Replaces: useAuth, useAuth, useUserInit
 *
 * Features controlled by options:
 * - Security validation (optional, for sensitive operations)
 * - User data loading (optional, for dashboards)
 * - Minimal mode (for auth guards, public pages)
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import { realtimeService } from '@/shared/services/realtime-service'
import { createClient } from '@/shared/services/client'
import { isPublicRoute } from '@/shared/utils/route-helpers'
import type { User, Session } from '@supabase/supabase-js'
import type { UserRole } from '@/shared/utils/auth-helpers'

interface UseAuthOptions {
  /** Enable security validation (session monitoring) */
  enableSecurity?: boolean
  /** Load user data and settings (for dashboards) */
  loadUserData?: boolean
  /** Skip auth entirely (for public pages) */
  minimal?: boolean
}

interface AuthState {
  user: User | null
  session: Session | null
  role: UserRole | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

interface UserData {
  stats: any
  settings: any
}

interface UseAuthReturn extends AuthState {
  // User data (only if loadUserData: true)
  userData: UserData | null

  // Actions
  refreshAuth: () => Promise<void>
  refreshUserData: () => Promise<void>

  // Hydration state
  isHydrated: boolean
}

/**
 * Unified auth hook with configurable features
 *
 * @example
 * // Minimal mode (auth guards)
 * const { isAuthenticated, isLoading } = useAuth({ minimal: true })
 *
 * @example
 * // Full mode (dashboard pages)
 * const { user, role, userData, refreshUserData } = useAuth({
 *   enableSecurity: true,
 *   loadUserData: true
 * })
 *
 * @example
 * // Public pages (skips auth entirely)
 * const { isLoading } = useAuth({ minimal: true })
 */
export function useAuth(options: UseAuthOptions = {}): UseAuthReturn {
  const {
    enableSecurity = false,
    loadUserData = false,
    minimal = false
  } = options

  // Check if we're on a public page
  const isPublicPage = typeof window !== 'undefined' && isPublicRoute(window.location.pathname)

  // Skip auth on public pages in minimal mode
  const skipAuth = minimal && isPublicPage

  // Initialize state from sessionStorage for faster perceived load
  const [authState, setAuthState] = useState<AuthState>(() => {
    // Try to restore from sessionStorage on mount
    if (typeof window !== 'undefined' && !skipAuth) {
      try {
        const cached = sessionStorage.getItem('auth-state')
        if (cached) {
          const parsed = JSON.parse(cached)
          // Only use cache if it has a user (valid session)
          if (parsed.user && parsed.session) {
            const cachedState = {
              ...parsed,
              isLoading: false, // Cache is ready, no need to show loading
              error: null
            }
            console.log('[useAuth] Restored from cache:', { isAuthenticated: cachedState.isAuthenticated, role: cachedState.role })
            return cachedState
          }
        }
      } catch (e) {
        // Ignore parse errors
        console.error('[useAuth] Failed to parse cached auth:', e)
      }
    }

    console.log('[useAuth] No cache found, starting with unauthenticated state')
    return {
      user: null,
      session: null,
      role: null,
      isAuthenticated: false,
      isLoading: !skipAuth, // Don't load if skipping
      error: null
    }
  })

  const [userData, setUserData] = useState<UserData | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)

  const mounted = useRef(true)
  const previousSessionRef = useRef<Session | null>(null)
  const supabase = createClient()

  // Helper to save auth state to sessionStorage
  const saveAuthState = (state: AuthState) => {
    if (typeof window !== 'undefined' && state.user && state.session) {
      try {
        // Only save minimal data needed for fast restore
        sessionStorage.setItem('auth-state', JSON.stringify({
          user: state.user,
          session: state.session,
          role: state.role,
          isAuthenticated: state.isAuthenticated,
          error: null
        }))
      } catch (e) {
        // Ignore storage errors (quota exceeded, etc.)
      }
    }
  }

  // Helper to clear auth state from sessionStorage
  const clearAuthState = () => {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('auth-state')
      } catch (e) {
        // Ignore errors
      }
    }
  }

  // Hydration - set to true immediately since we initialize from sessionStorage synchronously
  // The initial useState already handles sessionStorage restoration
  useEffect(() => {
    setIsHydrated(true)
  }, [])

  // Initialize auth
  useEffect(() => {
    mounted.current = true

    // Skip auth initialization for public pages in minimal mode
    if (skipAuth) {
      setAuthState({
        user: null,
        session: null,
        role: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
      })
      return
    }

    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          console.error('Error getting session:', error)
          if (mounted.current) {
            setAuthState(prev => ({
              ...prev,
              error: error.message,
              isLoading: false
            }))
          }
          return
        }

        if (mounted.current) {
          previousSessionRef.current = session

          // Extract role from JWT
          const role = session?.user?.app_metadata?.role ||
                      session?.user?.user_metadata?.role ||
                      null

          const newAuthState = {
            user: session?.user ?? null,
            session,
            role: role as UserRole | null,
            isAuthenticated: !!(session?.user),
            isLoading: false,
            error: null
          }

          setAuthState(newAuthState)

          // Save to sessionStorage for fast restore on next page load
          if (session?.user) {
            saveAuthState(newAuthState)
          } else {
            clearAuthState()
          }

          // Load user data if requested and authenticated
          if (loadUserData && session?.user) {
            await loadUserDataFromAPI()
          }
        }
      } catch (err) {
        console.error('Auth initialization error:', err)
        if (mounted.current) {
          setAuthState(prev => ({
            ...prev,
            error: err instanceof Error ? err.message : 'Auth initialization failed',
            isLoading: false
          }))
        }
      }
    }

    initAuth()

    // Register with shared auth service
    const unsubscribe = realtimeService.addAuthListener((event, session) => {
      if (!mounted.current) return

      // Session change detection to prevent unnecessary re-renders
      const previousSession = previousSessionRef.current
      const sessionChanged =
        previousSession?.access_token !== session?.access_token ||
        previousSession?.user?.id !== session?.user?.id ||
        event === 'SIGNED_OUT' ||
        event === 'USER_UPDATED'

      if (!sessionChanged) {
        return
      }

      previousSessionRef.current = session

      // Extract role from JWT
      const role = session?.user?.app_metadata?.role ||
                  session?.user?.user_metadata?.role ||
                  null

      const newAuthState = {
        user: session?.user ?? null,
        session,
        role: role as UserRole | null,
        isAuthenticated: !!(session?.user),
        isLoading: false,
        error: null
      }

      setAuthState(newAuthState)

      // Save/clear sessionStorage
      if (session?.user) {
        saveAuthState(newAuthState)
      } else {
        clearAuthState()
      }

      // Reload user data on auth change if needed
      if (loadUserData && session?.user) {
        loadUserDataFromAPI()
      } else if (event === 'SIGNED_OUT') {
        setUserData(null)
      }
    })

    return () => {
      mounted.current = false
      unsubscribe()
    }
  }, [skipAuth, loadUserData])

  // Load user data from API
  const loadUserDataFromAPI = async () => {
    try {
      const response = await fetch('/api/user/init')
      if (!response.ok) {
        throw new Error('Failed to load user data')
      }
      const data = await response.json()
      if (mounted.current) {
        setUserData({
          stats: data.userData,
          settings: data.settings
        })
      }
    } catch (error) {
      console.error('Error loading user data:', error)
    }
  }

  const refreshAuth = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession()
      if (error) throw error

      const role = session?.user?.app_metadata?.role ||
                  session?.user?.user_metadata?.role ||
                  null

      const newAuthState = {
        user: session?.user ?? null,
        session,
        role: role as UserRole | null,
        isAuthenticated: !!(session?.user),
        isLoading: false,
        error: null
      }

      setAuthState(newAuthState)

      // Update sessionStorage
      if (session?.user) {
        saveAuthState(newAuthState)
      } else {
        clearAuthState()
      }
    } catch (err) {
      console.error('Refresh session error:', err)
      clearAuthState()
      setAuthState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Session refresh failed'
      }))
    }
  }

  const refreshUserData = async () => {
    if (loadUserData && authState.isAuthenticated) {
      await loadUserDataFromAPI()
    }
  }

  return {
    ...authState,
    userData,
    refreshAuth,
    refreshUserData,
    isHydrated
  }
}
