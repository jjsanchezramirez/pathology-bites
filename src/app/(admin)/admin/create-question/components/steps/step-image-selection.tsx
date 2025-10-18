'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { Image as ImageIcon, Info } from 'lucide-react'
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
      <Alert className="border-blue-200 bg-blue-50/50">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-900">
          Images are optional. You can add up to 3 images to the question stem and unlimited images to the explanation section.
        </AlertDescription>
      </Alert>

      <ImageAttachmentsTab
        attachedImages={formState.questionImages}
        onAttachedImagesChange={handleImagesChange}
      />
    </div>
  )
}

