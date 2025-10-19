// src/shared/contexts/dashboard-theme-context.tsx
'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { dashboardThemes, getThemeById, getDefaultTheme, type DashboardTheme } from '@/shared/config/dashboard-themes'
import { useUserRole } from '@/shared/hooks/use-user-role'
import {
  type AdminMode,
  getAdminModeFromCookie,
  setAdminModeCookie,
  getThemeKeyForMode,
  isAdminTypeMode,
} from '@/shared/utils/admin-mode'

interface DashboardThemeContextType {
  currentTheme: DashboardTheme
  setTheme: (themeId: string) => void
  availableThemes: DashboardTheme[]
  isLoading: boolean
  adminMode: AdminMode
  setAdminMode: (mode: AdminMode) => void
  isTransitioning: boolean
  setTransitioning: (transitioning: boolean) => void
}

const DashboardThemeContext = createContext<DashboardThemeContextType | undefined>(undefined)

interface DashboardThemeProviderProps {
  children: React.ReactNode
}

export function DashboardThemeProvider({ children }: DashboardThemeProviderProps) {
  const { isAdmin } = useUserRole()

  const [currentTheme, setCurrentTheme] = useState<DashboardTheme>(getDefaultTheme())
  const [adminMode, setAdminModeState] = useState<AdminMode>(() => getAdminModeFromCookie(isAdmin))
  const [isLoading, setIsLoading] = useState(true)
  const [isTransitioning, setIsTransitioning] = useState(false)

  // Get available themes based on admin mode
  const getAvailableThemes = (mode: AdminMode): DashboardTheme[] => {
    if (isAdminTypeMode(mode)) {
      // Admin/Creator/Reviewer modes: only default theme
      return dashboardThemes.filter(theme => theme.id === 'default')
    } else {
      // User mode: notebook and tangerine themes
      return dashboardThemes.filter(theme => ['notebook', 'tangerine'].includes(theme.id))
    }
  }

  // Get default theme for mode
  const getDefaultThemeForMode = (mode: AdminMode): DashboardTheme => {
    if (isAdminTypeMode(mode)) {
      return getThemeById('default') || getDefaultTheme()
    } else {
      return getThemeById('tangerine') || getDefaultTheme()
    }
  }

  // Cleanup: Reset to default theme when component unmounts (user leaves dashboard)
  useEffect(() => {
    return () => {
      const root = document.documentElement
      const defaultTheme = getThemeById('default') || getDefaultTheme()
      const isDarkMode = root.classList.contains('dark')
      const variables = isDarkMode ? defaultTheme.variables.dark : defaultTheme.variables.light

      // Reset to default theme variables
      Object.entries(variables).forEach(([key, value]) => {
        let formattedValue = value
        if ((key.includes('color') || key.includes('ground') || key.includes('border') ||
            key.includes('ring') || key.includes('chart') || key.includes('sidebar') ||
            key === '--background' || key === '--foreground' || key === '--card' ||
            key === '--popover' || key === '--primary' || key === '--secondary' ||
            key === '--muted' || key === '--accent' || key === '--destructive' ||
            key === '--input') && !key.includes('shadow')) {
          formattedValue = value.includes('hsl(') ? value : `hsl(${value})`
        }
        root.style.setProperty(key, formattedValue)
      })

      root.setAttribute('data-dashboard-theme', 'default')
      console.log('[DashboardTheme] Cleanup: Reset to default theme')
    }
  }, [])

  // Load theme and admin mode from localStorage on mount (no API calls!)
  useEffect(() => {
    try {
      console.log('[DashboardTheme] Loading theme from localStorage...')

      // Get admin mode using utility function
      const defaultMode = getAdminModeFromCookie(isAdmin)
      console.log('[DashboardTheme] Admin mode:', defaultMode, 'isAdmin:', isAdmin)
      setAdminModeState(defaultMode)

      // Load theme based on admin mode from localStorage
      const availableThemes = getAvailableThemes(defaultMode)
      let themeToSet: DashboardTheme

      // Load from localStorage (synced by SettingsSyncProvider)
      const uiSettingsStr = localStorage.getItem('pathology-bites-ui-settings')
      console.log('[DashboardTheme] localStorage value:', uiSettingsStr)

      if (uiSettingsStr) {
        try {
          const uiSettings = JSON.parse(uiSettingsStr)
          const themeKey = getThemeKeyForMode(defaultMode)
          const themeId = uiSettings[themeKey]

          console.log(`[DashboardTheme] Mode: ${defaultMode}, Theme:`, themeId)

          if (themeId) {
            const theme = getThemeById(themeId)
            if (theme && availableThemes.some(t => t.id === theme.id)) {
              themeToSet = theme
              console.log('[DashboardTheme] Loaded from localStorage:', themeToSet.id)
            } else {
              themeToSet = getDefaultThemeForMode(defaultMode)
              console.log('[DashboardTheme] Theme not available, using default:', themeToSet.id)
            }
          } else {
            themeToSet = getDefaultThemeForMode(defaultMode)
            console.log('[DashboardTheme] No theme preference, using default:', themeToSet.id)
          }
        } catch (parseError) {
          console.warn('[DashboardTheme] Failed to parse ui_settings:', parseError)
          themeToSet = getDefaultThemeForMode(defaultMode)
        }
      } else {
        themeToSet = getDefaultThemeForMode(defaultMode)
        console.log('[DashboardTheme] No ui_settings in localStorage, using default:', themeToSet.id)
      }

      console.log('[DashboardTheme] Applying theme:', themeToSet.id)
      setCurrentTheme(themeToSet)
    } catch (error) {
      console.warn('[DashboardTheme] Failed to load dashboard settings:', error)
      setCurrentTheme(getDefaultTheme())
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Watch for admin mode changes via cookie
  useEffect(() => {
    const handleCookieChange = () => {
      const newMode = getAdminModeFromCookie(isAdmin)

      if (newMode !== adminMode) {
        setAdminModeState(newMode)

        // Load saved theme for new mode from localStorage
        const uiSettingsStr = localStorage.getItem('pathology-bites-ui-settings')
        let newTheme: DashboardTheme

        if (uiSettingsStr) {
          try {
            const uiSettings = JSON.parse(uiSettingsStr)
            const themeKey = getThemeKeyForMode(newMode)
            const themeId = uiSettings[themeKey]

            if (themeId) {
              const theme = getThemeById(themeId)
              const availableThemes = getAvailableThemes(newMode)
              if (theme && availableThemes.some(t => t.id === theme.id)) {
                newTheme = theme
                console.log(`[DashboardTheme] Loaded saved theme for ${newMode} mode:`, themeId)
              } else {
                newTheme = getDefaultThemeForMode(newMode)
                console.log(`[DashboardTheme] Theme not available for ${newMode} mode, using default`)
              }
            } else {
              newTheme = getDefaultThemeForMode(newMode)
              console.log(`[DashboardTheme] No saved theme for ${newMode} mode, using default`)
            }
          } catch (error) {
            console.warn('[DashboardTheme] Failed to load theme for mode change:', error)
            newTheme = getDefaultThemeForMode(newMode)
          }
        } else {
          newTheme = getDefaultThemeForMode(newMode)
          console.log(`[DashboardTheme] No ui_settings in localStorage for ${newMode} mode, using default`)
        }

        setCurrentTheme(newTheme)
      }
    }

    // Poll for cookie changes every 100ms (simple approach)
    const interval = setInterval(handleCookieChange, 100)
    return () => clearInterval(interval)
  }, [adminMode, isAdmin])

  // Watch for localStorage changes (when DashboardSettingsProvider syncs settings)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'pathology-bites-ui-settings' && e.newValue) {
        try {
          const uiSettings = JSON.parse(e.newValue)
          const themeKey = getThemeKeyForMode(adminMode)
          const themeId = uiSettings[themeKey]

          if (themeId) {
            const theme = getThemeById(themeId)
            const availableThemes = getAvailableThemes(adminMode)
            if (theme && availableThemes.some(t => t.id === theme.id)) {
              setCurrentTheme(theme)
              console.log('[DashboardTheme] Updated theme from localStorage:', themeId)
            }
          }
        } catch (error) {
          console.warn('[DashboardTheme] Failed to update theme from storage event:', error)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
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
        // Update localStorage immediately (no API call!)
        const uiSettingsStr = localStorage.getItem('pathology-bites-ui-settings')
        const uiSettings = uiSettingsStr ? JSON.parse(uiSettingsStr) : {}

        // Store theme preference per mode
        const themeKey = getThemeKeyForMode(adminMode)
        uiSettings[themeKey] = themeId

        localStorage.setItem('pathology-bites-ui-settings', JSON.stringify(uiSettings))

        // Mark as dirty for next sync
        const dirtySections = localStorage.getItem('pathology-bites-dirty-sections')
        const dirty = dirtySections ? JSON.parse(dirtySections) : []
        if (!dirty.includes('ui_settings')) {
          dirty.push('ui_settings')
          localStorage.setItem('pathology-bites-dirty-sections', JSON.stringify(dirty))
        }

        console.log(`[DashboardTheme] Saved ${adminMode} theme:`, themeId)
      } catch (error) {
        console.warn('[DashboardTheme] Failed to save theme:', error)
      }
    }
  }

  const setAdminMode = (mode: AdminMode) => {
    // Update cookie using utility function
    setAdminModeCookie(mode)

    setAdminModeState(mode)

    // Switch to appropriate theme for new mode
    const newTheme = getDefaultThemeForMode(mode)
    setCurrentTheme(newTheme)
  }

  const setTransitioning = (transitioning: boolean) => {
    setIsTransitioning(transitioning)
  }

  // Recalculate available themes whenever adminMode changes
  const availableThemes = getAvailableThemes(adminMode)

  const value: DashboardThemeContextType = {
    currentTheme,
    setTheme,
    availableThemes,
    isLoading,
    adminMode,
    setAdminMode,
    isTransitioning,
    setTransitioning
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
