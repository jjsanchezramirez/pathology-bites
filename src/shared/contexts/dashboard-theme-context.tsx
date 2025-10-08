// src/shared/contexts/dashboard-theme-context.tsx
'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { dashboardThemes, getThemeById, getDefaultTheme, type DashboardTheme } from '@/shared/config/dashboard-themes'
import { useUserRole } from '@/shared/hooks/use-user-role'

type AdminMode = 'admin' | 'user'

interface DashboardThemeContextType {
  currentTheme: DashboardTheme
  setTheme: (themeId: string) => void
  availableThemes: DashboardTheme[]
  isLoading: boolean
  adminMode: AdminMode
  setAdminMode: (mode: AdminMode) => void
}

const DashboardThemeContext = createContext<DashboardThemeContextType | undefined>(undefined)

const STORAGE_KEY = 'pathology-bites-dashboard-theme'
const ADMIN_MODE_STORAGE_KEY = 'pathology-bites-admin-mode'

interface DashboardThemeProviderProps {
  children: React.ReactNode
}

export function DashboardThemeProvider({ children }: DashboardThemeProviderProps) {
  const { isAdmin } = useUserRole()
  const [currentTheme, setCurrentTheme] = useState<DashboardTheme>(getDefaultTheme())
  const [adminMode, setAdminModeState] = useState<AdminMode>('admin')
  const [isLoading, setIsLoading] = useState(true)

  // Get available themes based on admin mode
  const getAvailableThemes = (mode: AdminMode): DashboardTheme[] => {
    if (mode === 'admin') {
      // Admin mode: only default theme for now
      return dashboardThemes.filter(theme => theme.id === 'default')
    } else {
      // User mode: notebook and tangerine themes
      return dashboardThemes.filter(theme => ['notebook', 'tangerine'].includes(theme.id))
    }
  }

  // Get default theme for mode
  const getDefaultThemeForMode = (mode: AdminMode): DashboardTheme => {
    if (mode === 'admin') {
      return getThemeById('default') || getDefaultTheme()
    } else {
      return getThemeById('tangerine') || getDefaultTheme()
    }
  }

  // Load theme and admin mode from localStorage/cookie on mount
  useEffect(() => {
    const loadSettings = () => {
      try {
        // Load admin mode from cookie (to match middleware)
        const adminModeCookie = document.cookie
          .split('; ')
          .find(row => row.startsWith('admin-mode='))
          ?.split('=')[1] as AdminMode || 'admin'
        
        setAdminModeState(adminModeCookie)

        // Load theme based on admin mode
        const availableThemes = getAvailableThemes(adminModeCookie)
        const savedThemeId = localStorage.getItem(`${STORAGE_KEY}-${adminModeCookie}`)
        
        let themeToSet: DashboardTheme
        
        if (savedThemeId) {
          const theme = getThemeById(savedThemeId)
          // Check if saved theme is available for current mode
          if (theme && availableThemes.some(t => t.id === theme.id)) {
            themeToSet = theme
          } else {
            themeToSet = getDefaultThemeForMode(adminModeCookie)
          }
        } else {
          themeToSet = getDefaultThemeForMode(adminModeCookie)
        }
        
        setCurrentTheme(themeToSet)
      } catch (error) {
        console.warn('Failed to load dashboard settings:', error)
        setCurrentTheme(getDefaultTheme())
      } finally {
        setIsLoading(false)
      }
    }

    loadSettings()
  }, [])

  // Watch for admin mode changes via cookie
  useEffect(() => {
    const handleCookieChange = () => {
      const adminModeCookie = document.cookie
        .split('; ')
        .find(row => row.startsWith('admin-mode='))
        ?.split('=')[1] as AdminMode || 'admin'
      
      if (adminModeCookie !== adminMode) {
        setAdminModeState(adminModeCookie)
        // Switch to default theme for new mode
        const newTheme = getDefaultThemeForMode(adminModeCookie)
        setCurrentTheme(newTheme)
      }
    }

    // Poll for cookie changes every 100ms (simple approach)
    const interval = setInterval(handleCookieChange, 100)
    return () => clearInterval(interval)
  }, [adminMode])

  // Apply theme CSS variables when theme changes
  useEffect(() => {
    if (isLoading) return

    const applyThemeVariables = (theme: DashboardTheme) => {
      const root = document.documentElement

      // Check if we're in dark mode
      const isDarkMode = root.classList.contains('dark')
      const variables = isDarkMode ? theme.variables.dark : theme.variables.light

      // Apply theme variables directly to override the default CSS variables
      Object.entries(variables).forEach(([key, value]) => {
        // Handle different types of CSS variables
        let formattedValue = value

        // For color variables, ensure HSL format (but not for shadows which already contain hsl())
        if ((key.includes('color') || key.includes('ground') || key.includes('border') ||
            key.includes('ring') || key.includes('chart') || key.includes('sidebar') ||
            key === '--background' || key === '--foreground' || key === '--card' ||
            key === '--popover' || key === '--primary' || key === '--secondary' ||
            key === '--muted' || key === '--accent' || key === '--destructive' ||
            key === '--input') && !key.includes('shadow')) {
          formattedValue = value.includes('hsl(') ? value : `hsl(${value})`
        }
        // For font, shadow, radius, tracking, and spacing variables, use as-is
        // These are already properly formatted

        root.style.setProperty(key, formattedValue)
      })

      // Set a data attribute to identify the current dashboard theme
      root.setAttribute('data-dashboard-theme', theme.id)
    }

    applyThemeVariables(currentTheme)

    // Listen for theme mode changes (light/dark) to reapply variables
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          applyThemeVariables(currentTheme)
        }
      })
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })

    return () => observer.disconnect()
  }, [currentTheme, isLoading])

  const setTheme = (themeId: string) => {
    const theme = getThemeById(themeId)
    const availableThemes = getAvailableThemes(adminMode)
    
    // Check if theme is available for current mode
    if (theme && availableThemes.some(t => t.id === theme.id)) {
      setCurrentTheme(theme)
      try {
        // Store theme preference per mode in localStorage (immediate)
        localStorage.setItem(`${STORAGE_KEY}-${adminMode}`, themeId)
        
        // Also sync to database for persistence across devices
        syncThemeToDatabase(adminMode, themeId)
      } catch (error) {
        console.warn('Failed to save dashboard theme:', error)
      }
    }
  }

  // Sync theme preference to database
  const syncThemeToDatabase = async (mode: AdminMode, themeId: string) => {
    try {
      const response = await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'ui_settings',
          settings: {
            [`dashboard_theme_${mode}`]: themeId
          }
        })
      })
      
      if (!response.ok) {
        console.warn('Failed to sync theme to database:', response.statusText)
      }
    } catch (error) {
      console.warn('Failed to sync theme to database:', error)
    }
  }

  const setAdminMode = (mode: AdminMode) => {
    // Update cookie (to sync with middleware)
    document.cookie = `admin-mode=${mode}; path=/; max-age=${60 * 60 * 24 * 30}` // 30 days
    
    setAdminModeState(mode)
    
    // Switch to appropriate theme for new mode
    const newTheme = getDefaultThemeForMode(mode)
    setCurrentTheme(newTheme)
  }

  const value: DashboardThemeContextType = {
    currentTheme,
    setTheme,
    availableThemes: getAvailableThemes(adminMode),
    isLoading,
    adminMode,
    setAdminMode
  }

  return (
    <DashboardThemeContext.Provider value={value}>
      {children}
    </DashboardThemeContext.Provider>
  )
}

export function useDashboardTheme() {
  const context = useContext(DashboardThemeContext)
  if (context === undefined) {
    throw new Error('useDashboardTheme must be used within a DashboardThemeProvider')
  }
  return context
}

// Hook to get theme-aware CSS classes for dashboard components
export function useDashboardThemeClasses() {
  const { currentTheme } = useDashboardTheme()
  
  return {
    themeId: currentTheme.id,
    // Helper function to get dashboard-specific classes
    getThemeClass: (baseClass: string) => {
      return `${baseClass} dashboard-themed`
    }
  }
}
