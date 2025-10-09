'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Badge } from "@/shared/components/ui/badge"
import { Check } from "lucide-react"
import { QuestionWithDetails } from '@/features/questions/types/questions'
import { ImprovedImageDialog } from "@/shared/components/common/improved-image-dialog"
import { ImageCarousel } from "@/features/images/components/image-carousel"

interface CompactQuestionPreviewProps {
  question: QuestionWithDetails | null
}

export function CompactQuestionPreview({ question }: CompactQuestionPreviewProps) {
  if (!question) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Select a question to preview</p>
        </CardContent>
      </Card>
    )
  }

  const getOptionLabel = (index: number) => {
    return String.fromCharCode(65 + index) // A, B, C, D, E
  }

  // Get question images for the stem
  const stemImages = question.question_images?.filter(qi => qi.question_section === 'stem') || []
  const explanationImages = question.question_images?.filter(qi => qi.question_section === 'explanation') || []

  // Get incorrect options with explanations
  const incorrectOptions = question.question_options?.filter(option => !option.is_correct && option.explanation) || []

  return (
    <div className="w-full mx-auto">
      <Card className="h-full">
        <CardHeader className="py-2">
          <CardTitle className="text-lg">
            {question.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Question Stem */}
          <div className="text-sm text-foreground/90">
            {question.stem}
          </div>

          {/* Stem Images */}
          {stemImages.length > 0 && (
            <div>
              {stemImages.length === 1 ? (
                <ImprovedImageDialog
                  src={stemImages[0].images?.url || ''}
                  alt={stemImages[0].images?.alt_text || ''}
                  caption={stemImages[0].images?.description || ''}
                  className="border rounded-lg"
                  aspectRatio="16/10"
                />
              ) : (
                <ImageCarousel
                  images={stemImages.map(si => ({
                    id: si.images?.id || '',
                    url: si.images?.url || '',
                    alt: si.images?.alt_text || '',
                    caption: si.images?.description || ''
                  }))}
                  className="border rounded-lg"
                />
              )}
            </div>
          )}

          {/* Answer Options */}
          <div className="space-y-2" role="listbox" aria-label="Answer options">
            {question.question_options && question.question_options.length > 0 ? (
              question.question_options.map((option, index) => {
                const isCorrect = option.is_correct
                const optionLabel = getOptionLabel(index)

                return (
                  <div
                    key={option.id}
                    className={`
                      p-3 rounded-md text-left border text-sm
                      ${isCorrect ? 'bg-green-50 border-green-500 dark:bg-green-950/30' : 'border'}
                    `}
                    role="option"
                    aria-selected={isCorrect}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`
                        flex items-center justify-center w-5 h-5 rounded-full border text-xs
                        ${isCorrect ? 'border-green-500' : 'border-muted-foreground/30'}
                      `}>
                        {optionLabel}
                      </span>
                      <span className="flex-1">{option.text}</span>
                      {isCorrect && <Check className="w-4 h-4 text-green-500" />}
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="p-4 text-center text-muted-foreground">
                No answer options available
              </div>
            )}
          </div>

          {/* Teaching Point and Explanation - Always shown in preview */}
          {(question.teaching_point || explanationImages.length > 0 || question.question_references || incorrectOptions.length > 0) && (
            <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-4">
              {/* Teaching Point */}
              {question.teaching_point && (
                <div>
                  <h4 className="font-medium text-xs uppercase mb-1">Teaching Point</h4>
                  <div className="text-muted-foreground">
                    {question.teaching_point}
                  </div>
                </div>
              )}

              {/* Incorrect Option Explanations */}
              {incorrectOptions.length > 0 && (
                <div>
                  <h4 className="font-medium text-xs uppercase mb-2">Why Other Options Are Incorrect</h4>
                  <div className="space-y-2">
                    {incorrectOptions.map((option) => {
                      const originalIndex = question.question_options?.findIndex(opt => opt.id === option.id) || 0
                      const optionLabel = getOptionLabel(originalIndex)

                      return (
                        <div key={option.id} className="text-xs p-2 rounded border-l-2 bg-muted/30 border-l-muted-foreground/30 text-muted-foreground">
                          <span className="font-medium">{optionLabel}. </span>
                          {option.explanation}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Explanation Images */}
              {explanationImages.length > 0 && (
                <div>
                  <h4 className="font-medium text-xs uppercase mb-1">Reference Images</h4>
                  {explanationImages.length === 1 ? (
                    <ImprovedImageDialog
                      src={explanationImages[0].images?.url || ''}
                      alt={explanationImages[0].images?.alt_text || ''}
                      caption={explanationImages[0].images?.description || ''}
                      className="border rounded-lg"
                      aspectRatio="16/10"
                    />
                  ) : (
                    <ImageCarousel
                      images={explanationImages.map(ei => ({
                        id: ei.images?.id || '',
                        url: ei.images?.url || '',
                        alt: ei.images?.alt_text || '',
                        caption: ei.images?.description || ''
                      }))}
                      className="border rounded-lg"
                    />
                  )}
                </div>
              )}

              {/* References */}
              {question.question_references && (
                <div>
                  <h4 className="font-medium text-xs uppercase mb-1">References</h4>
                  <div className="text-muted-foreground text-xs">
                    {question.question_references}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Question Metadata */}
          <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="text-xs">
                {question.difficulty}
              </Badge>
              <span>Status: {question.status}</span>
              {question.categories && question.categories.length > 0 && (
                <span>Category: {question.categories[0].name}</span>
              )}
            </div>
            <div>
              Created: {new Date(question.created_at).toLocaleDateString()}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
