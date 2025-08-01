// src/features/quiz/components/quiz-navigation.tsx

"use client"

import { Button } from "@/shared/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface QuizNavigationProps {
  currentQuestionIndex: number
  totalQuestions: number
  selectedAnswerId: string | null
  showExplanation: boolean
  timing: 'timed' | 'untimed'
  onPreviousQuestion: () => void
  onNextQuestion: () => void
  onSubmitAnswer: () => void
  canGoBack: boolean
  isSubmitting?: boolean
}

export function QuizNavigation({
  currentQuestionIndex,
  totalQuestions,
  selectedAnswerId,
  showExplanation,
  timing,
  onPreviousQuestion,
  onNextQuestion,
  onSubmitAnswer,
  canGoBack,
  isSubmitting = false
}: QuizNavigationProps) {
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1

  return (
    <div className="flex justify-between">
      <Button
        variant="outline"
        onClick={onPreviousQuestion}
        disabled={!canGoBack}
      >
        <ChevronLeft className="h-4 w-4 mr-2" />
        Previous
      </Button>

      <div className="flex gap-2">
        {!showExplanation && selectedAnswerId && (
          <Button
            onClick={onSubmitAnswer}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Answer'}
          </Button>
        )}

        {showExplanation && (
          <Button onClick={onNextQuestion}>
            {isLastQuestion ? 'Complete Quiz' : 'Next'}
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        )}

        {!showExplanation && !selectedAnswerId && timing !== 'timed' && (
          <Button variant="outline" onClick={onNextQuestion}>
            Skip Question
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  )
}
