// src/components/theme/conditional-theme-provider.tsx
'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ThemeProviderProps } from 'next-themes'

export function ConditionalThemeProvider({ children, ...props }: ThemeProviderProps) {
  const pathname = usePathname()
  
  // Define which routes allow theming
  const themedRoutes = ['/admin', '/dashboard']
  const isThemedRoute = themedRoutes.some(route => pathname.startsWith(route))
  
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