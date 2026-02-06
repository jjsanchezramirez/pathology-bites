// src/app/(dashboard)/dashboard/quiz/[id]/page.tsx

"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import { useHybridQuiz, HybridPresets } from "@/features/user/quiz/hybrid";
import { QuizSession, QuizResult } from "@/features/user/quiz/types/quiz";
import { useCSRFToken } from "@/features/auth/hooks/use-csrf-token";
import { useFavoritesGlobal } from "@/features/user/questions/hooks/use-favorites-global";
import { QuestionFlagDialog } from "@/features/admin/questions/components/dialogs/question-flag-dialog";
import { useUserSettings } from "@/shared/hooks/use-user-settings";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { toast } from "@/shared/utils/ui/toast";
import {
  QuizActiveView,
  QuizReviewView,
  ExitConfirmDialog,
  UnansweredWarningDialog,
  TimerExpiredDialog,
  PauseOverlay,
} from "./components";

export default function QuizSessionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const sessionId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const isReviewMode = searchParams.get("review") === "true";

  // Hooks
  const { getToken } = useCSRFToken();
  const { isFavorited, toggleFavorite } = useFavoritesGlobal();
  const { data: settings } = useUserSettings();

  // Refs
  const contentAreaRef = useRef<HTMLDivElement>(null);

  // Session config state
  const [sessionConfig, setSessionConfig] = useState<QuizSession["config"] | null>(null);
  const [sessionConfigLoading, setSessionConfigLoading] = useState(true);

  // Review mode state
  const [reviewResult, setReviewResult] = useState<QuizResult | null>(null);
  const [reviewSession, setReviewSession] = useState<QuizSession | null>(null);
  const [reviewLoading, setReviewLoading] = useState(isReviewMode);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);

  // UI state
  const [isPaused, setIsPaused] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showUnansweredWarning, setShowUnansweredWarning] = useState(false);
  const [showFlagDialog, setShowFlagDialog] = useState(false);
  const [timerExpired] = useState(false);
  const [, setIsExiting] = useState(false);
  const [pendingAnswerSelection, setPendingAnswerSelection] = useState<{
    questionId: string;
    answerId: string;
  } | null>(null);

  // Fetch session config
  useEffect(() => {
    if (isReviewMode || !sessionId) {
      setSessionConfigLoading(false);
      return;
    }

    const fetchSessionConfig = async () => {
      try {
        const response = await fetch(`/api/user/quiz/sessions/${sessionId}`);
        if (!response.ok) throw new Error("Failed to fetch session config");
        const data = await response.json();
        if (data.success && data.data?.config) {
          setSessionConfig(data.data.config);
        }
      } catch (error) {
        console.error("Error fetching session config:", error);
      } finally {
        setSessionConfigLoading(false);
      }
    };

    fetchSessionConfig();
  }, [isReviewMode, sessionId]);

  // Determine hybrid preset
  const getHybridPreset = useCallback(() => {
    if (!sessionConfig) return HybridPresets.TUTOR_MODE;

    const { mode, timing } = sessionConfig;

    if (mode === "practice") {
      return {
        mode: "practice" as const,
        timing: timing as "timed" | "untimed",
        showExplanations: false,
        allowReview: true,
        enableRealtime: timing === "timed",
        enableOfflineSupport: timing === "untimed",
        autoSync: timing === "timed",
        syncOnComplete: true,
      };
    }

    if (mode === "tutor") {
      if (timing === "timed") {
        return {
          mode: "tutor" as const,
          timing: "timed" as const,
          showExplanations: true,
          allowReview: true,
          enableRealtime: true,
          enableOfflineSupport: false,
          autoSync: true,
          syncOnComplete: true,
        };
      }
      return HybridPresets.TUTOR_MODE;
    }

    return HybridPresets.TUTOR_MODE;
  }, [sessionConfig]);

  // Initialize hybrid quiz
  const [hybridState, hybridActions] = useHybridQuiz({
    sessionId: isReviewMode ? "" : sessionId || "",
    ...getHybridPreset(),
    csrfTokenGetter: getToken,
    onQuizCompleted: () => {
      if (isReviewMode) return;
    },
    onError: (error) => {
      if (isReviewMode) return;
      if (error.includes("already completed")) {
        window.location.href = `/dashboard/quiz/${sessionId}/results`;
      } else {
        toast.error(error);
      }
    },
  });

  // Fetch review data
  useEffect(() => {
    if (!isReviewMode || !sessionId) return;

    const fetchReviewData = async () => {
      try {
        const [sessionRes, resultRes] = await Promise.all([
          fetch(`/api/user/quiz/sessions/${sessionId}`),
          fetch(`/api/user/quiz/sessions/${sessionId}/results`),
        ]);

        if (!sessionRes.ok || !resultRes.ok) {
          throw new Error("Failed to fetch review data");
        }

        const [sessionData, resultData] = await Promise.all([sessionRes.json(), resultRes.json()]);

        if (sessionData.success) setReviewSession(sessionData.data);
        if (resultData.success) setReviewResult(resultData.data);
      } catch (error) {
        setReviewError(error instanceof Error ? error.message : "Unknown error");
      } finally {
        setReviewLoading(false);
      }
    };

    fetchReviewData();
  }, [isReviewMode, sessionId]);

  // Handlers
  const handleSaveAndExit = async () => {
    if (isReviewMode) {
      window.location.href = "/dashboard/quizzes";
      return;
    }

    setIsExiting(true);
    try {
      await hybridActions.saveAndExit();
      window.location.href = "/dashboard/quizzes";
    } catch {
      setIsExiting(false);
      toast.error("Failed to save quiz");
    }
  };

  const handlePause = () => {
    hybridActions.pauseQuiz();
    setIsPaused(true);
  };

  const handleResume = () => {
    hybridActions.resumeQuiz();
    setIsPaused(false);
  };

  const handleAnswerSelect = (answerId: string) => {
    const currentQuestion = hybridActions.getCurrentQuestion();
    if (!currentQuestion) return;

    if (sessionConfig?.mode === "tutor") {
      hybridActions.submitAnswer(currentQuestion.id, answerId);
    } else {
      setPendingAnswerSelection({
        questionId: currentQuestion.id,
        answerId: answerId,
      });
    }
  };

  const handleSubmitAnswer = async () => {
    if (!pendingAnswerSelection) return;

    const currentQuestion = hybridActions.getCurrentQuestion();
    if (!currentQuestion || pendingAnswerSelection.questionId !== currentQuestion.id) return;

    hybridActions.submitAnswer(pendingAnswerSelection.questionId, pendingAnswerSelection.answerId);
    setPendingAnswerSelection(null);

    const isLastQuestion = hybridState.currentQuestion === hybridState.totalQuestions;

    if (isLastQuestion) {
      setTimeout(async () => {
        const result = await hybridActions.completeQuiz();
        if (result.success) {
          window.location.href = `/dashboard/quiz/${sessionId}/results`;
        }
      }, 100);
    } else {
      setTimeout(() => hybridActions.nextQuestion(), 100);
    }
  };

  // Loading skeleton
  if (reviewLoading || (!isReviewMode && (hybridState.isLoading || sessionConfigLoading))) {
    return (
      <div className="h-full flex overflow-hidden">
        {/* Sidebar Skeleton - Desktop only */}
        <aside className="hidden md:block h-full shrink-0 bg-secondary border-r border-border w-[280px]">
          <div className="h-full p-5 space-y-4">
            <Skeleton className="h-6 w-32" />
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-8" />
              ))}
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-16" />
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Header Skeleton */}
          <header className="shrink-0 border-b border-border bg-background p-5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-8 w-48" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-8" />
                <Skeleton className="h-8 w-24" />
              </div>
            </div>
          </header>

          {/* Content Skeleton */}
          <div className="flex-1 overflow-auto">
            <div className="flex justify-center p-3">
              <div className="w-full max-w-2xl space-y-3">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const currentQuestion = isReviewMode ? null : hybridActions.getCurrentQuestion();
  const currentQuestionId =
    currentQuestion?.id || (isReviewMode && reviewSession?.questions?.[currentReviewIndex]?.id);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {isReviewMode ? (
        <QuizReviewView
          reviewSession={reviewSession}
          reviewResult={reviewResult}
          loading={reviewLoading}
          error={reviewError}
          currentIndex={currentReviewIndex}
          onNavigateToQuestion={setCurrentReviewIndex}
          textZoom={settings?.ui_settings.text_zoom || 1}
          mobileSidebarOpen={mobileSidebarOpen}
          onCloseMobileSidebar={() => setMobileSidebarOpen(false)}
          onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          getAnswerForQuestion={hybridActions.getAnswerForQuestion}
          contentAreaRef={contentAreaRef}
          sessionId={sessionId}
          currentQuestionId={currentQuestionId}
          isQuestionFavorited={currentQuestionId ? isFavorited(currentQuestionId) : false}
          onToggleFavorite={() => currentQuestionId && toggleFavorite(currentQuestionId)}
          onFlagQuestion={() => setShowFlagDialog(true)}
        />
      ) : (
        <QuizActiveView
          currentQuestion={currentQuestion}
          currentQuestionNumber={hybridState.currentQuestion}
          totalQuestions={hybridState.totalQuestions}
          textZoom={settings?.ui_settings.text_zoom || 1}
          pendingAnswerSelection={pendingAnswerSelection}
          onAnswerSelect={handleAnswerSelect}
          onPreviousQuestion={hybridActions.previousQuestion}
          onNextQuestion={hybridActions.nextQuestion}
          onSubmitAnswer={handleSubmitAnswer}
          canGoBack={hybridState.currentQuestion > 1}
          mode={sessionConfig?.mode || "tutor"}
          timing={sessionConfig?.timing || "untimed"}
          allQuestions={hybridActions.getQuestions()}
          getAnswerForQuestion={hybridActions.getAnswerForQuestion}
          onNavigateToQuestion={hybridActions.navigateToQuestion}
          mobileSidebarOpen={mobileSidebarOpen}
          onCloseMobileSidebar={() => setMobileSidebarOpen(false)}
          onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          contentAreaRef={contentAreaRef}
          isPaused={isPaused}
          onPause={handlePause}
          onResume={handleResume}
          currentQuestionId={currentQuestionId}
          isQuestionFavorited={currentQuestionId ? isFavorited(currentQuestionId) : false}
          onToggleFavorite={() => currentQuestionId && toggleFavorite(currentQuestionId)}
          onFlagQuestion={() => setShowFlagDialog(true)}
          onSaveAndExit={handleSaveAndExit}
          timeRemaining={hybridState.timeRemaining}
        />
      )}

      {/* Dialogs */}
      {isPaused && (
        <PauseOverlay onResume={handleResume} timing={sessionConfig?.timing || "untimed"} />
      )}

      <ExitConfirmDialog
        open={showExitDialog}
        onOpenChange={setShowExitDialog}
        onConfirmExit={() => {
          setIsExiting(true);
          window.location.href = "/dashboard/quizzes";
        }}
        onSaveAndExit={handleSaveAndExit}
      />

      <UnansweredWarningDialog
        open={showUnansweredWarning}
        onOpenChange={setShowUnansweredWarning}
        unansweredCount={0}
        onContinue={() => setShowUnansweredWarning(false)}
        onCompleteAnyway={async () => {
          setShowUnansweredWarning(false);
          const result = await hybridActions.completeQuiz();
          if (result.success) {
            window.location.href = `/dashboard/quiz/${sessionId}/results`;
          }
        }}
      />

      <TimerExpiredDialog
        open={timerExpired}
        onViewResults={() => {
          window.location.href = `/dashboard/quiz/${sessionId}/results`;
        }}
      />

      <QuestionFlagDialog
        open={showFlagDialog}
        onOpenChange={setShowFlagDialog}
        question={
          currentQuestion
            ? {
                id: currentQuestion.id,
                title: currentQuestion.title,
                stem: currentQuestion.stem,
              }
            : isReviewMode && reviewSession?.questions?.[currentReviewIndex]
              ? {
                  id: reviewSession.questions[currentReviewIndex].id,
                  title: reviewSession.questions[currentReviewIndex].title,
                  stem: reviewSession.questions[currentReviewIndex].stem,
                }
              : null
        }
        onFlagComplete={() => setShowFlagDialog(false)}
      />
    </div>
  );
}
