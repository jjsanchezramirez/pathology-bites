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
import { Separator } from '@/shared/components/ui/separator'
import { toast } from 'sonner'
import { 
  QuestionWithReviewDetails, 
  ReviewAction, 
  ReviewFormData,
  REVIEW_ACTION_CONFIG,
  STATUS_CONFIG
} from '@/features/questions/types/questions'
import { createClient } from '@/shared/services/client'
import { Eye, Clock, User, FileText } from 'lucide-react'

interface QuestionReviewDialogProps {
  question: QuestionWithReviewDetails | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onReviewComplete: () => void
}

export function QuestionReviewDialog({
  question,
  open,
  onOpenChange,
  onReviewComplete
}: QuestionReviewDialogProps) {
  const [selectedAction, setSelectedAction] = useState<ReviewAction | ''>('')
  const [feedback, setFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createClient()

  const handleSubmit = async () => {
    // CACHE BUSTER: Force browser to reload this code - v2.0
    console.log('🔄 Question Review Handler v2.0 - Cache Cleared')

    if (!question || !selectedAction) {
      toast.error('Please select a review action')
      return
    }



    // Validate required feedback for certain actions
    if ((selectedAction === 'reject' || selectedAction === 'request_changes') && !feedback.trim()) {
      toast.error(`Feedback is required for ${selectedAction.replace('_', ' ')}`)
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

      // Get user role from database
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      if (userError || !userData) {
        console.error('Error fetching user role:', userError)
        toast.error('Unable to verify user permissions')
        return
      }

      const userRole = userData.role
      if (!['admin', 'reviewer'].includes(userRole)) {
        toast.error('You do not have permission to review questions')
        return
      }

      // Determine new question status based on action - SIMPLIFIED TO 4 STATUSES
      let newStatus = question.status
      switch (selectedAction) {
        case 'approve':
          newStatus = 'approved'
          break
        case 'request_changes':
          newStatus = 'draft'
          break
        case 'reject':
          newStatus = 'draft'
          break
      }

      // Create review record (RLS policies now allow this)
      const reviewData = {
        question_id: question.id,
        reviewer_id: user.id,
        action: selectedAction,
        feedback: feedback || null,
        changes_made: null // No changes made in this dialog
      }

      const { error: reviewError } = await supabase
        .from('question_reviews')
        .insert(reviewData)

      if (reviewError) {
        console.error('🚨 NEW ERROR HANDLER v2.0 - Error creating review:', reviewError)
        console.error('📊 DETAILED Review data v2.0:', {
          question_id: question.id,
          reviewer_id: user.id,
          action: selectedAction,
          feedback: feedback || null,
          changes_made: null,
          question_status: question.status,
          user_role: userRole,
          timestamp: new Date().toISOString(),
          cache_version: '2.0'
        })

        // Handle different types of errors
        let errorMessage = 'Unknown error'
        if (reviewError.message) {
          errorMessage = reviewError.message
        } else if (reviewError.code) {
          errorMessage = `Database error (${reviewError.code})`
        } else if (typeof reviewError === 'string') {
          errorMessage = reviewError
        } else if (Object.keys(reviewError).length === 0) {
          errorMessage = 'Permission denied - check if question status allows reviews'
        }

        toast.error(`Failed to create review record: ${errorMessage}`)
        return
      }

      // Update question status based on review action
      const { error: updateError } = await supabase
        .from('questions')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', question.id)

      if (updateError) {
        console.error('Error updating question:', updateError)
        toast.error('Failed to update question status')
        return
      }

      toast.success(`Question ${selectedAction.replace(/_/g, ' ')} successfully`)
      onReviewComplete()
      onOpenChange(false)

      // Reset form
      setSelectedAction('')
      setFeedback('')
    } catch (error) {
      console.error('Error submitting review:', error)
      toast.error('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!question) return null

  const statusConfig = STATUS_CONFIG[question.status as keyof typeof STATUS_CONFIG]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="backdrop-blur-md bg-black/20" />
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Review Question: {question.title}
            </DialogTitle>
            <DialogDescription>
              Choose one of three actions: Approve (goes live immediately), Request Changes (returns to creator), or Reject (returns to creator with feedback).
            </DialogDescription>
          </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto">
          <div className="space-y-6">
            {/* Question Status and Metadata */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className={statusConfig?.color}>
                  {statusConfig?.label}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Version {question.version}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {question.created_by_name || 'Unknown'}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {new Date(question.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>

            <Separator />

            {/* Question Content */}
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Question Stem</Label>
                <div className="mt-1 p-3 bg-muted rounded-md">
                  <p className="whitespace-pre-wrap">{question.stem}</p>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Teaching Point</Label>
                <div className="mt-1 p-3 bg-muted rounded-md">
                  <p className="whitespace-pre-wrap">{question.teaching_point}</p>
                </div>
              </div>

              {question.question_references && (
                <div>
                  <Label className="text-sm font-medium">References</Label>
                  <div className="mt-1 p-3 bg-muted rounded-md">
                    <p className="whitespace-pre-wrap">{question.question_references}</p>
                  </div>
                </div>
              )}

              {/* Question Options */}
              {question.question_options && question.question_options.length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Question Options</Label>
                  <div className="mt-1 space-y-2">
                    {question.question_options.map((option, index) => (
                      <div
                        key={option.id}
                        className={`p-3 rounded-md border ${
                          option.is_correct 
                            ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' 
                            : 'bg-muted'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="font-medium">
                            {String.fromCharCode(65 + index)}.
                          </span>
                          <div className="flex-1">
                            <p>{option.text}</p>
                            {option.is_correct && (
                              <Badge variant="secondary" className="mt-1">
                                Correct Answer
                              </Badge>
                            )}
                            {option.explanation && (
                              <div className="mt-2 text-sm text-muted-foreground">
                                <strong>Explanation:</strong> {option.explanation}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Review Form */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="action">Review Action *</Label>
                <Select value={selectedAction} onValueChange={(value) => setSelectedAction(value as ReviewAction)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an action" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(REVIEW_ACTION_CONFIG).map(([action, config]) => (
                      <SelectItem key={action} value={action}>
                        <div className="flex items-center gap-2">
                          <span>{config.icon}</span>
                          <div>
                            <div className="font-medium">{config.label}</div>
                            <div className="text-xs text-muted-foreground">
                              {config.description}
                            </div>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="feedback">
                  Feedback {(selectedAction === 'reject' || selectedAction === 'request_changes') ? '*' : '(Optional)'}
                </Label>
                <Textarea
                  id="feedback"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder={
                    selectedAction === 'reject'
                      ? 'Explain why this question is being rejected and what needs to be fixed...'
                      : selectedAction === 'request_changes'
                      ? 'Explain what changes are needed and provide specific feedback...'
                      : 'Add any additional comments or suggestions...'
                  }
                  rows={4}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedAction || isSubmitting || ((selectedAction === 'reject' || selectedAction === 'request_changes') && !feedback.trim())}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Review'}
          </Button>
        </DialogFooter>
      </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}
