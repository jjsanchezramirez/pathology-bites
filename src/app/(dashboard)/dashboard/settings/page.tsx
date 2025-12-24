// src/app/(dashboard)/dashboard/settings/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/shared/components/ui/card'
import { useAuthStatus } from '@/features/auth/hooks/use-auth-status'
import { useTheme } from 'next-themes'
import { toast } from '@/shared/utils/toast'
import { getTextZoomConfig, getValidZoomLevel } from '@/shared/utils/text-zoom'
import { useDashboardSettings } from '@/shared/contexts/dashboard-settings-provider'
import { useDashboardTheme } from '@/shared/contexts/dashboard-theme-context'
import {
  userSettingsService,
  type QuizSettings,
  type NotificationSettings
} from '@/shared/services/user-settings'
import { useUserSettings } from '@/shared/hooks/use-user-settings'
import {
  AppearanceSettings,
  NotificationSettingsCard,
  QuizSettingsCard,
  PrivacySecuritySettings,
  ResetSettingsCard,
  DangerZone,
  DeleteAccountDialog,
  ResetSettingsDialog,
  SettingsLoading
} from '@/features/settings/components'

export default function SettingsPage() {
  const { user, isAuthenticated, isLoading } = useAuthStatus()
  const { theme, setTheme } = useTheme()
  const { currentTheme: dashboardTheme, setTheme: setDashboardTheme, availableThemes } = useDashboardTheme()

  // Use cached user settings hook
  const { data: userSettings, isLoading: settingsLoading } = useUserSettings({
    enabled: isAuthenticated && !!user
  })

  const [preferences, setPreferences] = useState<NotificationSettings>({
    email_notifications: true,
    quiz_reminders: true,
    progress_updates: true
  })
  const [quizSettings, setQuizSettings] = useState<QuizSettings>({
    default_question_count: 10,
    default_mode: 'tutor',
    default_timing: 'untimed',
    default_question_type: 'unused',
    default_category_selection: 'all'
  })
  const [saving, setSaving] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // Use shared text zoom context
  const { textZoom, setTextZoom: setTextZoomContext } = useDashboardSettings()

  useEffect(() => {
    setMounted(true)
  }, [])

  // Apply settings when loaded from cache
  useEffect(() => {
    if (userSettings) {
      setPreferences(userSettings.notification_settings)
      setQuizSettings(userSettings.quiz_settings)
      // Note: textZoom is already handled by DashboardSettingsProvider
      // We just read it from context, we don't set it here to avoid infinite loops
    }
  }, [userSettings])

  // fetchUserPreferences is now deprecated - settings are loaded via useUserSettings hook

  const handlePreferenceChange = async (key: keyof NotificationSettings, value: boolean) => {
    try {
      setSaving(true)
      const newPreferences = { ...preferences, [key]: value }
      setPreferences(newPreferences)

      // Save to database
      await userSettingsService.updateNotificationSettings(newPreferences)
      // Don't invalidate cache immediately - local state is already updated
      // Cache will be refreshed on next page load
    } catch (error) {
      console.error('Error updating preference:', error)
      toast.error('Failed to update preference')
      // Revert the change
      setPreferences(prev => ({ ...prev, [key]: !value }))
    } finally {
      setSaving(false)
    }
  }

  const handleQuizSettingChange = async (key: keyof QuizSettings, value: any) => {
    try {
      setSaving(true)
      const newSettings = { ...quizSettings, [key]: value }
      setQuizSettings(newSettings)

      // Save to database
      await userSettingsService.updateQuizSettings(newSettings)
      // Don't invalidate cache immediately - local state is already updated
      // Cache will be refreshed on next page load
    } catch (error) {
      console.error('Error updating quiz setting:', error)
      toast.error('Failed to update quiz setting')
      // Revert the change
      setQuizSettings(prev => ({ ...prev, [key]: quizSettings[key] }))
    } finally {
      setSaving(false)
    }
  }



  const handleTextZoomChange = (newZoom: number) => {
    try {
      setSaving(true)
      const validZoom = getValidZoomLevel(newZoom)

      // Use context to set text zoom (this will update localStorage and mark as dirty)
      setTextZoomContext(validZoom)

      // UI feedback is immediate - no API call needed!
      // Settings will sync when user leaves the page or closes the popover
    } catch (error) {
      console.error('Error updating text size:', error)
      toast.error('Failed to update text size')
    } finally {
      setSaving(false)
    }
  }

  const handleDashboardThemeChange = async (newTheme: string) => {
    try {
      setSaving(true)
      // Use DashboardThemeProvider's setTheme which handles saving to correct field
      // (dashboard_theme_admin or dashboard_theme_user based on admin mode)
      setDashboardTheme(newTheme)
      toast.success('Dashboard theme updated')
    } catch (error) {
      console.error('Error updating dashboard theme:', error)
      toast.error('Failed to update dashboard theme')
    } finally {
      setSaving(false)
    }
  }

  const handleResetAllSettings = async () => {
    try {
      setIsResetting(true)

      // Reset to defaults
      const config = getTextZoomConfig()
      const defaultPreferences = {
        email_notifications: true,
        quiz_reminders: true,
        progress_updates: true
      }
      const defaultQuizSettings = {
        default_question_count: 10,
        default_mode: 'tutor' as const,
        default_timing: 'untimed' as const,
        default_question_type: 'unused' as const,
        default_category_selection: 'all' as const
      }
      const defaultUISettings = {
        text_zoom: config.default,
        welcome_message_seen: false
      }

      // Update local state
      setPreferences(defaultPreferences)
      setQuizSettings(defaultQuizSettings)
      setTextZoomContext(config.default)
      setTheme('system')
      // Reset dashboard theme using DashboardThemeProvider which handles admin mode
      setDashboardTheme('default')

      // Save to database
      await userSettingsService.updateNotificationSettings(defaultPreferences)
      await userSettingsService.updateQuizSettings(defaultQuizSettings)
      await userSettingsService.updateUISettings(defaultUISettings)

      toast.success('All settings have been reset to defaults')
      setShowResetDialog(false)
    } catch (error) {
      console.error('Error resetting settings:', error)
      toast.error('Failed to reset settings')
    } finally {
      setIsResetting(false)
    }
  }



  const handleDataExport = async () => {
    try {
      setIsExporting(true)

      // Get CSRF token
      const csrfResponse = await fetch('/api/public/csrf-token', {
        method: 'GET',
        credentials: 'same-origin',
        headers: { 'Accept': 'application/json' }
      })
      const csrfData = await csrfResponse.json()
      const csrfToken = csrfData.token

      const response = await fetch('/api/user/data-export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        credentials: 'include',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to export data')
      }

      const data = await response.json()

      // Create and download the file
      const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pathology-bites-data-export-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success('Data export completed successfully')
    } catch (error) {
      console.error('Error exporting data:', error)
      toast.error('Failed to export data')
    } finally {
      setIsExporting(false)
    }
  }

  const handleDeleteAccount = async (password: string) => {
    try {
      setIsDeleting(true)

      const response = await fetch('/api/user/account/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete account')
      }

      toast.success('Account deleted successfully')

      // Clear local storage and session storage
      if (typeof window !== 'undefined') {
        localStorage.clear()
        sessionStorage.clear()
      }

      // Force a hard redirect to clear all cached data and session
      window.location.href = '/'
    } catch (error) {
      console.error('Error deleting account:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete account')
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  if (isLoading || settingsLoading) {
    return <SettingsLoading />
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Please log in to access settings.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account preferences and quiz settings.
          </p>
        </div>

        <div className="space-y-6">
          <AppearanceSettings
            theme={theme || 'system'}
            mounted={mounted}
            saving={saving}
            dashboardTheme={dashboardTheme}
            availableThemes={availableThemes}
            textZoom={textZoom}
            onThemeChange={setTheme}
            onDashboardThemeChange={handleDashboardThemeChange}
            onTextZoomChange={handleTextZoomChange}
          />

          <NotificationSettingsCard
            preferences={preferences}
            saving={saving}
            onPreferenceChange={handlePreferenceChange}
          />

          <QuizSettingsCard
            quizSettings={quizSettings}
            saving={saving}
            onQuizSettingChange={handleQuizSettingChange}
          />

          <PrivacySecuritySettings
            isExporting={isExporting}
            onDataExport={handleDataExport}
          />

          <ResetSettingsCard
            saving={saving}
            onResetClick={() => setShowResetDialog(true)}
          />

          <DangerZone
            onDeleteAccountClick={() => setShowDeleteDialog(true)}
          />
        </div>

        <DeleteAccountDialog
          open={showDeleteDialog}
          isDeleting={isDeleting}
          onOpenChange={setShowDeleteDialog}
          onConfirm={handleDeleteAccount}
        />

        <ResetSettingsDialog
          open={showResetDialog}
          isResetting={isResetting}
          onOpenChange={setShowResetDialog}
          onConfirm={handleResetAllSettings}
        />
      </div>
    </div>
  )
}
