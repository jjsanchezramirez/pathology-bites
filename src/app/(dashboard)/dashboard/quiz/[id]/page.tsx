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
  AllAnsweredDialog,
  CompletionFailureDialog,
  TimerExpiredDialog,
  PauseOverlay,
} from "./components";

export default function QuizSessionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const sessionId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const isReviewMode = searchParams.get("review") === "true";
  const questionParam = searchParams.get("question");

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
  const [currentReviewIndex, setCurrentReviewIndex] = useState(() => {
    // Initialize from URL query parameter if present
    if (questionParam) {
      const index = parseInt(questionParam, 10);
      return !isNaN(index) && index >= 0 ? index : 0;
    }
    return 0;
  });

  // UI state
  const [isPaused, setIsPaused] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showUnansweredWarning, setShowUnansweredWarning] = useState(false);
  const [showAllAnsweredPrompt, setShowAllAnsweredPrompt] = useState(false);
  const [showFlagDialog, setShowFlagDialog] = useState(false);
  const [timerExpired, setTimerExpired] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [, setIsExiting] = useState(false);
  const [isCompletingQuiz, setIsCompletingQuiz] = useState(false);
  const [pendingAnswerSelection, setPendingAnswerSelection] = useState<{
    questionId: string;
    answerId: string;
  } | null>(null);

  // Ref mirror of pendingAnswerSelection so the hybrid quiz's onTimerExpired callback
  // (which fires from inside the hook with a stale closure) can read the latest pending
  // selection and commit it before the forced completion runs.
  const pendingAnswerSelectionRef = useRef<{ questionId: string; answerId: string } | null>(null);
  useEffect(() => {
    pendingAnswerSelectionRef.current = pendingAnswerSelection;
  }, [pendingAnswerSelection]);

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
    onTimerExpired: () => {
      if (isReviewMode) return;
      console.log("[Quiz Page] Timer expired, showing dialog");

      // Commit any pending answer selection (practice mode) before the hook proceeds to
      // forced completion. Otherwise the user's last selected-but-not-submitted answer
      // would be silently dropped on timer expiry.
      const pending = pendingAnswerSelectionRef.current;
      if (pending) {
        try {
          hybridActions.submitAnswer(pending.questionId, pending.answerId);
          console.log("[Quiz Page] Committed pending selection on timer expiry:", pending);
        } catch (err) {
          console.warn("[Quiz Page] Failed to commit pending selection on timer expiry:", err);
        }
        setPendingAnswerSelection(null);
        pendingAnswerSelectionRef.current = null;
      }

      setTimerExpired(true);
      setIsCompletingQuiz(true);
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

  // Track if we're intentionally navigating away (e.g., Save & Exit)
  const isNavigatingAwayRef = useRef(false);

  // Detect transition to "all questions answered" and prompt the user to submit.
  // Helpful for the common practice-mode flow where someone skips a middle question
  // and only answers it later — the natural Submit button is far away. The prompt
  // fires once per transition; if the user dismisses it and re-answers, the count
  // doesn't transition again so we don't nag.
  const previousAnsweredCountRef = useRef<number>(hybridState.progress.current);
  useEffect(() => {
    if (isReviewMode) return;
    const prev = previousAnsweredCountRef.current;
    const now = hybridState.progress.current;
    const total = hybridState.totalQuestions;

    if (
      total > 0 &&
      now === total &&
      prev < total &&
      !isCompletingQuiz &&
      hybridState.status !== "completed"
    ) {
      setShowAllAnsweredPrompt(true);
    }
    previousAnsweredCountRef.current = now;
  }, [
    hybridState.progress,
    hybridState.totalQuestions,
    hybridState.status,
    isCompletingQuiz,
    isReviewMode,
  ]);

  // Centralized completion runner with retry. Called from every completion entry point
  // (last-question submit, all-answered prompt, tutor complete button). On final failure
  // surfaces a persistent CompletionFailureDialog instead of a fleeting toast.
  const runCompletion = useCallback(async () => {
    if (isCompletingQuiz) return;
    setIsCompletingQuiz(true);
    setCompletionError(null);

    const maxAttempts = 3;
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await hybridActions.completeQuiz();
        if (result.success) {
          window.location.href = `/dashboard/quiz/${sessionId}/results`;
          return;
        }
        lastError = result.error;
        const isRetryable =
          !!result.error &&
          (result.error.includes("aborted") ||
            result.error.includes("ECONNRESET") ||
            result.error.includes("network") ||
            result.error.includes("fetch"));
        if (!isRetryable || attempt === maxAttempts) break;
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      } catch (err) {
        lastError = err instanceof Error ? err.message : "Unknown error";
        if (attempt === maxAttempts) break;
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }

    setIsCompletingQuiz(false);
    setCompletionError(
      lastError ||
        "Couldn't reach the server. Your answers are saved locally — try again in a moment."
    );
  }, [hybridActions, isCompletingQuiz, sessionId]);

  // Triggered from the all-answered prompt's "Submit Quiz" button.
  const handleSubmitFromAllAnsweredPrompt = useCallback(async () => {
    setShowAllAnsweredPrompt(false);
    await runCompletion();
  }, [runCompletion]);

  // Handle redirect after timer expiration and quiz completion
  useEffect(() => {
    if (timerExpired && hybridState.status === "completed") {
      console.log("[Quiz Page] Timer expired and quiz completed, redirecting to results...");
      // Wait a moment to show the dialog before redirecting
      setTimeout(() => {
        window.location.href = `/dashboard/quiz/${sessionId}/results`;
      }, 2000); // 2 second delay to show "Time's Up!" message
    }
  }, [timerExpired, hybridState.status, sessionId]);

  // Prevent accidental navigation away from quiz
  useEffect(() => {
    // Don't block navigation in review mode or during completion
    if (isReviewMode || isCompletingQuiz) return;

    // Only block if quiz is initialized
    if (!hybridState.isInitialized) return;

    // Intercept link clicks to show custom exit dialog
    const handleLinkClick = (e: MouseEvent) => {
      // Allow navigation if we're intentionally leaving
      if (isNavigatingAwayRef.current) return;

      const target = e.target as HTMLElement;
      const link = target.closest("a");

      // If clicking a link that navigates away from quiz
      if (link && link.href && !link.href.includes(window.location.pathname)) {
        e.preventDefault();
        e.stopPropagation();
        setShowExitDialog(true);
      }
    };

    // Intercept browser back/forward buttons
    const handlePopState = () => {
      // Allow navigation if we're intentionally leaving
      if (isNavigatingAwayRef.current) return;

      setShowExitDialog(true);
      // Push state back to keep user on quiz page
      window.history.pushState(null, "", window.location.href);
    };

    // Add initial history entry to enable popstate detection
    window.history.pushState(null, "", window.location.href);

    document.addEventListener("click", handleLinkClick, true);
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleLinkClick, true);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isReviewMode, hybridState.isInitialized, isCompletingQuiz]);

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

  // Review mode answer lookup - uses review data instead of hybrid quiz state
  const getReviewAnswerForQuestion = useCallback(
    (questionId: string) => {
      // Try reviewResult.questionDetails first (has isCorrect info)
      if (reviewResult?.questionDetails) {
        const detail = reviewResult.questionDetails.find((q) => q.id === questionId);
        if (detail && detail.selectedAnswerId) {
          return {
            questionId,
            selectedOptionId: detail.selectedAnswerId,
            isCorrect: detail.isCorrect,
            timeSpent: detail.timeSpent || 0,
            timestamp: 0,
          };
        }
      }
      // Fallback to session answers
      if (reviewSession?.answers) {
        const answer = reviewSession.answers.find((a) => a.questionId === questionId);
        if (answer) {
          return {
            questionId,
            selectedOptionId: answer.selectedOptionId,
            isCorrect: answer.isCorrect,
            timeSpent: answer.timeSpent || 0,
            timestamp: answer.timestamp || 0,
          };
        }
      }
      return null;
    },
    [reviewResult, reviewSession]
  );

  // Handlers
  const handleSaveAndExit = async () => {
    if (isReviewMode) {
      isNavigatingAwayRef.current = true;
      window.location.href = "/dashboard/quizzes";
      return;
    }

    setIsExiting(true);
    try {
      await hybridActions.saveAndExit();
      isNavigatingAwayRef.current = true;
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

    // Tutor mode: click = commit. The explanation appears immediately after, which is
    // the whole point of tutor mode — instant feedback while learning.
    //
    // Practice mode: click = pending selection only. The answer is NOT committed until
    // the user clicks "Submit Answer" — this is deliberate. Practice mode suppresses
    // inline explanations so users can self-assess without feedback (similar to a real
    // exam), and the explicit two-step submit reinforces that the answer is final.
    // Strike-toggle gating mirrors this: strikes stay enabled longer in practice (until
    // submit) but lock in tutor as soon as an answer is committed (since the explanation
    // now reveals the correct answer).
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
    const currentQuestion = hybridActions.getCurrentQuestion();
    if (!currentQuestion) return;

    // Practice mode: two-step flow with pending selection.
    if (pendingAnswerSelection) {
      // Commit the pending selection to ITS OWN questionId — not the currently-displayed
      // question. If a fast nav happened between the answer click and this submit click,
      // currentQuestion could be N+1 while the pending selection is still for N. The
      // user's intent was to answer N; silently dropping that selection was a bug.
      if (pendingAnswerSelection.questionId !== currentQuestion.id) {
        console.warn(
          "[Quiz Page] Pending selection question id differs from current question — committing to the pending id anyway",
          {
            pendingQuestionId: pendingAnswerSelection.questionId,
            currentQuestionId: currentQuestion.id,
          }
        );
      }

      hybridActions.submitAnswer(
        pendingAnswerSelection.questionId,
        pendingAnswerSelection.answerId
      );
      setPendingAnswerSelection(null);

      const isLastQuestion = hybridState.currentQuestion === hybridState.totalQuestions;

      if (isLastQuestion) {
        // Give React a beat to flush the SUBMIT_ANSWER dispatch before completion reads
        // state via stateRef. Without this 100ms the in-flight render may not have
        // propagated the just-submitted answer to the ref.
        setTimeout(() => {
          void runCompletion();
        }, 100);
      } else {
        setTimeout(() => hybridActions.nextQuestion(), 100);
      }
      return;
    }

    // Tutor mode: answer already submitted, this is the "Complete Quiz" action on last question
    if (sessionConfig?.mode === "tutor") {
      const isLastQuestion = hybridState.currentQuestion === hybridState.totalQuestions;
      if (isLastQuestion) {
        // Prevent duplicate completion calls
        if (isCompletingQuiz) {
          console.log("[Quiz Page] Already completing quiz, ignoring duplicate click");
          return;
        }

        console.log("[Quiz Page] User clicked 'Complete Quiz' button - starting completion");
        await runCompletion();
      }
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
          getAnswerForQuestion={getReviewAnswerForQuestion}
          contentAreaRef={contentAreaRef}
          sessionId={sessionId}
          currentQuestionId={currentQuestionId}
          isQuestionFavorited={currentQuestionId ? isFavorited(currentQuestionId) : false}
          onToggleFavorite={() => currentQuestionId && toggleFavorite(currentQuestionId)}
          onFlagQuestion={() => setShowFlagDialog(true)}
        />
      ) : (
        <QuizActiveView
          sessionId={sessionId || ""}
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
          isSubmitting={isCompletingQuiz}
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
          isNavigatingAwayRef.current = true;
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

      <AllAnsweredDialog
        open={showAllAnsweredPrompt}
        onOpenChange={setShowAllAnsweredPrompt}
        onSubmitQuiz={handleSubmitFromAllAnsweredPrompt}
        onContinue={() => setShowAllAnsweredPrompt(false)}
      />

      <CompletionFailureDialog
        open={!!completionError}
        errorMessage={completionError}
        isRetrying={isCompletingQuiz}
        onRetry={() => {
          setCompletionError(null);
          void runCompletion();
        }}
        onDismiss={() => setCompletionError(null)}
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
