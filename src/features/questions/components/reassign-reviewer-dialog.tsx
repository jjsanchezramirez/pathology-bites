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

interface ReassignReviewerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  questionId: string
  questionTitle: string
  currentReviewerId: string
  onSuccess: () => void
}

export function ReassignReviewerDialog({
  open,
  onOpenChange,
  questionId,
  questionTitle,
  currentReviewerId,
  onSuccess,
}: ReassignReviewerDialogProps) {
  const [reviewers, setReviewers] = useState<Reviewer[]>([])
  const [selectedReviewerId, setSelectedReviewerId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Fetch reviewers when dialog opens
  useEffect(() => {
    if (open) {
      fetchReviewers()
      setSelectedReviewerId('') // Reset selection
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
      // Filter out the current reviewer
      const availableReviewers = (data.reviewers || []).filter(
        (r: Reviewer) => r.id !== currentReviewerId
      )
      setReviewers(availableReviewers)
    } catch (error) {
      console.error('Error fetching reviewers:', error)
      toast.error('Failed to load reviewers')
    } finally {
      setLoading(false)
    }
  }

  const handleReassign = async () => {
    if (!selectedReviewerId) {
      toast.error('Please select a new reviewer')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(`/api/questions/${questionId}/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewer_id: selectedReviewerId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to reassign question')
      }

      toast.success('Question reassigned successfully')
      onSuccess()
      onOpenChange(false)
      setSelectedReviewerId('')
    } catch (error) {
      console.error('Error reassigning question:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to reassign question')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Reassign Reviewer</DialogTitle>
          <DialogDescription>
            Select a different reviewer to evaluate this question.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Question Title */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Question</Label>
            <p className="text-sm text-muted-foreground line-clamp-2">{questionTitle}</p>
          </div>

          {/* Reviewer Selection */}
          <div className="space-y-2">
            <Label htmlFor="new-reviewer">Assign to New Reviewer</Label>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Select value={selectedReviewerId} onValueChange={setSelectedReviewerId}>
                <SelectTrigger id="new-reviewer">
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
              <p className="text-sm text-muted-foreground">No other reviewers available</p>
            )}
          </div>

          {/* Info */}
          {selectedReviewerId && (
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm text-muted-foreground">
                The question will be moved to the new reviewer's queue immediately.
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
            onClick={handleReassign}
            disabled={!selectedReviewerId || submitting}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reassign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

