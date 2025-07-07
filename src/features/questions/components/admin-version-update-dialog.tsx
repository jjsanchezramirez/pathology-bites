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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select"
import { Button } from "@/shared/components/ui/button"
import { Label } from "@/shared/components/ui/label"
import { Textarea } from "@/shared/components/ui/textarea"
import { Badge } from "@/shared/components/ui/badge"
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

type UpdateType = 'patch' | 'minor' | 'major'

const UPDATE_TYPE_CONFIG = {
  patch: {
    label: 'Patch Update',
    description: 'Bug fixes, typos, formatting, references, minor wording changes',
    color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
    examples: ['Fix typos', 'Update references', 'Correct formatting', 'Minor wording adjustments']
  },
  minor: {
    label: 'Minor Update', 
    description: 'Content changes, new explanations, option modifications (non-breaking)',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    examples: ['Add explanations', 'Modify answer options', 'Update teaching points', 'Content improvements']
  },
  major: {
    label: 'Major Update',
    description: 'Complete rewrites, fundamental changes, breaking modifications',
    color: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
    examples: ['Complete rewrite', 'Change question type', 'Major content overhaul', 'Structural changes']
  }
} as const

export function AdminVersionUpdateDialog({
  questionId,
  questionTitle,
  currentVersion,
  open,
  onOpenChange,
  onVersionCreated
}: AdminVersionUpdateDialogProps) {
  const [updateType, setUpdateType] = useState<UpdateType>('patch')
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
          updateType,
          changeSummary: changeSummary.trim()
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || 'Failed to create version')
        return
      }

      toast.success('Version created successfully', {
        description: `Created ${updateType} version ${data.newVersion}`
      })

      // Reset form
      setUpdateType('patch')
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
    setUpdateType('patch')
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

            {/* Update Type Selection */}
            <div className="space-y-3">
              <Label htmlFor="updateType">Update Type *</Label>
              <Select value={updateType} onValueChange={(value: UpdateType) => setUpdateType(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select update type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(UPDATE_TYPE_CONFIG).map(([type, config]) => (
                    <SelectItem key={type} value={type}>
                      <div className="flex items-center gap-2">
                        <Badge className={config.color}>
                          {config.label}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Update Type Description */}
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-start gap-2">
                  <Badge className={UPDATE_TYPE_CONFIG[updateType].color}>
                    {UPDATE_TYPE_CONFIG[updateType].label}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {UPDATE_TYPE_CONFIG[updateType].description}
                </p>
                <div className="mt-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Examples:</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {UPDATE_TYPE_CONFIG[updateType].examples.map((example, index) => (
                      <li key={index} className="flex items-center gap-1">
                        <span className="w-1 h-1 bg-muted-foreground rounded-full" />
                        {example}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <Separator />

            {/* Change Summary */}
            <div className="space-y-3">
              <Label htmlFor="changeSummary">Change Summary *</Label>
              <Textarea
                id="changeSummary"
                value={changeSummary}
                onChange={(e) => setChangeSummary(e.target.value)}
                placeholder={`Describe the ${updateType} changes made to this question...`}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Provide a clear description of what changes were made and why.
              </p>
            </div>

            {/* Warning for Major Updates */}
            {updateType === 'major' && (
              <div className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-orange-900 dark:text-orange-100">
                    Major Version Warning
                  </p>
                  <p className="text-orange-800 dark:text-orange-200 mt-1">
                    Major versions indicate significant changes that may affect question analytics and user performance tracking. 
                    Use sparingly and only for substantial content overhauls.
                  </p>
                </div>
              </div>
            )}
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
              {isSubmitting ? 'Creating...' : `Create ${UPDATE_TYPE_CONFIG[updateType].label}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}
