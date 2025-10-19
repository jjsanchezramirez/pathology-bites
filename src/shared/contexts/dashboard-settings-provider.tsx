// src/shared/contexts/dashboard-settings-provider.tsx
'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { userSettingsService } from '@/shared/services/user-settings'
import { createClient } from '@/shared/services/client'
import { getTextZoomConfig, applyTextZoom, getValidZoomLevel } from '@/shared/utils/text-zoom'
import { useUserRole } from '@/shared/hooks/use-user-role'

interface DashboardSettingsContextType {
  textZoom: number
  setTextZoom: (zoom: number) => void
  dashboardTheme: string
  setDashboardTheme: (theme: string) => void
  isLoading: boolean
}

const DashboardSettingsContext = createContext<DashboardSettingsContextType | undefined>(undefined)

export function DashboardSettingsProvider({ children }: { children: ReactNode }) {
  const { isAdmin } = useUserRole()
  const [textZoom, setTextZoomState] = useState(1.0)
  const [dashboardTheme, setDashboardThemeState] = useState('default')
  const [isLoading, setIsLoading] = useState(true)
  const config = getTextZoomConfig()

  // Load settings from database on mount (user is authenticated in dashboard)
  useEffect(() => {
    const loadSettings = async () => {
      try {
        console.log('[DashboardSettings] Loading settings from database...')
        const settings = await userSettingsService.getUserSettings()

        console.log('[DashboardSettings] Received:', settings.ui_settings)

        // Sync UI settings to localStorage for DashboardThemeContext
        try {
          localStorage.setItem('pathology-bites-ui-settings', JSON.stringify(settings.ui_settings))
          console.log('[DashboardSettings] Synced ui_settings to localStorage')
        } catch (storageError) {
          console.warn('[DashboardSettings] Failed to sync to localStorage:', storageError)
        }

        // Apply text zoom
        const zoom = settings.ui_settings?.text_zoom ?? config.default
        const validZoom = getValidZoomLevel(zoom)
        setTextZoomState(validZoom)
        applyTextZoom(validZoom)

        // Apply dashboard theme - use same logic as DashboardThemeContext
        const adminModeCookie = document.cookie
          .split('; ')
          .find(row => row.startsWith('admin-mode='))
          ?.split('=')[1]

        // If no cookie and user is not admin, default to 'user' mode (same as DashboardThemeContext)
        const adminMode = !adminModeCookie && !isAdmin ? 'user' : (adminModeCookie || 'admin')

        const themeKey = adminMode === 'admin'
          ? 'dashboard_theme_admin'
          : 'dashboard_theme_user'

        const theme = settings.ui_settings?.[themeKey] ?? 'default'
        setDashboardThemeState(theme)

        console.log('[DashboardSettings] Applied - zoom:', validZoom, 'theme:', theme, 'adminMode:', adminMode)
      } catch (error) {
        console.error('[DashboardSettings] Failed to load:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadSettings()
  }, [config.default, isAdmin])

  // Update text zoom
  const setTextZoom = async (newZoom: number) => {
    const validZoom = getValidZoomLevel(newZoom)
    setTextZoomState(validZoom)
    applyTextZoom(validZoom)

    try {
      await userSettingsService.updateUISettings({ text_zoom: validZoom })
      console.log('[DashboardSettings] Text zoom saved:', validZoom)
    } catch (error) {
      console.error('[DashboardSettings] Failed to save text zoom:', error)
    }
  }

  // Update dashboard theme
  const setDashboardTheme = async (theme: string) => {
    setDashboardThemeState(theme)

    try {
      const adminModeCookie = document.cookie
        .split('; ')
        .find(row => row.startsWith('admin-mode='))
        ?.split('=')[1]

      // Use same logic as loadSettings
      const adminMode = !adminModeCookie && !isAdmin ? 'user' : (adminModeCookie || 'admin')

      const themeKey = adminMode === 'admin'
        ? 'dashboard_theme_admin'
        : 'dashboard_theme_user'

      await userSettingsService.updateUISettings({ [themeKey]: theme })
      console.log('[DashboardSettings] Theme saved:', theme)
    } catch (error) {
      console.error('[DashboardSettings] Failed to save theme:', error)
    }
  }

  const value: DashboardSettingsContextType = {
    textZoom,
    setTextZoom,
    dashboardTheme,
    setDashboardTheme,
    isLoading
  }

  return (
    <DashboardSettingsContext.Provider value={value}>
      {children}
    </DashboardSettingsContext.Provider>
  )
}

export function useDashboardSettings() {
  const context = useContext(DashboardSettingsContext)
  if (context === undefined) {
    throw new Error('useDashboardSettings must be used within DashboardSettingsProvider')
  }
  return context
}

