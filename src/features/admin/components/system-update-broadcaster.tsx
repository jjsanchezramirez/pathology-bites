// src/features/admin/components/system-update-broadcaster.tsx
// Admin component for broadcasting system update notifications

'use client'

import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { toast } from 'sonner'
import { Megaphone, Send, Loader2 } from 'lucide-react'

interface SystemUpdateForm {
  title: string
  message: string
  updateType: 'maintenance' | 'feature' | 'announcement' | 'security'
  severity: 'info' | 'warning' | 'critical'
  targetAudience: 'all' | 'admin' | 'user' | 'creator' | 'reviewer'
}

export function SystemUpdateBroadcaster() {
  const [form, setForm] = useState<SystemUpdateForm>({
    title: '',
    message: '',
    updateType: 'announcement',
    severity: 'info',
    targetAudience: 'all'
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!form.title.trim() || !form.message.trim()) {
      toast.error('Please fill in all required fields')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/admin/notifications/system-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to broadcast system update')
      }

      const result = await response.json()
      toast.success('System update broadcasted successfully!')
      
      // Reset form
      setForm({
        title: '',
        message: '',
        updateType: 'announcement',
        severity: 'info',
        targetAudience: 'all'
      })

      console.log('System update broadcasted:', result)
    } catch (error) {
      console.error('Error broadcasting system update:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to broadcast system update')
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateTypeOptions = [
    { value: 'announcement', label: 'Announcement', description: 'General announcements and news' },
    { value: 'feature', label: 'New Feature', description: 'New features and improvements' },
    { value: 'maintenance', label: 'Maintenance', description: 'Scheduled maintenance and downtime' },
    { value: 'security', label: 'Security Update', description: 'Security-related updates' }
  ]

  const severityOptions = [
    { value: 'info', label: 'Info', description: 'General information', color: 'text-blue-600' },
    { value: 'warning', label: 'Warning', description: 'Important notices', color: 'text-yellow-600' },
    { value: 'critical', label: 'Critical', description: 'Urgent updates', color: 'text-red-600' }
  ]

  const audienceOptions = [
    { value: 'all', label: 'All Users', description: 'Everyone on the platform' },
    { value: 'user', label: 'Users Only', description: 'Regular users only' },
    { value: 'admin', label: 'Admins Only', description: 'Administrators only' },
    { value: 'creator', label: 'Creators Only', description: 'Content creators only' },
    { value: 'reviewer', label: 'Reviewers Only', description: 'Content reviewers only' }
  ]

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-5 w-5" />
          Broadcast System Update
        </CardTitle>
        <CardDescription>
          Send notifications to users about system updates, new features, or important announcements.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter notification title..."
              required
            />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Message *</Label>
            <Textarea
              id="message"
              value={form.message}
              onChange={(e) => setForm(prev => ({ ...prev, message: e.target.value }))}
              placeholder="Enter notification message..."
              rows={4}
              required
            />
          </div>

          {/* Update Type */}
          <div className="space-y-2">
            <Label htmlFor="updateType">Update Type</Label>
            <Select
              value={form.updateType}
              onValueChange={(value: SystemUpdateForm['updateType']) => 
                setForm(prev => ({ ...prev, updateType: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select update type" />
              </SelectTrigger>
              <SelectContent>
                {updateTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div>
                      <div className="font-medium">{option.label}</div>
                      <div className="text-sm text-muted-foreground">{option.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Severity */}
          <div className="space-y-2">
            <Label htmlFor="severity">Severity</Label>
            <Select
              value={form.severity}
              onValueChange={(value: SystemUpdateForm['severity']) => 
                setForm(prev => ({ ...prev, severity: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select severity" />
              </SelectTrigger>
              <SelectContent>
                {severityOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div>
                      <div className={`font-medium ${option.color}`}>{option.label}</div>
                      <div className="text-sm text-muted-foreground">{option.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Target Audience */}
          <div className="space-y-2">
            <Label htmlFor="targetAudience">Target Audience</Label>
            <Select
              value={form.targetAudience}
              onValueChange={(value: SystemUpdateForm['targetAudience']) => 
                setForm(prev => ({ ...prev, targetAudience: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select target audience" />
              </SelectTrigger>
              <SelectContent>
                {audienceOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div>
                      <div className="font-medium">{option.label}</div>
                      <div className="text-sm text-muted-foreground">{option.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Preview */}
          {(form.title || form.message) && (
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="border rounded-lg p-4 bg-muted/50">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <Megaphone className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">
                      {form.title || 'Notification Title'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {form.message || 'Notification message will appear here...'}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        form.severity === 'critical' ? 'bg-red-100 text-red-800' :
                        form.severity === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {form.updateType.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date().toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isSubmitting || !form.title.trim() || !form.message.trim()}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Broadcasting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Broadcast System Update
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
