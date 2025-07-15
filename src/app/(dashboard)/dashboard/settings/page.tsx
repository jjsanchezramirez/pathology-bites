// src/app/(dashboard)/dashboard/settings/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/shared/services/client'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
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
  BookOpen
} from 'lucide-react'
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
  type NotificationSettings,
  type UserSettings
} from '@/shared/services/user-settings'

// Remove local interfaces since we're using the ones from the service

export default function SettingsPage() {
  const { user, isAuthenticated, isLoading } = useAuthStatus()
  const { theme, setTheme } = useTheme()
  const [preferences, setPreferences] = useState<NotificationSettings>({
    email_notifications: true,
    quiz_reminders: true,
    progress_updates: true,
    marketing_emails: false
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
  const [isDeleting, setIsDeleting] = useState(false)



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
    } catch (error) {
      console.error('Error fetching preferences:', error)
      toast.error('Failed to load preferences')

      // Use defaults if fetch fails
      setPreferences({
        email_notifications: true,
        quiz_reminders: true,
        progress_updates: true,
        marketing_emails: false
      })
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
      toast.success('Preference updated')
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
      toast.success('Quiz setting updated')
    } catch (error) {
      console.error('Error updating quiz setting:', error)
      toast.error('Failed to update quiz setting')
      // Revert the change
      setQuizSettings(prev => ({ ...prev, [key]: quizSettings[key] }))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    try {
      setIsDeleting(true)
      // In a real app, you'd implement account deletion
      toast.error('Account deletion is not implemented yet')
      setShowDeleteDialog(false)
    } catch (error) {
      console.error('Error deleting account:', error)
      toast.error('Failed to delete account')
    } finally {
      setIsDeleting(false)
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
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading settings...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="container mx-auto py-8">
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
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account preferences and settings.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
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
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Theme</Label>
                <p className="text-sm text-muted-foreground">
                  Choose between light and dark mode
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Sun className="h-4 w-4" />
                <Switch
                  checked={mounted && theme === 'dark'}
                  onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                  disabled={!mounted}
                />
                <Moon className="h-4 w-4" />
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
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Marketing Emails</Label>
                <p className="text-sm text-muted-foreground">
                  Receive news and promotional content
                </p>
              </div>
              <Switch
                checked={preferences.marketing_emails}
                onCheckedChange={(checked) => handlePreferenceChange('marketing_emails', checked)}
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
                Download a copy of your data
              </p>
              <Button variant="outline" size="sm">
                Request Data Export
              </Button>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Privacy Settings</Label>
              <p className="text-sm text-muted-foreground">
                Control how your data is used
              </p>
              <Button variant="outline" size="sm">
                Manage Privacy
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
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
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
              </DialogDescription>
            </DialogHeader>
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
                onClick={handleDeleteAccount}
                disabled={isDeleting}
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
    </div>
  )
}
