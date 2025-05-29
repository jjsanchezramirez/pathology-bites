// src/components/question-management/edit-tag-dialog.tsx
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
import { Loader2 } from 'lucide-react'

interface Tag {
  id: string
  name: string
  created_at: string
  question_count?: number
}

interface EditTagDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  tag: Tag | null
}

export function EditTagDialog({ open, onOpenChange, onSuccess, tag }: EditTagDialogProps) {
  const [name, setName] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)

  const { toast } = useToast()

  // Update form when tag changes
  useEffect(() => {
    if (tag && open) {
      setName(tag.name)
    }
  }, [tag, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Tag name is required'
      })
      return
    }

    if (!tag) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No tag selected for editing'
      })
      return
    }

    setIsUpdating(true)
    try {
      const response = await fetch('/api/admin/tags', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tagId: tag.id,
          name: name.trim()
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update tag')
      }

      toast({
        title: 'Success',
        description: 'Tag updated successfully'
      })

      onSuccess()
    } catch (error) {
      console.error('Error updating tag:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update tag'
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
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Tag</DialogTitle>
          <DialogDescription>
            Update the tag name. This will affect all questions that use this tag.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Tag Name</Label>
            <Input
              id="name"
              placeholder="Enter tag name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isUpdating}
              autoFocus
            />
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
            <Button type="submit" disabled={isUpdating || !name.trim()}>
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Tag'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
