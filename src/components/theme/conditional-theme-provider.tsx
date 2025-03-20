// src/components/theme/conditional-theme-provider.tsx
'use client'

import { usePathname } from 'next/navigation'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ThemeProviderProps } from 'next-themes'

export function ConditionalThemeProvider({ children, ...props }: ThemeProviderProps) {
  const pathname = usePathname()
  
  // Check if the current route is an admin or dashboard route
  const isThemedRoute = pathname.startsWith('/admin') || pathname.startsWith('/dashboard')
  
  // Only apply the theme provider to admin and dashboard routes
  if (isThemedRoute) {
    return <NextThemesProvider {...props}>{children}</NextThemesProvider>
  }
  
  // For public routes, render children without theme provider
  return <>{children}</>
}