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
import { Loader2, CheckCircle, XCircle, AlertCircle, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { createClient } from '@/shared/services/client'

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
  const [resubmissionNotes, setResubmissionNotes] = useState<string | null>(null)
  const [loadingResubmissionNotes, setLoadingResubmissionNotes] = useState(false)
  const supabase = createClient()

  // Fetch resubmission notes when dialog opens
  useEffect(() => {
    const fetchResubmissionNotes = async () => {
      if (!question || !open) {
        setResubmissionNotes(null)
        return
      }

      setLoadingResubmissionNotes(true)
      try {
        const { data: resubmissionInfo, error } = await supabase
          .from('question_reviews')
          .select('changes_made, created_at')
          .eq('question_id', question.id)
          .eq('action', 'resubmitted')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
          console.error('Error fetching resubmission notes:', error)
        } else if (resubmissionInfo?.changes_made?.resubmission_notes) {
          setResubmissionNotes(resubmissionInfo.changes_made.resubmission_notes)
        } else {
          setResubmissionNotes(null)
        }
      } catch (error) {
        console.error('Unexpected error fetching resubmission notes:', error)
        setResubmissionNotes(null)
      } finally {
        setLoadingResubmissionNotes(false)
      }
    }

    fetchResubmissionNotes()
  }, [question, open, supabase])

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

          {/* Resubmission Notes - Show if creator provided change notes */}
          {resubmissionNotes && (
            <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-blue-900 dark:text-blue-100 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Creator's Changes Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-blue-800 dark:text-blue-300 whitespace-pre-wrap">
                  {resubmissionNotes}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                  The creator provided this summary of changes made since the last review.
                </p>
              </CardContent>
            </Card>
          )}

          {loadingResubmissionNotes && (
            <Card className="border-gray-200 bg-gray-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                  Loading change notes...
                </div>
              </CardContent>
            </Card>
          )}

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

