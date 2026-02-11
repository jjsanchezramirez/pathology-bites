// src/features/quiz/components/quiz-navigation.tsx

"use client";

import { Button } from "@/shared/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface QuizNavigationProps {
  currentQuestion: number;
  totalQuestions: number;
  onPrevious: () => void;
  onNext: () => void;
  onSubmit: () => void;
  mode: "tutor" | "exam" | "practice";
  timing: "timed" | "untimed";
  canGoBack: boolean;
  isSubmitting: boolean;
  isCurrentQuestionAnswered?: boolean;
}

export function QuizNavigation({
  currentQuestion,
  totalQuestions,
  onPrevious,
  onNext,
  onSubmit,
  mode,
  timing: _timing,
  canGoBack,
  isSubmitting,
  isCurrentQuestionAnswered = false,
}: QuizNavigationProps) {
  const isLastQuestion = currentQuestion === totalQuestions;

  // In tutor mode: after answering, show Next/Complete button
  // In tutor mode: before answering, user clicks an option which auto-submits, so no submit button needed
  // In practice/exam mode: show Submit Answer button (two-step flow)
  const showNextButton = mode === "tutor" && isCurrentQuestionAnswered;
  const showSubmitButton = mode !== "tutor";

  return (
    <div className="flex justify-between">
      <Button variant="outline" onClick={onPrevious} disabled={!canGoBack}>
        <ChevronLeft className="h-4 w-4 mr-2" />
        Previous
      </Button>

      <div className="flex gap-2">
        {showSubmitButton && (
          <Button onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting
              ? "Submitting..."
              : isLastQuestion
                ? "Submit & Complete Quiz"
                : "Submit Answer"}
          </Button>
        )}

        {showNextButton && (
          <Button onClick={isLastQuestion ? onSubmit : onNext} disabled={isSubmitting}>
            {isSubmitting ? "Completing Quiz..." : isLastQuestion ? "Complete Quiz" : "Next"}
            {!isSubmitting && <ChevronRight className="h-4 w-4 ml-2" />}
          </Button>
        )}

        {!showNextButton && !showSubmitButton && (
          <Button variant="outline" onClick={onNext}>
            Skip Question
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        )}

        {showSubmitButton && mode !== "practice" && (
          <Button variant="outline" onClick={onNext}>
            Skip Question
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}
