'use client'

import { Check } from 'lucide-react'
import { ImprovedImageDialog } from "@/shared/components/common/improved-image-dialog"
import { ImageCarousel } from "@/features/images/components/image-carousel"
import { Badge } from "@/shared/components/ui/badge"

interface QuestionSnapshotPreviewProps {
  question: any
  isComparison?: boolean
}

export function QuestionSnapshotPreview({
  question,
  isComparison = false
}: QuestionSnapshotPreviewProps) {
  const optionLabels = ['A', 'B', 'C', 'D', 'E']

  // Get question images for the stem and explanation
  const stemImages = Array.isArray(question.question_images)
    ? question.question_images.filter((qi: any) => qi.question_section === 'stem')
    : []
  const explanationImages = Array.isArray(question.question_images)
    ? question.question_images.filter((qi: any) => qi.question_section === 'explanation')
    : []

  // Get incorrect options with explanations
  const incorrectOptions = Array.isArray(question.question_options)
    ? question.question_options.filter((option: any) => !option.is_correct && option.explanation)
    : []

  return (
    <div className={`space-y-4 ${isComparison ? 'text-sm' : ''}`}>
      {/* Title */}
      <div>
        <h4 className={`font-medium ${isComparison ? 'text-sm' : 'text-lg'} mb-2`}>
          {question.title}
        </h4>
      </div>

      {/* Question Stem */}
      <div className={`${isComparison ? 'text-xs' : 'text-sm'} text-foreground/90`}>
        {question.stem}
      </div>

      {/* Stem Images */}
      {stemImages.length > 0 && (
        <div>
          {stemImages.length === 1 ? (
            <ImprovedImageDialog
              src={stemImages[0].image?.url || ''}
              alt={stemImages[0].image?.alt_text || ''}
              caption={stemImages[0].image?.description || ''}
              className="border rounded-lg"
              aspectRatio="16/10"
            />
          ) : (
            <ImageCarousel
              images={stemImages
                .filter((si: any) => si && si.image)
                .map((si: any) => ({
                  id: si.image?.id || '',
                  url: si.image?.url || '',
                  alt: si.image?.alt_text || '',
                  caption: si.image?.description || ''
                }))}
              className="border rounded-lg"
            />
          )}
        </div>
      )}

      {/* Answer Options */}
      <div className="space-y-2">
        <h5 className={`font-medium ${isComparison ? 'text-xs' : 'text-sm'}`}>Answer Options</h5>
        {Array.isArray(question.question_options) && question.question_options.length > 0 ? (
          <>
            {question.question_options
              .filter((option: any) => option && typeof option === 'object')
              .map((option: any, index: number) => {
                const optionLabel = optionLabels[index] || (index + 1).toString()
                const isCorrect = option.is_correct

                return (
                  <div
                    key={option.id || `option-${index}`}
                    className={`
                      p-2 rounded-md border ${isComparison ? 'text-xs' : 'text-sm'}
                      ${isCorrect ? 'bg-green-50 border-green-500 dark:bg-green-950/30' : 'border-muted'}
                    `}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`
                        flex items-center justify-center w-4 h-4 rounded-full border text-xs
                        ${isCorrect ? 'border-green-500' : 'border-muted-foreground/30'}
                      `}>
                        {optionLabel}
                      </span>
                      <span className="flex-1">{option.text || ''}</span>
                      {isCorrect && <Check className="w-3 h-3 text-green-500" />}
                    </div>
                  </div>
                )
              })}
          </>
        ) : (
          <div className={`p-3 text-center text-muted-foreground ${isComparison ? 'text-xs' : 'text-sm'}`}>
            No answer options available
          </div>
        )}
      </div>

      {/* Teaching Point and Explanation Section */}
      {(question.teaching_point || explanationImages.length > 0 || question.question_references || incorrectOptions.length > 0) && (
        <div className="p-3 rounded-lg bg-muted/50 space-y-4">
          {/* Teaching Point */}
          {question.teaching_point && (
            <div>
              <h5 className={`font-medium ${isComparison ? 'text-xs' : 'text-sm'} uppercase mb-1`}>Teaching Point</h5>
              <div className={`text-muted-foreground ${isComparison ? 'text-xs' : 'text-sm'}`}>
                {question.teaching_point}
              </div>
            </div>
          )}

          {/* Incorrect Option Explanations */}
          {Array.isArray(incorrectOptions) && incorrectOptions.length > 0 && (
            <div>
              <h5 className={`font-medium ${isComparison ? 'text-xs' : 'text-sm'} uppercase mb-2`}>Incorrect Option Explanations</h5>
              <div className="space-y-2">
                {incorrectOptions.map((option: any) => {
                  const originalIndex = question.question_options?.findIndex((opt: any) => opt.id === option.id) || 0
                  const optionLabel = optionLabels[originalIndex] || (originalIndex + 1).toString()

                  return (
                    <div key={option.id} className={`${isComparison ? 'text-xs' : 'text-sm'}`}>
                      <span className="font-medium">Option {optionLabel}:</span>
                      <span className="text-muted-foreground ml-2">{option.explanation}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Explanation Images */}
          {explanationImages.length > 0 && (
            <div>
              <h5 className={`font-medium ${isComparison ? 'text-xs' : 'text-sm'} uppercase mb-1`}>Reference Images</h5>
              {explanationImages.length === 1 ? (
                <ImprovedImageDialog
                  src={explanationImages[0].image?.url || ''}
                  alt={explanationImages[0].image?.alt_text || ''}
                  caption={explanationImages[0].image?.description || ''}
                  className="border rounded-lg"
                  aspectRatio="16/10"
                />
              ) : (
                <ImageCarousel
                  images={explanationImages
                    .filter((ei: any) => ei && ei.image)
                    .map((ei: any) => ({
                      id: ei.image?.id || '',
                      url: ei.image?.url || '',
                      alt: ei.image?.alt_text || '',
                      caption: ei.image?.description || ''
                    }))}
                  className="border rounded-lg"
                />
              )}
            </div>
          )}

          {/* References */}
          {question.question_references && (
            <div>
              <h5 className={`font-medium ${isComparison ? 'text-xs' : 'text-sm'} uppercase mb-1`}>References</h5>
              <div className={`text-muted-foreground ${isComparison ? 'text-xs' : 'text-sm'}`}>
                {question.question_references}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Metadata */}
      <div className={`flex items-center gap-4 pt-2 border-t ${isComparison ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
        <Badge variant="outline" className={isComparison ? 'text-xs' : ''}>
          {question.difficulty?.charAt(0).toUpperCase() + question.difficulty?.slice(1) || 'Medium'}
        </Badge>
        <span>Status: {question.status?.charAt(0).toUpperCase() + question.status?.slice(1) || 'Published'}</span>
        {question.categories && question.categories.length > 0 && (
          <span>Category: {question.categories[0].name}</span>
        )}
      </div>
    </div>
  )
}
