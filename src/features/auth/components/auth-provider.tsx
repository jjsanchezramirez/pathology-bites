// src/components/auth/auth-provider.tsx
'use client'

import { createContext, useContext } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { useAuthStatus } from '@/features/auth/hooks/use-auth-status'
import { AuthError } from '@/features/auth/utils/error-handling'

interface AuthContextType {
  user: User | null
  session: Session | null
  isLoading: boolean
  isAuthenticated: boolean
  error: AuthError | null
  isHydrated: boolean
  securityRisk: 'low' | 'medium' | 'high'
  refreshAuth: () => Promise<void>
  retry: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,
  isHydrated: false,
  securityRisk: 'low',
  refreshAuth: async () => {},
  retry: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Always call the hook to avoid conditional hook calls
  const fullAuthState = useAuthStatus()

  // Check if we're on a public page that doesn't need auth
  const isPublicPage = typeof window !== 'undefined' && (
    window.location.pathname.startsWith('/tools/') ||
    window.location.pathname === '/' ||
    window.location.pathname.startsWith('/login') ||
    window.location.pathname.startsWith('/signup')
  )

  // Use minimal auth state for public pages
  const defaultAuthState = {
    user: null,
    session: null,
    isLoading: false,
    isAuthenticated: false,
    error: null,
    isHydrated: true,
    securityRisk: 'low' as const,
    refreshAuth: async () => {},
    retry: async () => {},
  }

  // Choose which state to use based on page type
  const authState = isPublicPage ? defaultAuthState : fullAuthState

  const value: AuthContextType = {
    user: authState.user,
    session: authState.session,
    isLoading: authState.isLoading,
    isAuthenticated: authState.isAuthenticated,
    error: authState.error,
    isHydrated: authState.isHydrated,
    securityRisk: authState.securityRisk,
    refreshAuth: authState.refreshAuth,
    retry: authState.retry,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuthContext = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }
  return context
}