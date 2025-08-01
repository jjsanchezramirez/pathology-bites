// src/features/admin/components/settings-form.tsx
'use client'

import { useState } from 'react'
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Label } from "@/shared/components/ui/label"
import { Switch } from "@/shared/components/ui/switch"

import { Separator } from "@/shared/components/ui/separator"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select"
import { toast } from "sonner"
import { Save, RefreshCw, User, ClipboardList, LayoutDashboard, Bell, RotateCcw } from "lucide-react"

interface SettingsData {
  // Account & Profile
  firstName: string
  lastName: string
  userType: string
  currentPassword: string
  newPassword: string
  confirmPassword: string

  // Review Preferences
  defaultSubjectFilter: string[]
  defaultDifficultyFilter: 'easy' | 'medium' | 'hard' | 'all'
  defaultQuestionTypeFilter: 'multiple_choice' | 'true_false' | 'all'
  autoLoadReviewQueue: boolean
  reviewQueuePageSize: number

  // Dashboard & Interface
  showStatsWidget: boolean
  showRecentActivityWidget: boolean
  showQuickActionsWidget: boolean
  showProgressWidget: boolean
  showUpcomingReviewsWidget: boolean
  dashboardLayout: 'compact' | 'detailed'

  // Notifications
  emailNotifications: boolean
  questionSubmissionNotifications: boolean
  questionReviewNotifications: boolean
  systemUpdateNotifications: boolean
  weeklyProgressReports: boolean
  browserNotifications: boolean
}

const defaultSettings: SettingsData = {
  // Account & Profile
  firstName: "John",
  lastName: "Doe",
  userType: "Admin",
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",

  // Review Preferences
  defaultSubjectFilter: [],
  defaultDifficultyFilter: 'all',
  defaultQuestionTypeFilter: 'all',
  autoLoadReviewQueue: true,
  reviewQueuePageSize: 20,

  // Dashboard & Interface
  showStatsWidget: true,
  showRecentActivityWidget: true,
  showQuickActionsWidget: true,
  showProgressWidget: true,
  showUpcomingReviewsWidget: true,
  dashboardLayout: 'detailed',

  // Notifications
  emailNotifications: true,
  questionSubmissionNotifications: true,
  questionReviewNotifications: true,
  systemUpdateNotifications: false,
  weeklyProgressReports: true,
  browserNotifications: false,
}

