// src/components/question-management/create-set-dialog.tsx
'use client'

import { useState } from 'react'

import { toast } from 'sonner'
import { useAuth } from '@/features/auth/hooks/use-auth-status'
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


interface CreateSetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

const sourceTypes = [
  { value: 'AI-Generated', label: 'AI-Generated' },
  { value: 'Web Resource', label: 'Web Resource' },
  { value: 'Textbook', label: 'Textbook' },
  { value: 'Expert-Authored', label: 'Expert-Authored' },
  { value: 'User-Generated', label: 'User-Generated' },
  { value: 'Other', label: 'Other' }
]



export function CreateSetDialog({ open, onOpenChange, onSuccess }: CreateSetDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [sourceType, setSourceType] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [isCreating, setIsCreating] = useState(false)

  const { user } = useAuth()

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

    if (!user) {
      toast.error('You must be logged in to create a question set')
      return
    }

    setIsCreating(true)
    try {
      const response = await fetch('/api/admin/question-sets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          sourceType: sourceType,
          isActive: isActive
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create question set')
      }

      toast.success('Question set created successfully')

      setName('')
      setDescription('')
      setSourceType('')
      setIsActive(true)
      onSuccess()
    } catch (error) {
      console.error('Error creating question set:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create question set')
    } finally {
      setIsCreating(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!isCreating) {
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
    <BlurredDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Create New Question Set"
      description="Add a new question set to organize your questions by source or topic. Question sets help track where questions come from."
      maxWidth="lg"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isCreating || !name.trim() || !sourceType}
            onClick={handleSubmit}
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Question Set'
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
              disabled={isCreating}
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
              disabled={isCreating}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sourceType">Source Type</Label>
            <Select value={sourceType} onValueChange={setSourceType} disabled={isCreating}>
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
              disabled={isCreating}
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
