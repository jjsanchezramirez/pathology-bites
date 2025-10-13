// src/shared/components/auth/auth-guard.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSimpleAuth } from '@/shared/hooks/use-simple-auth'

interface AuthGuardProps {
  children: React.ReactNode
  redirectTo?: string
}

/**
 * Client-side authentication guard that redirects unauthenticated users to login.
 * This provides defense-in-depth alongside server-side middleware protection.
 * 
 * Use this in layout components to protect entire sections of the app.
 */
export function AuthGuard({ children, redirectTo = '/login' }: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useSimpleAuth()
  const router = useRouter()
  const [isHydrated, setIsHydrated] = useState(false)

  // Fix hydration mismatch by ensuring client has mounted
  useEffect(() => {
    setIsHydrated(true)
  }, [])

  useEffect(() => {
    // Only redirect if we're done loading and user is not authenticated
    if (isHydrated && !isLoading && !isAuthenticated) {
      // Get current path for redirect after login
      const currentPath = window.location.pathname
      const redirectUrl = `${redirectTo}?redirect=${encodeURIComponent(currentPath)}`
      
      // Use router.replace to avoid adding to history
      router.replace(redirectUrl)
    }
  }, [isAuthenticated, isLoading, redirectTo, router, isHydrated])

  // Prevent hydration mismatch by not rendering anything during SSR
  if (!isHydrated) {
    return null
  }

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Don't render children if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null
  }

  // User is authenticated, render children
  return <>{children}</>
}

