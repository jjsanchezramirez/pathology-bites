'use client'

import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { Info } from 'lucide-react'
import { FormState } from '../multi-step-question-form'
import { ImageAttachmentsTab } from '../image-attachments-tab'

interface StepImageSelectionProps {
  formState: FormState
  updateFormState: (updates: Partial<FormState>) => void
}

export function StepImageSelection({ formState, updateFormState }: StepImageSelectionProps) {
  // Handle image attachments change
  const handleImagesChange = (images: Array<{
    image_id: string
    question_section: 'stem' | 'explanation'
    order_index: number
  }>) => {
    updateFormState({ questionImages: images })
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <ImageAttachmentsTab
        attachedImages={formState.questionImages}
        onAttachedImagesChange={handleImagesChange}
      />
    </div>
  )
}

