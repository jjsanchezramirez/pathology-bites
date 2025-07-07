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
  Settings as SettingsIcon, 
  Moon, 
  Sun, 
  Bell, 
  Shield, 
  Trash2, 
  RefreshCw,
  AlertTriangle
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
  DialogTrigger,
} from '@/shared/components/ui/dialog'

interface UserPreferences {
  email_notifications: boolean
  quiz_reminders: boolean
  progress_updates: boolean
  marketing_emails: boolean
}

export default function SettingsPage() {
  const { user, isAuthenticated, isLoading } = useAuthStatus()
  const { theme, setTheme } = useTheme()
  const [preferences, setPreferences] = useState<UserPreferences>({
    email_notifications: true,
    quiz_reminders: true,
    progress_updates: true,
    marketing_emails: false
  })
  const [saving, setSaving] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const supabase = createClient()

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
      // For now, we'll use default preferences
      // In a real app, you'd fetch from a user_preferences table
      setPreferences({
        email_notifications: true,
        quiz_reminders: true,
        progress_updates: true,
        marketing_emails: false
      })
    } catch (error) {
      console.error('Error fetching preferences:', error)
      toast.error('Failed to load preferences')
    }
  }

  const handlePreferenceChange = async (key: keyof UserPreferences, value: boolean) => {
    try {
      setSaving(true)
      setPreferences(prev => ({ ...prev, [key]: value }))
      
      // In a real app, you'd save to a user_preferences table
      // For now, we'll just show a success message
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

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin" />
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
