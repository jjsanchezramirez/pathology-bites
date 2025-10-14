'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog"
import { Button } from "@/shared/components/ui/button"
import { Label } from "@/shared/components/ui/label"
import { Textarea } from "@/shared/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select"
import { Loader2, UserCheck } from 'lucide-react'
import { toast } from 'sonner'

interface Reviewer {
  id: string
  full_name: string
  email: string
  role: string
  pending_count: number
}

interface SubmitForReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  questionId: string
  questionTitle: string
  questionStatus?: string  // To determine if this is a resubmission
  onSuccess: () => void
}

export function SubmitForReviewDialog({
  open,
  onOpenChange,
  questionId,
  questionTitle,
  questionStatus,
  onSuccess,
}: SubmitForReviewDialogProps) {
  const [reviewers, setReviewers] = useState<Reviewer[]>([])
  const [selectedReviewerId, setSelectedReviewerId] = useState<string>('')
  const [resubmissionNotes, setResubmissionNotes] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const isResubmission = questionStatus === 'rejected'

  // Fetch reviewers when dialog opens
  useEffect(() => {
    if (open) {
      fetchReviewers()
    }
  }, [open])

  const fetchReviewers = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/reviewers')
      if (!response.ok) {
        throw new Error('Failed to fetch reviewers')
      }
      const data = await response.json()
      setReviewers(data.reviewers || [])
    } catch (error) {
      console.error('Error fetching reviewers:', error)
      toast.error('Failed to load reviewers')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!selectedReviewerId) {
      toast.error('Please select a reviewer')
      return
    }

    if (isResubmission && !resubmissionNotes.trim()) {
      toast.error('Please describe what changes you made')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(`/api/questions/${questionId}/submit-for-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewer_id: selectedReviewerId,
          resubmission_notes: isResubmission ? resubmissionNotes.trim() : null
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to submit question')
      }

      toast.success(isResubmission ? 'Question resubmitted for review' : 'Question submitted for review')
      onSuccess()
      onOpenChange(false)
      setSelectedReviewerId('')
      setResubmissionNotes('')
    } catch (error) {
      console.error('Error submitting question:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to submit question')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isResubmission ? 'Resubmit Question for Review' : 'Submit Question for Review'}</DialogTitle>
          <DialogDescription>
            {isResubmission
              ? 'Describe the changes you made and select a reviewer to re-evaluate this question.'
              : 'Select a reviewer to evaluate this question. They will be able to approve or reject it with feedback.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Question Title */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Question</Label>
            <p className="text-sm text-muted-foreground line-clamp-2">{questionTitle}</p>
          </div>

          {/* Resubmission Notes - Only for rejected questions */}
          {isResubmission && (
            <div className="space-y-2">
              <Label htmlFor="resubmission-notes">
                What changes did you make? <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="resubmission-notes"
                placeholder="Describe what you changed to address the reviewer's feedback..."
                value={resubmissionNotes}
                onChange={(e) => setResubmissionNotes(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Help the reviewer understand what you changed since their last review.
              </p>
            </div>
          )}

          {/* Reviewer Selection */}
          <div className="space-y-2">
            <Label htmlFor="reviewer">Assign to Reviewer</Label>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Select value={selectedReviewerId} onValueChange={setSelectedReviewerId}>
                <SelectTrigger id="reviewer">
                  <SelectValue placeholder="Select a reviewer..." />
                </SelectTrigger>
                <SelectContent>
                  {reviewers.map((reviewer) => (
                    <SelectItem key={reviewer.id} value={reviewer.id}>
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-4 w-4" />
                          <span>{reviewer.full_name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground ml-4">
                          {reviewer.pending_count} pending
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {reviewers.length === 0 && !loading && (
              <p className="text-sm text-muted-foreground">No reviewers available</p>
            )}
          </div>

          {/* Workload Info */}
          {selectedReviewerId && (
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm text-muted-foreground">
                <strong>Tip:</strong> Consider reviewer workload when assigning. Questions are typically reviewed within 2-3 days.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedReviewerId || submitting}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit for Review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

