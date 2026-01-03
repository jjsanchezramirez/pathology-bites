"use client";

import { CheckCircle, XCircle, Circle, Clock } from "lucide-react";
import { QuizSession } from "@/features/quiz/types/quiz";
import { cn } from "@/shared/utils/utils";

interface QuizSidebarProps {
  session: QuizSession;
  currentQuestionIndex: number;
  attempts: Array<{
    questionId: string;
    selectedAnswerId: string | null;
    isCorrect: boolean;
    timeSpent: number;
  }>;
  onQuestionSelect?: (index: number) => void;
  timeRemaining?: number | null;
  isReviewMode?: boolean;
}

export function QuizSidebar({
  session,
  currentQuestionIndex,
  attempts,
  onQuestionSelect,
  timeRemaining,
  isReviewMode = false,
}: QuizSidebarProps) {
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const getQuestionStatus = (questionIndex: number) => {
    const question = session.questions[questionIndex];
    if (!question) return "unanswered";

    const attempt = attempts.find((a) => a.questionId === question.id);
    if (!attempt || !attempt.selectedAnswerId) return "unanswered";

    return attempt.isCorrect ? "correct" : "incorrect";
  };

  const getStatusIcon = (questionIndex: number) => {
    const status = getQuestionStatus(questionIndex);
    const isCurrent = questionIndex === currentQuestionIndex;

    // When selected, icon should match text color (primary-foreground)
    if (isCurrent) {
      if (status === "correct") {
        return <CheckCircle className="h-4 w-4 text-primary-foreground shrink-0" />;
      } else if (status === "incorrect") {
        return <XCircle className="h-4 w-4 text-primary-foreground shrink-0" />;
      } else {
        return (
          <Circle className="h-4 w-4 text-primary-foreground fill-primary-foreground shrink-0" />
        );
      }
    }

    // When not selected, use theme colors
    if (status === "correct") {
      return <CheckCircle className="h-4 w-4 text-blue-500 shrink-0" />;
    } else if (status === "incorrect") {
      return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
    } else {
      return <Circle className="h-4 w-4 text-muted-foreground shrink-0" />;
    }
  };

  const getQuestionButtonClass = (questionIndex: number) => {
    const status = getQuestionStatus(questionIndex);
    const isCurrent = questionIndex === currentQuestionIndex;

    if (isCurrent) {
      return "bg-primary text-primary-foreground border border-primary";
    } else if (status === "correct") {
      // Use blue color for correct answers
      return "bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30";
    } else if (status === "incorrect") {
      return "bg-destructive/10 text-destructive-foreground hover:bg-destructive/20 border border-destructive/50";
    } else {
      return "bg-transparent hover:bg-muted border border-border";
    }
  };

  const getQuestionSnippet = (question: unknown) => {
    if (!question.stem) return "Question content...";

    // Remove HTML tags and get first 40 characters
    const plainText = question.stem.replace(/<[^>]*>/g, "").trim();
    return plainText.length > 40 ? plainText.substring(0, 40) + "..." : plainText;
  };

  const progress = ((currentQuestionIndex + 1) / session.totalQuestions) * 100;

  return (
    <div className="h-full w-full flex flex-col min-w-[280px]">
      {/* Header */}
      <div className="p-5 border-b border-border shrink-0">
        <div className="text-[11px] font-semibold uppercase tracking-[0.8px] text-muted-foreground mb-1">
          QUIZ PROGRESS
        </div>
        <div className="text-[13px] text-muted-foreground">
          Question {currentQuestionIndex + 1} of {session.totalQuestions}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 ankoma-scrollbar-light dark:ankoma-scrollbar-dark">
        <div className="space-y-4 mb-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Time Remaining */}
          {timeRemaining !== null && timeRemaining !== undefined && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span
                className={cn(
                  "font-mono",
                  timeRemaining <= 10 ? "text-destructive font-semibold" : "text-foreground"
                )}
              >
                {formatTime(timeRemaining)}
              </span>
            </div>
          )}
        </div>

        {/* Question List */}
        <div className="space-y-1">
          {session.questions.map((question, index) => {
            // In review mode, allow clicking any question
            // In quiz mode, only allow clicking current or previous questions
            const isDisabled = !isReviewMode && index > currentQuestionIndex;

            return (
              <button
                key={question.id}
                onClick={() => onQuestionSelect?.(index)}
                disabled={isDisabled}
                className={cn(
                  "w-full px-3 py-2.5 rounded-lg transition-all duration-200 ease-in-out flex items-center text-left cursor-pointer gap-2",
                  getQuestionButtonClass(index),
                  isDisabled && "opacity-50 cursor-not-allowed"
                )}
              >
                {getStatusIcon(index)}
                <div className="flex-1 min-w-0">
                  <div
                    className={cn(
                      "font-medium text-[14px]",
                      currentQuestionIndex === index ? "text-primary-foreground" : "text-foreground"
                    )}
                  >
                    Q{index + 1}
                  </div>
                  <div
                    className={cn(
                      "text-[12px] truncate",
                      currentQuestionIndex === index
                        ? "text-primary-foreground/80"
                        : "text-muted-foreground"
                    )}
                  >
                    {getQuestionSnippet(question)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
