// src/shared/hooks/use-shared-auth.ts
// Optimized auth hook using shared realtime subscription

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

export function useSharedAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    isAuthenticated: false,
    isLoading: true,
    error: null
  })

  const mounted = useRef(true)
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

      console.log('🔄 Shared auth event received:', { event, hasSession: !!session })

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