export function SettingsForm() {
  const [settings, setSettings] = useState<SettingsData>(defaultSettings)
  const [isLoading, setIsLoading] = useState(false)

  const handleSave = async () => {
    setIsLoading(true)
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast.success("Settings saved successfully")
    } catch (error) {
      toast.error("Failed to save settings")
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setSettings(defaultSettings)
    toast.info("Settings reset to defaults")
  }

  return (
    <div className="space-y-6">
      {/* Account & Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Account & Profile
          </CardTitle>
          <CardDescription>
            Manage your basic profile information and account security.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={settings.firstName}
                onChange={(e) => setSettings(prev => ({ ...prev, firstName: e.target.value }))}
                placeholder="Enter first name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={settings.lastName}
                onChange={(e) => setSettings(prev => ({ ...prev, lastName: e.target.value }))}
                placeholder="Enter last name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="userType">User Type</Label>
            <Input
              id="userType"
              value={settings.userType}
              disabled
              className="bg-muted"
            />
            <p className="text-sm text-muted-foreground">
              Your user type is managed by administrators
            </p>
          </div>

          <Separator />

          <div className="space-y-4">
            <Label className="text-sm font-medium">Change Password</Label>

            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={settings.currentPassword}
                onChange={(e) => setSettings(prev => ({ ...prev, currentPassword: e.target.value }))}
                placeholder="Enter current password"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={settings.newPassword}
                  onChange={(e) => setSettings(prev => ({ ...prev, newPassword: e.target.value }))}
                  placeholder="Enter new password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={settings.confirmPassword}
                  onChange={(e) => setSettings(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Confirm new password"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Review Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Review Preferences
          </CardTitle>
          <CardDescription>
            Configure your default filters and preferences for the review queue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="defaultSubjectFilter">Default Subject Areas</Label>
            <p className="text-sm text-muted-foreground">
              Comma-separated list of subject areas to filter by default
            </p>
            <Input
              id="defaultSubjectFilter"
              value={settings.defaultSubjectFilter.join(', ')}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                defaultSubjectFilter: e.target.value.split(',').map(s => s.trim()).filter(s => s)
              }))}
              placeholder="e.g., Anatomic Pathology, Clinical Pathology, Hematopathology"
            />
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="defaultDifficultyFilter">Default Difficulty Level</Label>
              <Select
                value={settings.defaultDifficultyFilter}
                onValueChange={(value) => setSettings(prev => ({ ...prev, defaultDifficultyFilter: value as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Difficulties</SelectItem>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultQuestionTypeFilter">Default Question Type</Label>
              <Select
                value={settings.defaultQuestionTypeFilter}
                onValueChange={(value) => setSettings(prev => ({ ...prev, defaultQuestionTypeFilter: value as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                  <SelectItem value="true_false">True/False</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-load Review Queue</Label>
              <p className="text-sm text-muted-foreground">
                Automatically load the review queue when visiting the page
              </p>
            </div>
            <Switch
              checked={settings.autoLoadReviewQueue}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, autoLoadReviewQueue: checked }))}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="reviewQueuePageSize">Review Queue Page Size</Label>
            <p className="text-sm text-muted-foreground">
              Number of questions to display per page in the review queue
            </p>
            <Input
              id="reviewQueuePageSize"
              type="number"
              min="10"
              max="100"
              value={settings.reviewQueuePageSize}
              onChange={(e) => setSettings(prev => ({ ...prev, reviewQueuePageSize: parseInt(e.target.value) || 20 }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Dashboard & Interface */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5" />
            Dashboard & Interface
          </CardTitle>
          <CardDescription>
            Customize which widgets and information to display on your dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <Label className="text-sm font-medium">Dashboard Widgets</Label>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Statistics Widget</Label>
                  <p className="text-sm text-muted-foreground">
                    Show overview statistics
                  </p>
                </div>
                <Switch
                  checked={settings.showStatsWidget}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, showStatsWidget: checked }))}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Recent Activity</Label>
                  <p className="text-sm text-muted-foreground">
                    Show recent platform activity
                  </p>
                </div>
                <Switch
                  checked={settings.showRecentActivityWidget}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, showRecentActivityWidget: checked }))}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Quick Actions</Label>
                  <p className="text-sm text-muted-foreground">
                    Show quick action buttons
                  </p>
                </div>
                <Switch
                  checked={settings.showQuickActionsWidget}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, showQuickActionsWidget: checked }))}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Progress Widget</Label>
                  <p className="text-sm text-muted-foreground">
                    Show progress tracking
                  </p>
                </div>
                <Switch
                  checked={settings.showProgressWidget}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, showProgressWidget: checked }))}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Upcoming Reviews</Label>
                  <p className="text-sm text-muted-foreground">
                    Show questions pending review
                  </p>
                </div>
                <Switch
                  checked={settings.showUpcomingReviewsWidget}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, showUpcomingReviewsWidget: checked }))}
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="dashboardLayout">Dashboard Layout</Label>
            <Select
              value={settings.dashboardLayout}
              onValueChange={(value) => setSettings(prev => ({ ...prev, dashboardLayout: value as any }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact">Compact (more widgets per row)</SelectItem>
                <SelectItem value="detailed">Detailed (larger widgets with more info)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
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
              checked={settings.emailNotifications}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, emailNotifications: checked }))}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Question Submission Notifications</Label>
              <p className="text-sm text-muted-foreground">
                When new questions are submitted for review
              </p>
            </div>
            <Switch
              checked={settings.questionSubmissionNotifications}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, questionSubmissionNotifications: checked }))}
              disabled={!settings.emailNotifications}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Question Review Notifications</Label>
              <p className="text-sm text-muted-foreground">
                When your questions are reviewed or need attention
              </p>
            </div>
            <Switch
              checked={settings.questionReviewNotifications}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, questionReviewNotifications: checked }))}
              disabled={!settings.emailNotifications}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>System Update Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Platform updates and maintenance notices
              </p>
            </div>
            <Switch
              checked={settings.systemUpdateNotifications}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, systemUpdateNotifications: checked }))}
              disabled={!settings.emailNotifications}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Weekly Progress Reports</Label>
              <p className="text-sm text-muted-foreground">
                Weekly summary of your activity and progress
              </p>
            </div>
            <Switch
              checked={settings.weeklyProgressReports}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, weeklyProgressReports: checked }))}
              disabled={!settings.emailNotifications}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Browser Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Show browser notifications for real-time updates
              </p>
            </div>
            <Switch
              checked={settings.browserNotifications}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, browserNotifications: checked }))}
            />
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
              This will reset all your preferences to their default values
            </p>
            <div className="flex gap-4">
              <Button onClick={handleSave} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Settings
                  </>
                )}
              </Button>

              <Button variant="outline" onClick={handleReset} disabled={isLoading}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset to Defaults
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
