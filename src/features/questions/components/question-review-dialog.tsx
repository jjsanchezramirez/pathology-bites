'use client'

import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
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
    if (!question || !selectedAction) {
      toast.error('Please select a review action')
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

      // Determine new question status based on action
      let newStatus = question.status
      switch (selectedAction) {
        case 'approve_as_is':
          newStatus = 'published'
          break
        case 'approve_with_edits':
          newStatus = 'published'
          break
        case 'request_revisions':
          newStatus = 'draft'
          break
        case 'reject':
          newStatus = 'rejected'
          break
      }

      // Create review record
      const { error: reviewError } = await supabase
        .from('question_reviews')
        .insert({
          question_id: question.id,
          reviewer_id: user.id,
          action: selectedAction,
          feedback: feedback || null
        })

      if (reviewError) {
        console.error('Error creating review:', reviewError)
        toast.error('Failed to create review record')
        return
      }

      // Update question status and review fields
      const { error: updateError } = await supabase
        .from('questions')
        .update({
          status: newStatus,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', question.id)

      if (updateError) {
        console.error('Error updating question:', updateError)
        toast.error('Failed to update question status')
        return
      }

      toast.success(`Question ${selectedAction.replace('_', ' ')} successfully`)
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
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Review Question: {question.title}
          </DialogTitle>
          <DialogDescription>
            Review this question and decide on the appropriate action.
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

              {/* Answer Options */}
              {question.answer_options && question.answer_options.length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Answer Options</Label>
                  <div className="mt-1 space-y-2">
                    {question.answer_options.map((option, index) => (
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
                  Feedback {selectedAction === 'request_revisions' || selectedAction === 'reject' ? '*' : '(Optional)'}
                </Label>
                <Textarea
                  id="feedback"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder={
                    selectedAction === 'request_revisions' 
                      ? 'Explain what changes are needed...'
                      : selectedAction === 'reject'
                      ? 'Explain why this question is being rejected...'
                      : 'Add any additional comments...'
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
            disabled={!selectedAction || isSubmitting || (
              (selectedAction === 'request_revisions' || selectedAction === 'reject') && !feedback.trim()
            )}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Review'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
