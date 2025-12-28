// src/shared/components/auth/auth-guard.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/shared/hooks/use-auth'

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
  const { isAuthenticated, isLoading, isHydrated } = useAuth({ minimal: true })
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  // Track component mount state
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    // Only redirect if we're done loading and user is not authenticated
    if (mounted && isHydrated && !isLoading && !isAuthenticated) {
      // Get current path for redirect after login
      const currentPath = window.location.pathname
      const redirectUrl = `${redirectTo}?redirect=${encodeURIComponent(currentPath)}`

      // Use router.replace to avoid adding to history
      router.replace(redirectUrl)
    }
  }, [isAuthenticated, isLoading, redirectTo, router, isHydrated, mounted])

  // Prevent hydration mismatch by not rendering anything during SSR
  if (!mounted || !isHydrated) {
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

