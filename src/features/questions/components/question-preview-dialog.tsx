// src/features/questions/components/question-preview-dialog.tsx
'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog"
import { Badge } from "@/shared/components/ui/badge"
import { Button } from "@/shared/components/ui/button"
import { Label } from "@/shared/components/ui/label"
import { Separator } from "@/shared/components/ui/separator"
import { Check, X, User, Calendar, FileQuestion } from 'lucide-react'

interface DraftQuestion {
  id: string
  title: string
  stem: string
  difficulty: string
  status: string
  created_at: string
  created_by: string
  question_set_id: string | null
  teaching_point: string | null
  creator?: {
    first_name: string
    last_name: string
    email: string
  }
  question_set?: {
    name: string
    short_form: string
  }
}

interface QuestionPreviewDialogProps {
  question: DraftQuestion | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onApprove: (questionId: string) => void
  onReject: (questionId: string) => void
}

export function QuestionPreviewDialog({ 
  question, 
  open, 
  onOpenChange, 
  onApprove, 
  onReject 
}: QuestionPreviewDialogProps) {
  if (!question) return null

  const handleApprove = () => {
    onApprove(question.id)
    onOpenChange(false)
  }

  const handleReject = () => {
    onReject(question.id)
    onOpenChange(false)
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy':
        return 'bg-green-100 text-green-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'hard':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }



  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileQuestion className="h-5 w-5" />
            Question Preview
          </DialogTitle>
          <DialogDescription>
            Review this draft question before approving or rejecting
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Question Metadata */}
          <div className="flex flex-wrap items-center gap-4">
            <Badge className={getDifficultyColor(question.difficulty)}>
              {question.difficulty}
            </Badge>
            {question.question_set && (
              <Badge variant="secondary">
                {question.question_set.short_form || question.question_set.name}
              </Badge>
            )}
            <span className="text-sm text-muted-foreground">
              Created {new Date(question.created_at).toLocaleDateString()}
            </span>
          </div>

          {/* Creator Information */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Created By
            </Label>
            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="text-sm font-medium">
                {question.creator ? 
                  `${question.creator.first_name} ${question.creator.last_name}` : 
                  'Unknown User'
                }
              </p>
              {question.creator && (
                <p className="text-xs text-muted-foreground">
                  {question.creator.email}
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Question Title */}
          <div className="space-y-2">
            <Label>Question Title</Label>
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm font-medium">{question.title}</p>
            </div>
          </div>

          {/* Question Stem */}
          <div className="space-y-2">
            <Label>Question Stem</Label>
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm whitespace-pre-wrap">{question.stem}</p>
            </div>
          </div>

          {/* Teaching Point */}
          {question.teaching_point && (
            <div className="space-y-2">
              <Label>Teaching Point</Label>
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm whitespace-pre-wrap">{question.teaching_point}</p>
              </div>
            </div>
          )}

          {/* Note about additional content */}
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> This preview shows the basic question information. 
              Answer options, images, and other detailed content can be viewed by editing the question.
            </p>
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleReject}
                className="text-red-600 border-red-600 hover:bg-red-50"
              >
                <X className="h-4 w-4 mr-2" />
                Reject
              </Button>
              <Button
                onClick={handleApprove}
                className="bg-green-600 hover:bg-green-700"
              >
                <Check className="h-4 w-4 mr-2" />
                Approve
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
