// src/features/quiz/components/quiz-navigation.tsx

"use client";

import { Button } from "@/shared/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface QuizNavigationProps {
  currentQuestion: number;
  totalQuestions: number;
  /** Count of already-committed answers (excludes any in-flight pending selection). */
  answeredCount?: number;
  /** True when the user has a pending answer selection for the current question. */
  hasPendingSelection?: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onSubmit: () => void;
  mode: "tutor" | "practice";
  timing: "timed" | "untimed";
  canGoBack: boolean;
  isSubmitting: boolean;
  isCurrentQuestionAnswered?: boolean;
}

export function QuizNavigation({
  currentQuestion,
  totalQuestions,
  answeredCount = 0,
  hasPendingSelection = false,
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

  // Last-question submit button label is state-driven so the user knows what will
  // happen when they click. The page-level handler still owns the action; this
  // just keeps the label in sync with the action.
  //   pending                     → "Submit & Complete Quiz" (commits then completes,
  //                                                          with or without dialog)
  //   committed + all answered    → "Complete Quiz"
  //   committed + others unans.   → "Submit Quiz"            (then dialog)
  let lastQuestionLabel = "Submit Answer";
  if (isLastQuestion) {
    const allAnswered = answeredCount >= totalQuestions;
    if (hasPendingSelection) {
      lastQuestionLabel = "Submit & Complete Quiz";
    } else if (isCurrentQuestionAnswered && allAnswered) {
      lastQuestionLabel = "Complete Quiz";
    } else if (isCurrentQuestionAnswered) {
      lastQuestionLabel = "Submit Quiz";
    }
  }

  // In tutor mode: after answering, show Next/Complete button.
  // In tutor mode: before answering, the option click auto-submits, so no submit button is needed.
  // In practice mode: show Submit Answer button (two-step flow — explicit commit before advancing).
  const showNextButton = mode === "tutor" && isCurrentQuestionAnswered;
  const showSubmitButton = mode !== "tutor";

  // Tutor-mode last-question label: same state machine as practice, but without
  // the pending branch (tutor commits on click, so isCurrentQuestionAnswered is
  // always true here). The dialog handles the unanswered-others case.
  const tutorLastLabel = answeredCount >= totalQuestions ? "Complete Quiz" : "Submit Quiz";

  return (
    <div className="flex justify-between">
      <Button variant="outline" onClick={onPrevious} disabled={!canGoBack}>
        <ChevronLeft className="h-4 w-4 mr-2" />
        Previous
      </Button>

      <div className="flex gap-2">
        {showSubmitButton && (
          <Button onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : isLastQuestion ? lastQuestionLabel : "Submit Answer"}
          </Button>
        )}

        {showNextButton && (
          <Button onClick={isLastQuestion ? onSubmit : onNext} disabled={isSubmitting}>
            {isSubmitting ? "Completing Quiz..." : isLastQuestion ? tutorLastLabel : "Next"}
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
