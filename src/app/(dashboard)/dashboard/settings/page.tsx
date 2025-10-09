// src/app/(dashboard)/dashboard/settings/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Switch } from '@/shared/components/ui/switch'
import { Label } from '@/shared/components/ui/label'
import { Separator } from '@/shared/components/ui/separator'
import { useAuthStatus } from '@/features/auth/hooks/use-auth-status'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import {
  Moon,
  Sun,
  Bell,
  Shield,
  Trash2,
  RefreshCw,
  AlertTriangle,
  BookOpen,
  RotateCcw
} from 'lucide-react'
import {
  getTextZoomConfig,
  getValidZoomLevel,
  legacyFontSizeToZoom,
  zoomToLegacyFontSize
} from '@/shared/utils/text-zoom'
import { useDashboardSettings } from '@/shared/contexts/dashboard-settings-provider'
import { useDashboardTheme } from '@/shared/contexts/dashboard-theme-context'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,

} from '@/shared/components/ui/dialog'
import { Minus, Plus } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import {
  QuizMode,
  QuizTiming,
  QuestionType,
  CategorySelection,
  QUIZ_MODE_CONFIG,
  QUIZ_TIMING_CONFIG,
  QUESTION_TYPE_CONFIG,
  CATEGORY_SELECTION_CONFIG
} from '@/features/quiz/types/quiz'
import {
  userSettingsService,
  type QuizSettings,
  type NotificationSettings
} from '@/shared/services/user-settings'

// Remove local interfaces since we're using the ones from the service

