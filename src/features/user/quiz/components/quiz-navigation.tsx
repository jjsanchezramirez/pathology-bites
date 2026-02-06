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
}: QuizNavigationProps) {
  const isLastQuestion = currentQuestion === totalQuestions;
  const showExplanation = mode === "tutor";

  return (
    <div className="flex justify-between">
      <Button variant="outline" onClick={onPrevious} disabled={!canGoBack}>
        <ChevronLeft className="h-4 w-4 mr-2" />
        Previous
      </Button>

      <div className="flex gap-2">
        {!showExplanation && (
          <Button onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting
              ? "Submitting..."
              : isLastQuestion
                ? "Submit & Complete Quiz"
                : "Submit Answer"}
          </Button>
        )}

        {showExplanation && (
          <Button onClick={onNext}>
            {isLastQuestion ? "Complete Quiz" : "Next"}
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        )}

        {!showExplanation && mode !== "practice" && (
          <Button variant="outline" onClick={onNext}>
            Skip Question
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}
