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
import { Badge } from '@/shared/components/ui/badge'
import { toast } from 'sonner'
import { 
  QuestionFlagData,
  FlagResolutionType,
  FLAG_TYPE_CONFIG,
  FLAG_RESOLUTION_CONFIG
} from '@/features/questions/types/questions'
import { createClient } from '@/shared/services/client'
import { CheckCircle, X, Flag, User, Calendar } from 'lucide-react'

interface FlagResolutionDialogProps {
  flags: QuestionFlagData[]
  questionTitle: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onResolutionComplete: () => void
}

export function FlagResolutionDialog({
  flags,
  questionTitle,
  open,
  onOpenChange,
  onResolutionComplete
}: FlagResolutionDialogProps) {
  const [selectedResolution, setSelectedResolution] = useState<FlagResolutionType | ''>('')
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createClient()

  const handleSubmit = async () => {
    if (!selectedResolution) {
      toast.error('Please select a resolution type')
      return
    }

    if (selectedResolution === 'fixed' && !resolutionNotes.trim()) {
      toast.error('Please provide resolution notes when marking as fixed')
      return
    }

    setIsSubmitting(true)

    try {
      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        console.error('Authentication error:', authError)
        toast.error('Authentication error')
        return
      }

      // Check user permissions
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      if (userError || !userData) {
        console.error('Error fetching user data:', userError)
        toast.error('Failed to verify user permissions')
        return
      }

      if (!['admin', 'reviewer'].includes(userData.role)) {
        toast.error('You do not have permission to resolve flags')
        return
      }

      // Update all flags for this question
      const flagIds = flags.map(flag => flag.id).filter(id => id) // Filter out any undefined IDs

      if (flagIds.length === 0) {
        toast.error('No valid flags to resolve')
        return
      }

      const updateData = {
        status: 'closed',
        resolution_type: selectedResolution,
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
        resolution_notes: resolutionNotes.trim() || null,
        updated_at: new Date().toISOString()
      }

      const { error: updateError } = await supabase
        .from('question_flags')
        .update(updateData)
        .in('id', flagIds)

      if (updateError) {
        console.error('Error resolving flags:', updateError)
        console.error('Update data was:', updateData)
        console.error('Flag IDs were:', flagIds)

        let errorMessage = 'Failed to resolve flags'
        if (updateError.message) {
          errorMessage += `: ${updateError.message}`
        }
        if (updateError.code) {
          errorMessage += ` (Code: ${updateError.code})`
        }

        toast.error(errorMessage)
        return
      }

      const resolutionLabel = FLAG_RESOLUTION_CONFIG[selectedResolution].label
      toast.success(`${flags.length} flag(s) marked as ${resolutionLabel.toLowerCase()}`)
      onResolutionComplete()
      onOpenChange(false)
      
      // Reset form
      setSelectedResolution('')
      setResolutionNotes('')
    } catch (error) {
      console.error('Error resolving flags:', error)
      toast.error('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!flags || flags.length === 0) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="backdrop-blur-md bg-black/20" />
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Resolve Question Flags
            </DialogTitle>
            <DialogDescription>
              Review and resolve the flags for this question. All flags will be updated with the same resolution.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Question Info */}
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-medium text-sm mb-2">Question</h3>
              <p className="text-sm">{questionTitle}</p>
            </div>

            {/* Flags List */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm">Flags to Resolve ({flags.length})</h3>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {flags.map((flag) => (
                  <div key={flag.id} className="p-3 border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Flag className="h-3 w-3" />
                        {FLAG_TYPE_CONFIG[flag.flag_type as keyof typeof FLAG_TYPE_CONFIG]?.label || flag.flag_type}
                      </Badge>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(flag.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    {flag.description && (
                      <p className="text-sm text-muted-foreground">{flag.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Resolution Type */}
            <div className="space-y-2">
              <Label htmlFor="resolution-type">Resolution Type</Label>
              <Select value={selectedResolution} onValueChange={(value) => setSelectedResolution(value as FlagResolutionType | '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select how to resolve these flags" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <div>
                        <div className="font-medium">Fixed</div>
                        <div className="text-xs text-muted-foreground">
                          Issue was resolved by editing the question
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="dismissed">
                    <div className="flex items-center gap-2">
                      <X className="h-4 w-4 text-gray-600" />
                      <div>
                        <div className="font-medium">Dismissed</div>
                        <div className="text-xs text-muted-foreground">
                          Flag was determined to be invalid
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Resolution Notes */}
            <div className="space-y-2">
              <Label htmlFor="resolution-notes">
                Resolution Notes
                {selectedResolution === 'fixed' && (
                  <span className="text-red-500 ml-1">*</span>
                )}
              </Label>
              <Textarea
                id="resolution-notes"
                placeholder={
                  selectedResolution === 'fixed'
                    ? "Describe what changes were made to fix the issue..."
                    : "Optional: Explain why the flag was dismissed..."
                }
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                rows={4}
              />
              {selectedResolution === 'fixed' && (
                <p className="text-xs text-muted-foreground">
                  Required when marking as fixed. Describe the changes made to resolve the issue.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedResolution}
            >
              {isSubmitting ? 'Resolving...' : `Resolve ${flags.length} Flag(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}
