// src/components/theme/conditional-theme-provider.tsx
/**
 * ConditionalThemeProvider
 *
 * Manages color mode (light/dark/system) across the application using next-themes.
 *
 * THEME SYSTEM OVERVIEW:
 * ----------------------
 * The application has TWO separate theming concepts:
 *
 * 1. COLOR MODE (managed by this provider):
 *    - Controls light/dark/system color scheme
 *    - Stored in ui_settings.theme
 *    - Public pages: FORCED to light mode
 *    - Dashboard/Admin pages: User can toggle light/dark/system
 *
 * 2. DASHBOARD THEME (managed by DashboardThemeContext):
 *    - Controls which theme CSS variables are applied (Default/Notebook/Tangerine)
 *    - Stored in ui_settings.dashboard_theme_admin or ui_settings.dashboard_theme_user
 *    - Admin/Creator/Reviewer mode: Only 'default' theme available
 *    - Student mode: 'notebook' and 'tangerine' themes available
 *
 * ROUTE BEHAVIOR:
 * ---------------
 * - Public routes (/, /about, /login, etc.): Light mode enforced, Default theme
 * - Auth routes (/login, /signup, etc.): Light mode enforced, Default theme
 * - Error routes (/not-found, etc.): Light mode enforced, Default theme
 * - Dashboard routes (/dashboard/*): User can toggle color mode, theme based on role
 * - Admin routes (/admin/*): User can toggle color mode, Default theme only
 */
'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ThemeProviderProps } from 'next-themes'

export function ConditionalThemeProvider({ children, ...props }: ThemeProviderProps) {
  const pathname = usePathname()

  // Define which routes allow color mode customization
  const themedRoutes = ['/admin', '/dashboard']
  const isThemedRoute = pathname ? themedRoutes.some(route => pathname.startsWith(route)) : false
  
  // Theme configuration
  const themeProps: ThemeProviderProps = {
    attribute: 'class',
    defaultTheme: 'system',
    enableSystem: true,
    disableTransitionOnChange: false,
    storageKey: 'pathology-bites-theme',
    ...props,
    // Force light theme on public routes
    forcedTheme: isThemedRoute ? undefined : 'light'
  }
  
  // Clean up theme classes on route changes
  useEffect(() => {
    const html = document.documentElement
    
    if (!isThemedRoute) {
      // Force light mode on public pages
      html.classList.remove('dark')
      html.classList.add('light')
      // Optional: Add a data attribute to identify forced theme state
      html.setAttribute('data-theme-forced', 'true')
    } else {
      // Remove forced theme indicator on themed routes
      html.removeAttribute('data-theme-forced')
    }
  }, [isThemedRoute, pathname])

  return (
    <NextThemesProvider {...themeProps}>
      {children}
    </NextThemesProvider>
  )
}