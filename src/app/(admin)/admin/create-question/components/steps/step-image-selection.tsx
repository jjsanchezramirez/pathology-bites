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
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Images are optional. You can add up to 3 images to the question stem and unlimited images to the explanation section.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Question Images
          </CardTitle>
          <CardDescription>
            Select images from the media library to attach to your question
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImageAttachmentsTab
            attachedImages={formState.questionImages}
            onAttachedImagesChange={handleImagesChange}
          />
        </CardContent>
      </Card>

      {/* Image Preview */}
      {formState.questionImages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Attached Images ({formState.questionImages.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {formState.questionImages.map((img, index) => (
                <div key={index} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      Image {index + 1} - {img.question_section === 'stem' ? 'Question Stem' : 'Explanation'}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Order: {img.order_index + 1}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

