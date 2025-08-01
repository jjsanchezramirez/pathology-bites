// src/components/theme/theme-mode-toggle.tsx
'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { usePathname } from 'next/navigation'
import { Button } from '@/shared/components/ui/button'
import { useEffect, useState } from 'react'

export function ThemeModeToggle() {
  const { theme, setTheme, forcedTheme } = useTheme()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Check if theming is allowed on current route
  const themedRoutes = ['/admin', '/dashboard']
  const isThemedRoute = pathname ? themedRoutes.some(route => pathname.startsWith(route)) : false
  
  // Don't render until mounted to prevent hydration mismatch
  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="hover:bg-primary/10" disabled>
        <Sun size={20} className="transition-all opacity-50" />
      </Button>
    )
  }

  // Don't show toggle on non-themed routes (since theme is forced)
  if (!isThemedRoute || forcedTheme) {
    return null
  }

  const cycleTheme = () => {
    switch (theme) {
      case 'light':
        setTheme('dark')
        break
      case 'dark':
        setTheme('system')
        break
      case 'system':
      default:
        setTheme('light')
        break
    }
  }

  const getIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun size={20} className="transition-all" />
      case 'dark':
        return <Moon size={20} className="transition-all" />
      case 'system':
      default:
        return <Monitor size={20} className="transition-all" />
    }
  }

  const getTitle = () => {
    switch (theme) {
      case 'light':
        return 'Switch to dark mode'
      case 'dark':
        return 'Switch to system mode'
      case 'system':
      default:
        return 'Switch to light mode'
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycleTheme}
      className="hover:bg-primary/10"
      title={getTitle()}
    >
      {getIcon()}
    </Button>
  )
}