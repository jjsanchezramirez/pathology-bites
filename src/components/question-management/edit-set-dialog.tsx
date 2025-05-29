// src/components/question-management/edit-set-dialog.tsx
'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
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
  { value: 'ai', label: 'AI' },
  { value: 'web', label: 'Web' },
  { value: 'book', label: 'Book' },
  { value: 'handwritten', label: 'Handwritten' },
  { value: 'other', label: 'Other' }
]

export function EditSetDialog({ open, onOpenChange, onSuccess, questionSet }: EditSetDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [sourceType, setSourceType] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)

  const { toast } = useToast()

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
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Question set name is required'
      })
      return
    }

    if (!sourceType) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Source type is required'
      })
      return
    }

    if (!questionSet) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No question set selected for editing'
      })
      return
    }

    setIsUpdating(true)
    try {
      const response = await fetch('/api/admin/question-sets', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
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

      toast({
        title: 'Success',
        description: 'Question set updated successfully'
      })

      onSuccess()
    } catch (error) {
      console.error('Error updating question set:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update question set'
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!isUpdating) {
      onOpenChange(newOpen)
      if (!newOpen) {
        setName('')
        setDescription('')
        setSourceType('')
        setIsActive(true)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Question Set</DialogTitle>
          <DialogDescription>
            Update the question set details. This will affect how questions are organized and categorized.
          </DialogDescription>
        </DialogHeader>
        
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

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isUpdating || !name.trim() || !sourceType}>
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Question Set'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
