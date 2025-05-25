// src/components/theme/theme-toggle.tsx
'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const { theme, setTheme, forcedTheme } = useTheme()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Check if theming is allowed on current route
  const themedRoutes = ['/admin', '/dashboard']
  const isThemedRoute = themedRoutes.some(route => pathname.startsWith(route))
  
  // Don't render until mounted to prevent hydration mismatch
  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="hover:bg-primary/10" disabled>
        <div className="h-5 w-5" />
      </Button>
    )
  }

  // Don't show toggle on non-themed routes (since theme is forced)
  if (!isThemedRoute || forcedTheme) {
    return null
  }

  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="hover:bg-primary/10"
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {isDark ? (
        <Moon size={20} className="transition-all" />
      ) : (
        <Sun size={20} className="transition-all" />
      )}
    </Button>
  )
}