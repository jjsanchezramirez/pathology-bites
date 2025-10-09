'use client'

import { useState } from 'react'
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
import { Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface ReviewActionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  question: {
    id: string
    title: string
  }
  action: 'approve' | 'reject'
  onSuccess: () => void
}

export function ReviewActionDialog({
  open,
  onOpenChange,
  question,
  action,
  onSuccess,
}: ReviewActionDialogProps) {
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    // Validate feedback for rejection
    if (action === 'reject' && !feedback.trim()) {
      toast.error('Please provide feedback when rejecting a question')
      return
    }

    setSubmitting(true)
    try {
      const endpoint = action === 'approve'
        ? `/api/questions/${question.id}/approve`
        : `/api/questions/${question.id}/reject`

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: action === 'reject' ? JSON.stringify({ feedback: feedback.trim() }) : undefined,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `Failed to ${action} question`)
      }

      toast.success(
        action === 'approve'
          ? 'Question approved and published'
          : 'Question rejected with feedback'
      )
      onSuccess()
      onOpenChange(false)
      setFeedback('')
    } catch (error) {
      console.error(`Error ${action}ing question:`, error)
      toast.error(error instanceof Error ? error.message : `Failed to ${action} question`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {action === 'approve' ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-600" />
                Approve Question
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-red-600" />
                Reject Question
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {action === 'approve'
              ? 'This question will be published and made available to all users.'
              : 'The question will be returned to the creator with your feedback for revision.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Question Title */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Question</Label>
            <p className="text-sm text-muted-foreground">{question.title}</p>
          </div>

          {/* Feedback (required for rejection) */}
          {action === 'reject' && (
            <div className="space-y-2">
              <Label htmlFor="feedback">
                Feedback <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="feedback"
                placeholder="Explain what needs to be improved or corrected..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={6}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Be specific and constructive. The creator will use this feedback to improve the question.
              </p>
            </div>
          )}

          {/* Confirmation Warning */}
          {action === 'approve' && (
            <div className="rounded-lg bg-green-50 dark:bg-green-950 p-4 border border-green-200 dark:border-green-800">
              <div className="flex gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-green-900 dark:text-green-100">
                    Ready to publish
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    This question will be immediately available in the question bank for all users to practice.
                  </p>
                </div>
              </div>
            </div>
          )}

          {action === 'reject' && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950 p-4 border border-amber-200 dark:border-amber-800">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                    Question will be returned
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    The creator will be notified and can revise the question based on your feedback before resubmitting.
                  </p>
                </div>
              </div>
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
            disabled={submitting || (action === 'reject' && !feedback.trim())}
            variant={action === 'approve' ? 'default' : 'destructive'}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {action === 'approve' ? (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve & Publish
              </>
            ) : (
              <>
                <XCircle className="mr-2 h-4 w-4" />
                Reject with Feedback
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

