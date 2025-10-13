// src/shared/hooks/use-simple-auth.ts
// Lightweight auth hook using optimized realtime subscription

import { useState, useEffect, useRef } from 'react'
import { realtimeService } from '@/shared/services/realtime-service'
import { createClient } from '@/shared/services/client'
import type { User, Session } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  session: Session | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

export function useSimpleAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    isAuthenticated: false,
    isLoading: true,
    error: null
  })

  const mounted = useRef(true)
  const previousSessionRef = useRef<Session | null>(null)
  const supabase = createClient()

  useEffect(() => {
    mounted.current = true

    // Initial auth check
    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          console.error('Error getting session:', error)
          setAuthState(prev => ({
            ...prev,
            error: error.message,
            isLoading: false
          }))
          return
        }

        if (mounted.current) {
          previousSessionRef.current = session
          setAuthState({
            user: session?.user ?? null,
            session,
            isAuthenticated: !!(session?.user),
            isLoading: false,
            error: null
          })
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

      // CRITICAL FIX: Only update state if session has actually changed
      // This prevents unnecessary re-renders when Supabase fires SIGNED_IN events on tab focus
      const previousSession = previousSessionRef.current
      const sessionChanged =
        previousSession?.access_token !== session?.access_token ||
        previousSession?.user?.id !== session?.user?.id ||
        event === 'SIGNED_OUT' ||
        event === 'USER_UPDATED'

      if (!sessionChanged) {
        console.log('🔄 Shared auth event ignored (no session change):', { event, hasSession: !!session })
        return
      }

      console.log('🔄 Shared auth event received:', { event, hasSession: !!session })

      previousSessionRef.current = session
      setAuthState({
        user: session?.user ?? null,
        session,
        isAuthenticated: !!(session?.user),
        isLoading: false,
        error: null
      })
    })

    return () => {
      mounted.current = false
      unsubscribe()
    }
  }, [])

  return authState
}