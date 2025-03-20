'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ThemeProviderProps } from 'next-themes'

export function ConditionalThemeProvider({ children, ...props }: ThemeProviderProps) {
  const pathname = usePathname()
  
  // Check if the current route is an admin or dashboard route where theming is allowed
  const isThemedRoute = pathname.startsWith('/admin') || pathname.startsWith('/dashboard')
  
  // Use forcedTheme for non-themed routes to always render in light mode
  const themeProps = {
    ...props,
    // If not on a themed route, force light theme regardless of user preference
    forcedTheme: isThemedRoute ? undefined : 'light'
  }
  
  // Optional: Clean up any dark theme remnants if not on a themed route
  useEffect(() => {
    if (!isThemedRoute) {
      // This is a public page - ensure it's in light mode
      document.documentElement.classList.remove('dark')
    }
  }, [isThemedRoute])

  // Always use ThemeProvider but with conditional forcedTheme
  return <NextThemesProvider {...themeProps}>{children}</NextThemesProvider>
}