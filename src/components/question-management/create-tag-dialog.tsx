// src/components/question-management/create-tag-dialog.tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
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

interface CreateTagDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function CreateTagDialog({ open, onOpenChange, onSuccess }: CreateTagDialogProps) {
  const [name, setName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const supabase = createClient()
  const { toast } = useToast()

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

    setIsCreating(true)
    try {
      const response = await fetch('/api/admin/tags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim()
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create tag')
      }

      toast({
        title: 'Success',
        description: 'Tag created successfully'
      })

      setName('')
      onSuccess()
    } catch (error) {
      console.error('Error creating tag:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create tag'
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!isCreating) {
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
          <DialogTitle>Create New Tag</DialogTitle>
          <DialogDescription>
            Add a new tag to organize your questions. Tags help categorize questions by topic or theme.
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
              disabled={isCreating}
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating || !name.trim()}>
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Tag'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
