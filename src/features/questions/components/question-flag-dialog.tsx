'use client'

import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { Textarea } from '@/shared/components/ui/textarea'
import { Label } from '@/shared/components/ui/label'
import { toast } from 'sonner'
import { 
  QuestionWithDetails, 
  FlagType, 
  FlagFormData,
  FLAG_TYPE_CONFIG
} from '@/features/questions/types/questions'
import { createClient } from '@/shared/services/client'
import { Flag } from 'lucide-react'

interface QuestionFlagDialogProps {
  question: QuestionWithDetails | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onFlagComplete: () => void
}

export function QuestionFlagDialog({
  question,
  open,
  onOpenChange,
  onFlagComplete
}: QuestionFlagDialogProps) {
  const [selectedFlagType, setSelectedFlagType] = useState<FlagType | ''>('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createClient()

  const handleSubmit = async () => {
    if (!question || !selectedFlagType) {
      toast.error('Please select an issue type')
      return
    }

    setIsSubmitting(true)

    try {
      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        toast.error('Authentication error')
        return
      }

      // Check if user has already flagged this question
      const { data: existingFlag, error: checkError } = await supabase
        .from('question_flags')
        .select('id')
        .eq('question_id', question.id)
        .eq('flagged_by', user.id)
        .eq('status', 'open')
        .single()

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking existing flags:', checkError)
        toast.error('Failed to check existing flags')
        return
      }

      if (existingFlag) {
        toast.error('You have already flagged this question')
        return
      }

      // Create flag record
      const { error: flagError } = await supabase
        .from('question_flags')
        .insert({
          question_id: question.id,
          flagged_by: user.id,
          flag_type: selectedFlagType,
          description: description.trim() || null
        })

      if (flagError) {
        console.error('Error creating flag:', flagError)
        toast.error('Failed to flag question')
        return
      }

      // Flag metadata is automatically updated by database trigger
      // No need to manually update question status

      toast.success('Question flagged successfully')
      onFlagComplete()
      onOpenChange(false)
      
      // Reset form
      setSelectedFlagType('')
      setDescription('')
    } catch (error) {
      console.error('Error flagging question:', error)
      toast.error('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!question) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="backdrop-blur-md bg-black/20" />
        <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5" />
            Flag Question
          </DialogTitle>
          <DialogDescription>
            Report an issue with this question. It will be reviewed by administrators.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Question Info */}
          <div className="p-3 bg-muted rounded-md">
            <p className="font-medium text-sm">{question.title}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {question.stem.substring(0, 100)}...
            </p>
          </div>

          {/* Flag Type Selection */}
          <div>
            <Label htmlFor="flag-type">Issue Type *</Label>
            <Select value={selectedFlagType} onValueChange={(value) => setSelectedFlagType(value as FlagType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select the type of issue" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FLAG_TYPE_CONFIG).map(([flagType, config]) => (
                  <SelectItem key={flagType} value={flagType}>
                    <div>
                      <div className="font-medium">{config.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {config.description}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please provide specific details about the issue..."
              rows={4}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Be specific about what's wrong so reviewers can address the issue effectively.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!selectedFlagType || isSubmitting}
            variant="destructive"
          >
            {isSubmitting ? 'Flagging...' : 'Flag Question'}
          </Button>
        </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}
