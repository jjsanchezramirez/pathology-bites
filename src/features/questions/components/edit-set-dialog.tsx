// src/components/question-management/edit-set-dialog.tsx
'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { BlurredDialog } from '@/shared/components/ui/blurred-dialog'
import { Button } from '@/shared/components/ui/button'
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
import { Switch } from '@/shared/components/ui/switch'
import { Loader2 } from 'lucide-react'

interface QuestionSet {
  id: string
  name: string
  description?: string
  source_type: string
  is_active: boolean
  created_at: string
  question_count?: number
  created_by_name?: string
}

interface EditSetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  questionSet: QuestionSet | null
}

const sourceTypes = [
  { value: 'AI-Generated', label: 'AI-Generated' },
  { value: 'Web Resource', label: 'Web Resource' },
  { value: 'Textbook', label: 'Textbook' },
  { value: 'Expert-Authored', label: 'Expert-Authored' },
  { value: 'User-Generated', label: 'User-Generated' },
  { value: 'Other', label: 'Other' }
]



export function EditSetDialog({ open, onOpenChange, onSuccess, questionSet }: EditSetDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [sourceType, setSourceType] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)

  // Update form when questionSet changes
  useEffect(() => {
    if (questionSet && open) {
      setName(questionSet.name)
      setDescription(questionSet.description || '')
      setSourceType(questionSet.source_type)
      setIsActive(questionSet.is_active)
    }
  }, [questionSet, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      toast.error('Question set name is required')
      return
    }

    if (!sourceType) {
      toast.error('Source type is required')
      return
    }

    if (!questionSet) {
      toast.error('No question set selected for editing')
      return
    }

    setIsUpdating(true)
    try {
      const response = await fetch('/api/admin/question-sets', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          setId: questionSet.id,
          updates: {
            name: name.trim(),
            description: description.trim() || null,
            source_type: sourceType,
            is_active: isActive
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update question set')
      }

      toast.success('Question set updated successfully')

      // Close dialog first, then refresh data
      onOpenChange(false)
      setTimeout(() => {
        onSuccess()
      }, 100)
    } catch (error) {
      console.error('Error updating question set:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update question set')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!isUpdating) {
      onOpenChange(newOpen)
      // Note: State cleanup removed to prevent conflicts with Select dropdown portals
      // State will be reset when dialog opens again via useEffect
    }
  }

  return (
    <BlurredDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Edit Question Set"
      description="Update the question set details. This will affect how questions are organized and categorized."
      maxWidth="lg"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isUpdating}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isUpdating || !name.trim() || !sourceType}
            onClick={handleSubmit}
          >
            {isUpdating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              'Update Question Set'
            )}
          </Button>
        </>
      }
    >
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Question Set Name</Label>
            <Input
              id="name"
              placeholder="Enter question set name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isUpdating}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Enter question set description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isUpdating}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sourceType">Source Type</Label>
            <Select value={sourceType} onValueChange={setSourceType} disabled={isUpdating}>
              <SelectTrigger>
                <SelectValue placeholder="Select source type..." />
              </SelectTrigger>
              <SelectContent>
                {sourceTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>



          <div className="flex items-center space-x-2">
            <Switch
              id="isActive"
              checked={isActive}
              onCheckedChange={setIsActive}
              disabled={isUpdating}
            />
            <Label htmlFor="isActive">Active</Label>
            <span className="text-sm text-muted-foreground">
              (Active question sets can be used for new questions)
            </span>
          </div>

        </form>
    </BlurredDialog>
  )
}
