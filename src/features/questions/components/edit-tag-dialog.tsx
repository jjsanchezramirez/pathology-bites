// src/components/question-management/edit-tag-dialog.tsx
'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { BlurredDialog } from '@/shared/components/ui/blurred-dialog'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
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



  // Update form when tag changes
  useEffect(() => {
    if (tag && open) {
      setName(tag.name)
    }
  }, [tag, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      toast.error('Tag name is required')
      return
    }

    if (!tag) {
      toast.error('No tag selected for editing')
      return
    }

    setIsUpdating(true)
    try {
      const response = await fetch('/api/admin/tags', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          tagId: tag.id,
          name: name.trim()
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update tag')
      }

      toast.success('Tag updated successfully')

      // Close dialog first, then refresh data
      onOpenChange(false)
      setTimeout(() => {
        onSuccess()
      }, 100)
    } catch (error) {
      console.error('Error updating tag:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update tag')
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
      title="Edit Tag"
      description="Update the tag name. This will affect all questions that use this tag."
      maxWidth="md"
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
            disabled={isUpdating || !name.trim()}
            onClick={handleSubmit}
          >
            {isUpdating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              'Update Tag'
            )}
          </Button>
        </>
      }
    >
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
      </form>
    </BlurredDialog>
  )
}
