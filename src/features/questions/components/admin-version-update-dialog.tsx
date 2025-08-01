'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/shared/components/ui/dialog"

import { Button } from "@/shared/components/ui/button"
import { Label } from "@/shared/components/ui/label"
import { Textarea } from "@/shared/components/ui/textarea"

import { Separator } from "@/shared/components/ui/separator"
import { 
  GitBranch, 
  AlertCircle,
  Info
} from 'lucide-react'
import { toast } from 'sonner'

interface AdminVersionUpdateDialogProps {
  questionId: string | null
  questionTitle?: string
  currentVersion?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onVersionCreated?: () => void
}

// Simplified versioning - no complex update type selection needed

export function AdminVersionUpdateDialog({
  questionId,
  questionTitle,
  currentVersion,
  open,
  onOpenChange,
  onVersionCreated
}: AdminVersionUpdateDialogProps) {
  const [changeSummary, setChangeSummary] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!questionId) {
      toast.error('No question selected')
      return
    }

    if (!changeSummary.trim()) {
      toast.error('Change summary is required')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/admin/questions/${questionId}/version`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          changeSummary: changeSummary.trim()
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || 'Failed to create version')
        return
      }

      toast.success('Version created successfully', {
        description: `Created new version ${data.newVersion}`
      })

      // Reset form
      setChangeSummary('')
      onOpenChange(false)
      onVersionCreated?.()

    } catch (error) {
      console.error('Error creating version:', error)
      toast.error('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    setChangeSummary('')
    onOpenChange(false)
  }

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="backdrop-blur-md bg-black/20" />
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Create New Version
            </DialogTitle>
            <DialogDescription>
              {questionTitle ? `Create a new version for "${questionTitle}"` : 'Create a new version for this question'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Current Version Info */}
            {currentVersion && (
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <Info className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  Current version: <span className="font-mono font-medium">{currentVersion}</span>
                </span>
              </div>
            )}

            {/* Simplified Version Creation */}
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Version Update</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Creating a new version will increment the minor version number and save a snapshot of the current question state.
              </p>
            </div>

            <Separator />

            {/* Change Summary */}
            <div className="space-y-3">
              <Label htmlFor="changeSummary">Change Summary *</Label>
              <Textarea
                id="changeSummary"
                value={changeSummary}
                onChange={(e) => setChangeSummary(e.target.value)}
                placeholder="Describe the changes made to this question..."
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Provide a clear description of what changes were made and why.
              </p>
            </div>

            {/* Version Update Info */}
            <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-blue-900 dark:text-blue-100">
                  Version Update
                </p>
                <p className="text-blue-800 dark:text-blue-200 mt-1">
                  This will create a new version snapshot and increment the minor version number automatically.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!changeSummary.trim() || isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Version'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}
