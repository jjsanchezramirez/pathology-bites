// src/features/questions/components/question-preview-dialog.tsx
'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog"
import { QuestionWithDetails } from '@/features/questions/types/questions'
import { CompactQuestionPreview } from './compact-question-preview'

interface QuestionPreviewDialogProps {
  question: QuestionWithDetails | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function QuestionPreviewDialog({
  question,
  open,
  onOpenChange
}: QuestionPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full !max-w-[min(90vw,1100px)] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Question Preview</DialogTitle>
        </DialogHeader>
        <CompactQuestionPreview question={question} />
      </DialogContent>
    </Dialog>
  )
}
