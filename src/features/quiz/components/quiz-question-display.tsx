// src/features/quiz/components/quiz-question-display.tsx

"use client"

import { Card, CardContent } from "@/shared/components/ui/card"
import { ImageCarousel } from "@/features/images/components/image-carousel"
import { Check, X } from "lucide-react"

interface QuizQuestion {
  id: string
  title: string
  stem: string
  teaching_point?: string
  question_references?: string
  question_options?: Array<{
    id: string
    text: string
    is_correct: boolean
    explanation?: string
  }>
  answer_options?: Array<{
    id: string
    text: string
    is_correct: boolean
    explanation?: string
  }>
  question_images?: Array<{
    question_section: string
    image?: {
      id: string
      url: string
      alt_text?: string
      description?: string
    }
  }>
}

interface QuizQuestionDisplayProps {
  question: QuizQuestion
  selectedAnswerId: string | null
  showExplanation: boolean
  onAnswerSelect: (answerId: string) => void
}

export function QuizQuestionDisplay({
  question,
  selectedAnswerId,
  showExplanation,
  onAnswerSelect
}: QuizQuestionDisplayProps) {


  // Get answer options with fallback for backward compatibility
  const answerOptions = question.question_options || question.answer_options || []

  // Helper to get a letter label for an option ID
  const getOptionLabel = (optionId: string, index: number): string => {
    if (optionId.length > 10) {
      return String.fromCharCode(65 + index) // A, B, C, D, etc.
    }
    return optionId.toString().charAt(0).toUpperCase()
  }

  return (
    <Card>
      <CardContent className="space-y-6 pt-6">
        {/* Question Stem */}
        <div>
          <p className="text-muted-foreground">{question.stem}</p>
        </div>

        {/* Question Stem Images */}
        {question.question_images && question.question_images.length > 0 && (
          <div>
            <ImageCarousel
              images={question.question_images
                .filter(qi => qi.question_section === 'stem')
                .map(qi => ({
                  id: qi.image?.id || '',
                  url: qi.image?.url || '',
                  alt: qi.image?.alt_text || qi.image?.description || 'Question image',
                  caption: qi.image?.description || undefined
                }))}
              className="border rounded-lg"
            />
          </div>
        )}

        {/* Answer Options */}
        <div className="grid gap-2" role="listbox" aria-label="Answer options">
          {answerOptions?.map((option, index) => {
            const isSelected = selectedAnswerId === option.id
            const showCorrect = showExplanation && option.is_correct
            const showIncorrect = showExplanation && isSelected && !option.is_correct
            const optionLabel = getOptionLabel(option.id, index)

            return (
              <button
                key={option.id}
                onClick={() => !showExplanation && onAnswerSelect(option.id)}
                disabled={showExplanation}
                className={`
                  w-full p-3 text-left border rounded-lg transition-colors
                  ${isSelected && !showExplanation ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}
                  ${showCorrect ? 'border-green-500 bg-green-50' : ''}
                  ${showIncorrect ? 'border-red-500 bg-red-50' : ''}
                  ${!showExplanation ? 'hover:border-gray-300 cursor-pointer' : 'cursor-default'}
                `}
                role="option"
                aria-selected={isSelected}
              >
                <div className="flex items-center gap-3">
                  <span className={`
                    flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center text-xs font-medium
                    ${isSelected && !showExplanation ? 'border-blue-500 bg-blue-500 text-white' : 'border-gray-300'}
                    ${showCorrect ? 'border-green-500 bg-green-500 text-white' : ''}
                    ${showIncorrect ? 'border-red-500 bg-red-100 text-red-700' : ''}
                  `}>
                    {optionLabel}
                  </span>
                  <span className="flex-1">{option.text}</span>
                  {showCorrect && <Check className="w-4 h-4 text-green-500" />}
                  {showIncorrect && <X className="w-4 h-4 text-red-500" />}
                </div>
              </button>
            )
          })}
        </div>

        {/* Explanation Section */}
        {showExplanation && (
          <div className="p-4 rounded-lg bg-muted/50 text-sm space-y-4">
            {/* Teaching Point */}
            {question.teaching_point && (
              <div>
                <h4 className="font-medium text-xs uppercase mb-2">Teaching Point</h4>
                <div className="text-muted-foreground">
                  {question.teaching_point}
                </div>
              </div>
            )}

            {/* Individual Option Explanations */}
            {answerOptions?.some(opt => opt.explanation) && (
              <div>
                <h4 className="font-medium text-xs uppercase mb-2">Answer Explanations</h4>
                <div className="space-y-2 text-muted-foreground">
                  {answerOptions
                    ?.filter(opt => opt.explanation)
                    .map((option, index) => (
                      <div key={option.id} className="flex gap-2">
                        <span className="font-medium">
                          {getOptionLabel(option.id, answerOptions?.findIndex(opt => opt.id === option.id) || index)}.
                        </span>
                        <span>{option.explanation}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Explanation Images */}
            {question.question_images && question.question_images.some(qi => qi.question_section === 'explanation') && (
              <div>
                <h4 className="font-medium text-xs uppercase mb-2">Reference Images</h4>
                <ImageCarousel
                  images={question.question_images
                    .filter(qi => qi.question_section === 'explanation')
                    .map(qi => ({
                      id: qi.image?.id || '',
                      url: qi.image?.url || '',
                      alt: qi.image?.alt_text || qi.image?.description || 'Reference image',
                      caption: qi.image?.description || undefined
                    }))}
                  className="bg-white border rounded-lg"
                />
              </div>
            )}

            {/* References */}
            {question.question_references && (
              <div className="text-xs text-muted-foreground">
                <h4 className="font-medium uppercase mb-1">References</h4>
                <div className="break-words">
                  {question.question_references}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
