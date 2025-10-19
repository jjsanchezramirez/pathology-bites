// src/lib/auth/client-actions.ts
'use client'

import { createClient } from '@/shared/services/client'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { retryManager, authErrorHandler } from '@/features/auth/utils/error-handling'

export function useAuthActions() {
  const router = useRouter()
  const supabase = createClient()

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut()

      if (error) {
        console.error('Sign out error:', error)
        throw error
      }

      // Clear any local storage or cached data
      if (typeof window !== 'undefined') {
        localStorage.clear()
        sessionStorage.clear()

        // Clear admin-mode cookie to prevent it from persisting across sessions
        document.cookie = 'admin-mode=; path=/; max-age=0'
      }

      // Force a hard refresh to clear all cached data
      window.location.href = '/login'
    } catch (error) {
      console.error('Error during sign out:', error)
      // Still redirect to login even if there's an error
      window.location.href = '/login'
    }
  }, [supabase.auth])

  const refreshSession = useCallback(async () => {
    return await retryManager.executeWithRetry(
      async () => {
        const { data: { session }, error } = await supabase.auth.refreshSession()

        if (error) {
          throw error
        }

        // Only refresh router if not in a form interaction to prevent data loss
        // Check if user is actively working on forms (has unsaved changes)
        const hasUnsavedWork = typeof window !== 'undefined' && (
          window.location.pathname.includes('/create-question') ||
          window.location.pathname.includes('/edit-question') ||
          document.querySelector('[data-unsaved-changes="true"]')
        )

        if (!hasUnsavedWork) {
          // Safe to refresh router when not in critical form interactions
          router.refresh()
        } else {
          // Log that session was refreshed but router refresh was skipped
          console.log('Session refreshed silently to preserve form data')

          // Show subtle notification that session was refreshed without disrupting work
          if (typeof window !== 'undefined') {
            // Use a custom event to notify components about silent session refresh
            window.dispatchEvent(new CustomEvent('session-refreshed-silently', {
              detail: { timestamp: Date.now() }
            }))
          }
        }

        return session
      },
      {
        maxRetries: 3,
        baseDelay: 1000,
        operationId: 'refresh-session-client'
      }
    )
  }, [supabase.auth, router])

  const getSession = useCallback(async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error) {
        console.error('Get session error:', error)
        throw error
      }

      return session
    } catch (error) {
      console.error('Error getting session:', error)
      throw error
    }
  }, [supabase.auth])

  const getCurrentUser = useCallback(async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()

      if (error) {
        console.error('Get user error:', error)
        throw error
      }

      return user
    } catch (error) {
      console.error('Error getting user:', error)
      throw error
    }
  }, [supabase.auth])

  return {
    signOut,
    refreshSession,
    getSession,
    getCurrentUser,
  }
}