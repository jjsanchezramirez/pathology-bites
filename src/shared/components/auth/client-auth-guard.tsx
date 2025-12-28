// src/shared/components/auth/client-auth-guard.tsx
'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/shared/hooks/use-auth'

interface ClientAuthGuardProps {
  children: React.ReactNode
  redirectTo?: string
}

/**
 * Lightweight client-side auth guard for /dashboard routes
 * Uses sessionStorage cache to minimize API calls
 *
 * NOTE: This is NOT cryptographically secure - it's UX optimization only.
 * Server-side API routes still verify authentication.
 * Use middleware for sensitive routes like /admin.
 */
export function ClientAuthGuard({ children, redirectTo = '/login' }: ClientAuthGuardProps) {
  const { isAuthenticated, isLoading, isHydrated } = useAuth({ minimal: true })
  const router = useRouter()
  const [shouldRender, setShouldRender] = useState(false)
  const hasCheckedRef = useRef(false)

  useEffect(() => {
    // Wait until fully hydrated and auth check complete
    if (!isHydrated || isLoading) {
      return
    }

    // CRITICAL: Wait one render cycle after isLoading becomes false
    // This ensures the auth state has fully settled from sessionStorage
    if (!hasCheckedRef.current) {
      hasCheckedRef.current = true
      return
    }

    if (!isAuthenticated) {
      // User not authenticated - redirect to login
      const currentPath = window.location.pathname
      const redirectUrl = `${redirectTo}?redirect=${encodeURIComponent(currentPath)}`
      router.replace(redirectUrl)
    } else {
      // User authenticated - safe to render
      setShouldRender(true)
    }
  }, [isAuthenticated, isLoading, isHydrated, redirectTo, router])

  // Show loading state while checking auth
  if (!isHydrated || isLoading || !shouldRender) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Render children if authenticated
  return <>{children}</>
}
