// src/app/(dashboard)/dashboard/quiz/[id]/components/QuizActiveView.tsx

import { QuizQuestionDisplay } from "@/features/user/quiz/components/quiz-question-display";
import { QuizNavigation } from "@/features/user/quiz/components/quiz-navigation";
import { QuizSidebar } from "@/features/user/quiz/components/quiz-sidebar";
import { FeatureErrorBoundary } from "@/shared/components/common";
import { UIQuizQuestion } from "@/features/user/quiz/types/quiz-question";
import { QuizAnswer } from "@/features/user/quiz/types/quiz-question";
import { RefObject } from "react";
import { Button } from "@/shared/components/ui/button";
import { PanelLeftOpen, Flag, Pause, Play, Clock } from "lucide-react";

interface QuizActiveViewProps {
  // Current question
  currentQuestion: UIQuizQuestion | null;
  currentQuestionNumber: number;
  totalQuestions: number;

  // Question display
  textZoom: number;
  pendingAnswerSelection: { questionId: string; answerId: string } | null;
  onAnswerSelect: (answerId: string) => void;

  // Navigation
  onPreviousQuestion: () => void;
  onNextQuestion: () => void;
  onSubmitAnswer: () => void;
  canGoBack: boolean;

  // Quiz config
  mode: "tutor" | "exam" | "practice";
  timing: "timed" | "untimed";

  // Sidebar
  allQuestions: UIQuizQuestion[];
  getAnswerForQuestion: (questionId: string) => QuizAnswer | null;
  onNavigateToQuestion: (index: number) => void;
  mobileSidebarOpen: boolean;
  onCloseMobileSidebar: () => void;
  onToggleMobileSidebar?: () => void;

  // Header props
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  currentQuestionId?: string;
  onFlagQuestion?: () => void;
  onSaveAndExit: () => void;
  timeRemaining?: number | null;
  totalTimeLimit?: number | null;

  // Scroll ref
  contentAreaRef: RefObject<HTMLDivElement>;
}

export function QuizActiveView({
  currentQuestion,
  currentQuestionNumber,
  totalQuestions,
  textZoom,
  pendingAnswerSelection,
  onAnswerSelect,
  onPreviousQuestion,
  onNextQuestion,
  onSubmitAnswer,
  canGoBack,
  mode,
  timing,
  allQuestions,
  getAnswerForQuestion,
  onNavigateToQuestion,
  mobileSidebarOpen,
  onCloseMobileSidebar,
  onToggleMobileSidebar,
  contentAreaRef,
  isPaused,
  onPause,
  onResume,
  currentQuestionId: _currentQuestionId,
  onFlagQuestion,
  onSaveAndExit,
  timeRemaining,
}: QuizActiveViewProps) {
  if (!currentQuestion) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading question...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex overflow-hidden">
      {/* Sidebar */}
      <QuizSidebar
        questions={allQuestions}
        currentQuestionIndex={currentQuestionNumber - 1}
        getAnswerForQuestion={getAnswerForQuestion}
        onNavigateToQuestion={onNavigateToQuestion}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={onCloseMobileSidebar}
        showAnswerFeedback={mode === "tutor"}
      />

      {/* Main content */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Header - Fixed at top */}
        <header className="shrink-0 border-b border-border bg-background p-5">
          <div className="flex items-center justify-between gap-2 md:gap-4">
            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
              {/* Mobile Menu Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={onToggleMobileSidebar}
                className="lg:hidden"
              >
                <PanelLeftOpen className="h-4 w-4" />
                <span className="hidden sm:inline ml-2">Navigation</span>
              </Button>

              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold uppercase tracking-[0.8px] text-muted-foreground mb-1">
                  QUIZ SESSION
                </div>
                <div className="text-[13px] md:text-[14px] font-medium text-foreground truncate">
                  Question {currentQuestionNumber} of {totalQuestions}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1 shrink-0">
              <div className="flex items-center gap-1">
                {/* Flag Button */}
                {onFlagQuestion && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onFlagQuestion}
                    title="Flag question for review"
                    className="h-8 w-8 p-0"
                  >
                    <Flag className="h-4 w-4" />
                  </Button>
                )}

                {/* Pause/Resume Button */}
                {!isPaused ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onPause}
                    title="Pause quiz"
                    className="h-8 w-8 p-0"
                  >
                    <Pause className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onResume}
                    title="Resume quiz"
                    className="h-8 w-8 p-0"
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                )}

                {/* Save & Exit Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSaveAndExit}
                  title="Save and exit"
                  className="h-8 px-3 hidden md:flex"
                >
                  Save & Exit
                </Button>
              </div>

              {/* Timer */}
              {timeRemaining !== null && timeRemaining !== undefined && (
                <div className="flex items-center gap-1 md:gap-2 text-[13px] md:text-[14px] font-medium text-foreground">
                  <Clock className="h-4 w-4" />
                  <span className="font-mono">
                    {Math.floor(timeRemaining / 60)}:
                    {(timeRemaining % 60).toString().padStart(2, "0")}
                  </span>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable content area with max-width constraint */}
        <div className="flex-1 overflow-auto">
          <div className="flex justify-center p-2 md:p-3">
            <div ref={contentAreaRef} className="w-full max-w-2xl space-y-3">
              <FeatureErrorBoundary>
                <QuizQuestionDisplay
                  question={currentQuestion}
                  questionNumber={currentQuestionNumber}
                  totalQuestions={totalQuestions}
                  textZoom={textZoom}
                  mode={mode}
                  selectedAnswerId={
                    pendingAnswerSelection?.questionId === currentQuestion.id
                      ? pendingAnswerSelection.answerId
                      : getAnswerForQuestion(currentQuestion.id)?.selectedOptionId || null
                  }
                  onAnswerSelect={onAnswerSelect}
                  showExplanation={mode === "tutor" && !!getAnswerForQuestion(currentQuestion.id)}
                  isReviewMode={false}
                />
              </FeatureErrorBoundary>

              <FeatureErrorBoundary>
                <QuizNavigation
                  currentQuestion={currentQuestionNumber}
                  totalQuestions={totalQuestions}
                  onPrevious={onPreviousQuestion}
                  onNext={onNextQuestion}
                  onSubmit={onSubmitAnswer}
                  mode={mode}
                  timing={timing}
                  canGoBack={canGoBack}
                  isSubmitting={false}
                  isCurrentQuestionAnswered={!!getAnswerForQuestion(currentQuestion.id)}
                />
              </FeatureErrorBoundary>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
