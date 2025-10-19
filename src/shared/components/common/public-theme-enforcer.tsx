// src/shared/components/common/public-theme-enforcer.tsx
'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * PublicThemeEnforcer Component
 *
 * Enforces light color mode for all public-facing pages.
 * This includes:
 * - Public pages (/, /about, /contact, /faq, /privacy, /terms, /coming-soon, /maintenance)
 * - Public tools (/tools/*)
 * - Authentication pages (/login, /signup, /forgot-password, /verify-email, etc.)
 * - Error pages (/not-found, global error boundary)
 *
 * The enforcement applies regardless of:
 * - User authentication status
 * - User's saved theme preferences
 * - User's saved color mode preferences
 *
 * Once the user navigates to authenticated/admin pages (/dashboard, /admin),
 * their personal theme preferences are restored.
 *
 * Note: Dashboard theme enforcement (default vs notebook/tangerine) is handled
 * by the DashboardThemeProvider which is only available in protected routes.
 */
export function PublicThemeEnforcer() {
  const pathname = usePathname()

  // Define routes that are NOT public (authenticated/admin routes)
  const protectedRoutes = ['/dashboard', '/admin']
  const isProtectedRoute = pathname ? protectedRoutes.some(route => pathname.startsWith(route)) : false

  // Enforce light color mode on public pages
  useEffect(() => {
    if (!isProtectedRoute && pathname) {
      const html = document.documentElement

      // Force light mode
      html.classList.remove('dark')
      html.classList.add('light')

      // Add data attribute to identify forced theme state
      html.setAttribute('data-public-theme-enforced', 'true')

      console.log('[PublicThemeEnforcer] Enforced light mode on public page:', pathname)
    } else if (isProtectedRoute) {
      // On protected routes: remove forced theme indicator
      const html = document.documentElement
      html.removeAttribute('data-public-theme-enforced')
    }
  }, [isProtectedRoute, pathname])

  // This component doesn't render anything
  return null
}

