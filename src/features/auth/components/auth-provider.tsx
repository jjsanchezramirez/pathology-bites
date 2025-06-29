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
  // Use the consolidated auth hook internally
  const authState = useAuthStatus()

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