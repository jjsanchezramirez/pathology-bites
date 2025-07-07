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
import { toast } from 'sonner'
import { Send, AlertCircle } from 'lucide-react'
import { createClient } from '@/shared/services/client'

interface SubmitForReviewButtonProps {
  questionId: string
  questionTitle?: string
  onSubmitComplete?: () => void
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg'
  className?: string
}

export function SubmitForReviewButton({
  questionId,
  questionTitle,
  onSubmitComplete,
  variant = 'default',
  size = 'default',
  className
}: SubmitForReviewButtonProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const supabase = createClient()

  const handleSubmitForReview = async () => {
    setIsSubmitting(true)
    
    try {
      const response = await fetch(`/api/questions/${questionId}/submit-for-review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.details && Array.isArray(data.details)) {
          // Show validation errors
          toast.error('Question validation failed', {
            description: data.details.join(', ')
          })
        } else {
          toast.error(data.error || 'Failed to submit question for review')
        }
        return
      }

      toast.success('Question submitted for review successfully', {
        description: 'Reviewers will be notified and can now review your question.'
      })
      
      setShowConfirmDialog(false)
      onSubmitComplete?.()
      
    } catch (error) {
      console.error('Error submitting question for review:', error)
      toast.error('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => setShowConfirmDialog(true)}
        disabled={isSubmitting}
      >
        <Send className="h-4 w-4 mr-2" />
        Submit for Review
      </Button>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogPortal>
          <DialogOverlay className="backdrop-blur-md bg-black/20" />
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Submit for Review
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to submit this question for review?
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {questionTitle && (
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm font-medium">Question:</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {questionTitle}
                  </p>
                </div>
              )}

              <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-blue-900 dark:text-blue-100">
                    What happens next:
                  </p>
                  <ul className="mt-1 text-blue-800 dark:text-blue-200 space-y-1">
                    <li>• Question status will change to "Under Review"</li>
                    <li>• Reviewers will be notified</li>
                    <li>• You cannot edit the question while under review</li>
                    <li>• You'll be notified of the review decision</li>
                  </ul>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setShowConfirmDialog(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSubmitForReview}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Submit for Review'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </>
  )
}