export default function SettingsPage() {
  const { user, isAuthenticated, isLoading } = useAuthStatus()
  const { theme, setTheme } = useTheme()
  const { currentTheme: dashboardTheme, setTheme: setDashboardTheme, availableThemes } = useDashboardTheme()
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
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  // Use shared text zoom context
  const { textZoom, setTextZoom: setTextZoomContext } = useDashboardSettings()
  const [isExporting, setIsExporting] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')



  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchUserPreferences()
    }
  }, [isAuthenticated, user])

  const fetchUserPreferences = async () => {
    try {
      setLoading(true)

      // Fetch user settings from database
      const userSettings = await userSettingsService.getUserSettings()

      setPreferences(userSettings.notification_settings)
      setQuizSettings(userSettings.quiz_settings)

      // Handle text zoom - migrate from legacy font size if needed
      const config = getTextZoomConfig()
      let zoom = userSettings.ui_settings.text_zoom
      if (!zoom) {
        // Migrate from legacy font size
        zoom = legacyFontSizeToZoom(userSettings.ui_settings.font_size || 'medium')
      }
      zoom = getValidZoomLevel(zoom || config.default)
      // Use context to set text zoom (this will sync with header)
      setTextZoomContext(zoom)
    } catch (error) {
      console.error('Error fetching preferences:', error)
      toast.error('Failed to load preferences')

      // Use defaults if fetch fails
      setPreferences({
        email_notifications: true,
        quiz_reminders: true,
        progress_updates: true
      })

      const config = getTextZoomConfig()
      // Use context to set text zoom (this will sync with header)
      setTextZoomContext(config.default)
      setQuizSettings({
        default_question_count: 10,
        default_mode: 'tutor',
        default_timing: 'untimed',
        default_question_type: 'unused',
        default_category_selection: 'all'
      })
    } finally {
      setLoading(false)
    }
  }

  const handlePreferenceChange = async (key: keyof NotificationSettings, value: boolean) => {
    try {
      setSaving(true)
      const newPreferences = { ...preferences, [key]: value }
      setPreferences(newPreferences)

      // Save to database
      await userSettingsService.updateNotificationSettings(newPreferences)
      // Removed toast notification for preference changes - UI feedback is immediate
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
      // Removed toast notification for quiz setting changes - UI feedback is immediate
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
      setDashboardTheme(newTheme)

      // Save to database
      await userSettingsService.updateUISettings({ dashboard_theme: newTheme })
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
        theme: 'system' as const,
        font_size: 'medium' as const,
        text_zoom: config.default,
        dashboard_theme: 'default',
        sidebar_collapsed: false,
        welcome_message_seen: false
      }

      // Update local state
      setPreferences(defaultPreferences)
      setQuizSettings(defaultQuizSettings)
      setTextZoomContext(config.default)
      setTheme('system')
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

      const response = await fetch('/api/user/data-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
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

  if (isLoading || loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground mt-2">
              Manage your account preferences and quiz settings.
            </p>
          </div>
          <div className="space-y-6">
            {/* Theme Settings Skeleton */}
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-64" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-32" />
                </div>
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-10 w-40" />
                </div>
              </CardContent>
            </Card>

            {/* Text Size Skeleton */}
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-20" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notifications Skeleton */}
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-56" />
              </CardHeader>
              <CardContent className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                    <Skeleton className="h-6 w-11" />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Quiz Settings Skeleton */}
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-28" />
                <Skeleton className="h-4 w-52" />
              </CardHeader>
              <CardContent className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-10 w-32" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account preferences and settings.
        </p>
      </div>

      <div className="space-y-6">
        {/* Appearance Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {mounted && theme === 'dark' ? (
                <Moon className="h-5 w-5" />
              ) : (
                <Sun className="h-5 w-5" />
              )}
              Appearance
            </CardTitle>
            <CardDescription>
              Customize how the application looks and feels.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Light/Dark Mode</Label>
              <p className="text-sm text-muted-foreground">
                Choose your preferred color scheme
              </p>
              <Select
                value={mounted ? theme : 'system'}
                onValueChange={(value) => setTheme(value)}
                disabled={!mounted || saving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">
                    <div className="flex items-center gap-2">
                      <Sun className="h-4 w-4" />
                      Light
                    </div>
                  </SelectItem>
                  <SelectItem value="dark">
                    <div className="flex items-center gap-2">
                      <Moon className="h-4 w-4" />
                      Dark
                    </div>
                  </SelectItem>
                  <SelectItem value="system">
                    <div className="flex items-center gap-2">
                      <Sun className="h-4 w-4" />
                      System
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Dashboard Theme</Label>
              <p className="text-sm text-muted-foreground">
                Choose your preferred dashboard color scheme
              </p>
              <Select
                value={dashboardTheme.id}
                onValueChange={handleDashboardThemeChange}
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableThemes.map((theme) => (
                    <SelectItem key={theme.id} value={theme.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full border border-border"
                          style={{ background: theme.preview }}
                        />
                        {theme.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Text Size</Label>
              <p className="text-sm text-muted-foreground">
                Adjust the size of text throughout the application
              </p>
              <div className="flex items-center justify-between p-3 border rounded-md">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    const config = getTextZoomConfig()
                    const newZoom = Math.max(config.min, textZoom - config.step)
                    const validZoom = getValidZoomLevel(newZoom)
                    handleTextZoomChange(validZoom)
                  }}
                  disabled={saving || textZoom <= getTextZoomConfig().min}
                  className="h-8 w-8"
                  title="Decrease text size"
                >
                  <Minus size={14} />
                </Button>

                <div className="text-sm text-muted-foreground min-w-[4rem] text-center">
                  {Math.round(textZoom * 100)}%
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    const config = getTextZoomConfig()
                    const newZoom = Math.min(config.max, textZoom + config.step)
                    const validZoom = getValidZoomLevel(newZoom)
                    handleTextZoomChange(validZoom)
                  }}
                  disabled={saving || textZoom >= getTextZoomConfig().max}
                  className="h-8 w-8"
                  title="Increase text size"
                >
                  <Plus size={14} />
                </Button>
              </div>
              <div className="text-xs text-muted-foreground text-center">
                Range: {Math.round(getTextZoomConfig().min * 100)}% - {Math.round(getTextZoomConfig().max * 100)}%
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>
              Control what notifications you receive.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive important updates via email
                </p>
              </div>
              <Switch
                checked={preferences.email_notifications}
                onCheckedChange={(checked) => handlePreferenceChange('email_notifications', checked)}
                disabled={saving}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Quiz Reminders</Label>
                <p className="text-sm text-muted-foreground">
                  Get reminded to take your daily quizzes
                </p>
              </div>
              <Switch
                checked={preferences.quiz_reminders}
                onCheckedChange={(checked) => handlePreferenceChange('quiz_reminders', checked)}
                disabled={saving}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Progress Updates</Label>
                <p className="text-sm text-muted-foreground">
                  Receive updates about your learning progress
                </p>
              </div>
              <Switch
                checked={preferences.progress_updates}
                onCheckedChange={(checked) => handlePreferenceChange('progress_updates', checked)}
                disabled={saving}
              />
            </div>

          </CardContent>
        </Card>

        {/* Quiz Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Quiz Settings
            </CardTitle>
            <CardDescription>
              Set your default quiz preferences.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Default Questions per Quiz</Label>
              <Select
                value={quizSettings.default_question_count.toString()}
                onValueChange={(value) => handleQuizSettingChange('default_question_count', parseInt(value))}
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 questions</SelectItem>
                  <SelectItem value="10">10 questions</SelectItem>
                  <SelectItem value="25">25 questions</SelectItem>
                  <SelectItem value="50">50 questions</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Default Mode</Label>
              <Select
                value={quizSettings.default_mode}
                onValueChange={(value) => handleQuizSettingChange('default_mode', value as QuizMode)}
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(QUIZ_MODE_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Default Timing</Label>
              <Select
                value={quizSettings.default_timing}
                onValueChange={(value) => handleQuizSettingChange('default_timing', value as QuizTiming)}
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(QUIZ_TIMING_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Default Question Type</Label>
              <Select
                value={quizSettings.default_question_type}
                onValueChange={(value) => handleQuizSettingChange('default_question_type', value as QuestionType)}
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(QUESTION_TYPE_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Default Categories</Label>
              <Select
                value={quizSettings.default_category_selection}
                onValueChange={(value) => handleQuizSettingChange('default_category_selection', value as CategorySelection)}
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_SELECTION_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Privacy & Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Privacy & Security
            </CardTitle>
            <CardDescription>
              Manage your privacy and security settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Data Export</Label>
              <p className="text-sm text-muted-foreground">
                Download a complete copy of your account data
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDataExport}
                disabled={isExporting}
              >
                {isExporting ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  'Request Data Export'
                )}
              </Button>
            </div>

          </CardContent>
        </Card>

        {/* Reset Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Reset Settings
            </CardTitle>
            <CardDescription>
              Reset all your settings to their default values.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Reset All Settings</Label>
              <p className="text-sm text-muted-foreground">
                This will reset all your preferences, quiz settings, and appearance settings to their default values
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowResetDialog(true)}
                disabled={saving}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset All Settings
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Danger Zone
            </CardTitle>
            <CardDescription>
              Irreversible and destructive actions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Delete Account</Label>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and all associated data
              </p>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Account Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={(open) => {
        setShowDeleteDialog(open)
        if (!open) setDeletePassword('')
      }}>
        <DialogPortal>
          <DialogOverlay className="backdrop-blur-md bg-black/20" />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Account</DialogTitle>
              <DialogDescription>
                Are you absolutely sure you want to delete your account?
                <br />
                <br />
                This action cannot be undone. This will permanently delete your
                account and remove all your data from our servers.
                <br />
                <br />
                Please enter your password to confirm:
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="delete-password">Password</Label>
                <input
                  id="delete-password"
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Enter your password"
                  disabled={isDeleting}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDeleteAccount(deletePassword)}
                disabled={isDeleting || !deletePassword.trim()}
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Account
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </DialogPortal>
      </Dialog>

      {/* Reset All Settings Dialog */}
      <Dialog open={showResetDialog} onOpenChange={(open) => {
        setShowResetDialog(open)
      }}>
        <DialogPortal>
          <DialogOverlay className="backdrop-blur-md bg-black/20" />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Reset All Settings</DialogTitle>
              <DialogDescription>
                Are you sure you want to reset all your settings to their default values?
                <br />
                <br />
                This will reset:
                <br />
                • All appearance preferences (theme, text size, dashboard theme)
                <br />
                • All notification settings
                <br />
                • All quiz preferences
                <br />
                <br />
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowResetDialog(false)}
                disabled={isResetting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleResetAllSettings}
                disabled={isResetting}
              >
                {isResetting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset All Settings
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </div>
  )
}
