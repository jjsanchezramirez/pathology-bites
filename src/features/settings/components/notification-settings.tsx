'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Label } from '@/shared/components/ui/label'
import { Separator } from '@/shared/components/ui/separator'
import { Switch } from '@/shared/components/ui/switch'
import { Bell } from 'lucide-react'
import { type NotificationSettings } from '@/shared/services/user-settings'

interface NotificationSettingsProps {
  preferences: NotificationSettings
  saving: boolean
  onPreferenceChange: (key: keyof NotificationSettings, value: boolean) => void
}

export function NotificationSettingsCard({
  preferences,
  saving,
  onPreferenceChange
}: NotificationSettingsProps) {
  return (
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
            onCheckedChange={(checked) => onPreferenceChange('email_notifications', checked)}
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
            onCheckedChange={(checked) => onPreferenceChange('quiz_reminders', checked)}
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
            onCheckedChange={(checked) => onPreferenceChange('progress_updates', checked)}
            disabled={saving}
          />
        </div>
      </CardContent>
    </Card>
  )
}

