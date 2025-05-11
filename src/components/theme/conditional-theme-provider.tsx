// src/components/theme/conditional-theme-provider.tsx
'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ThemeProviderProps } from 'next-themes'

export function ConditionalThemeProvider({ children, ...props }: ThemeProviderProps) {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  
  // Check if the current route is an admin or dashboard route where theming is allowed
  const isThemedRoute = pathname.startsWith('/admin') || pathname.startsWith('/dashboard')
  
  // Use forcedTheme for non-themed routes to always render in light mode
  const themeProps = {
    ...props,
    // If not on a themed route, force light theme regardless of user preference
    forcedTheme: isThemedRoute ? undefined : 'light'
  }
  
  // Set isClient state once mounted
  useEffect(() => {
    setMounted(true)
  }, [])
  
  // Apply light theme to DOM for public routes
  useEffect(() => {
    if (!isThemedRoute && mounted) {
      // This is a public page - ensure it's in light mode
      document.documentElement.classList.remove('dark')
      document.documentElement.style.colorScheme = 'light'
      
      // Reset any persistent local storage theme for public pages
      if (localStorage.getItem('theme') === 'dark') {
        localStorage.setItem('theme', 'light')
      }
    }
  }, [isThemedRoute, mounted, pathname])

  // Always use ThemeProvider but with conditional forcedTheme
  return <NextThemesProvider {...themeProps}>{children}</NextThemesProvider>
}