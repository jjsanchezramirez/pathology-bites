// src/shared/contexts/dashboard-theme-context.tsx
'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { dashboardThemes, getThemeById, getDefaultTheme, type DashboardTheme } from '@/shared/config/dashboard-themes'

interface DashboardThemeContextType {
  currentTheme: DashboardTheme
  setTheme: (themeId: string) => void
  availableThemes: DashboardTheme[]
  isLoading: boolean
}

const DashboardThemeContext = createContext<DashboardThemeContextType | undefined>(undefined)

const STORAGE_KEY = 'pathology-bites-dashboard-theme'

interface DashboardThemeProviderProps {
  children: React.ReactNode
}

export function DashboardThemeProvider({ children }: DashboardThemeProviderProps) {
  const [currentTheme, setCurrentTheme] = useState<DashboardTheme>(getDefaultTheme())
  const [isLoading, setIsLoading] = useState(true)

  // Load theme from localStorage on mount
  useEffect(() => {
    const loadTheme = () => {
      try {
        const savedThemeId = localStorage.getItem(STORAGE_KEY)
        if (savedThemeId) {
          const theme = getThemeById(savedThemeId)
          if (theme) {
            setCurrentTheme(theme)
          }
        }
      } catch (error) {
        console.warn('Failed to load dashboard theme from localStorage:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadTheme()
  }, [])

  // Apply theme CSS variables when theme changes
  useEffect(() => {
    if (isLoading) return

    const applyThemeVariables = (theme: DashboardTheme) => {
      const root = document.documentElement

      // Check if we're in dark mode
      const isDarkMode = root.classList.contains('dark')
      const variables = isDarkMode ? theme.variables.dark : theme.variables.light

      // Only apply theme variables if we're not using the default theme
      if (theme.id === 'default') {
        // Remove any dashboard-specific variables to use the original theme
        const allKeys = [
          '--background', '--foreground', '--card', '--card-foreground', '--popover', '--popover-foreground',
          '--primary', '--primary-foreground', '--secondary', '--secondary-foreground', '--muted', '--muted-foreground',
          '--accent', '--accent-foreground', '--destructive', '--destructive-foreground', '--border', '--input', '--ring',
          '--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5',
          '--sidebar', '--sidebar-foreground', '--sidebar-primary', '--sidebar-primary-foreground',
          '--sidebar-accent', '--sidebar-accent-foreground', '--sidebar-border', '--sidebar-ring'
        ]
        allKeys.forEach((key) => {
          root.style.removeProperty(`--dashboard${key}`)
        })
      } else {
        // Apply theme variables with a dashboard-specific prefix
        Object.entries(variables).forEach(([key, value]) => {
          root.style.setProperty(`--dashboard${key}`, value)
        })
      }

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
    if (theme) {
      setCurrentTheme(theme)
      try {
        localStorage.setItem(STORAGE_KEY, themeId)
      } catch (error) {
        console.warn('Failed to save dashboard theme to localStorage:', error)
      }
    }
  }

  const value: DashboardThemeContextType = {
    currentTheme,
    setTheme,
    availableThemes: dashboardThemes,
    isLoading
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
