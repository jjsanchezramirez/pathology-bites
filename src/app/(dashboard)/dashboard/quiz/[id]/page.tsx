// src/app/(dashboard)/dashboard/quiz/[id]/page.tsx

"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import { useHybridQuiz, HybridPresets } from "@/features/user/quiz/hybrid";
import { QuizSession, QuizResult } from "@/features/user/quiz/types/quiz";
import { useFavoritesGlobal } from "@/features/user/questions/hooks/use-favorites-global";
import { QuestionFlagDialog } from "@/features/admin/questions/components/dialogs/question-flag-dialog";
import { useUserSettings } from "@/shared/hooks/use-user-settings";
import { useOnlineStatus } from "@/shared/hooks/use-online-status";
import { preloadLottieAnimation } from "@/shared/hooks/use-lottie-animation";
import { preloadImages } from "@/shared/components/media/offline-aware-image";
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
import { preloadLottieReactChunk } from "./components/dialogs/TimerExpiredDialog";
import { log } from "@/shared/utils/logging";

// Pattern-match on error messages that look like transient connectivity issues
// (offline / DNS / connection reset). Used to drive the offline-wait branch in
// runCompletion and to suppress noisy "Failed to fetch" toasts when we already
// know we're going to retry on reconnect.
function isNetworkErrorPattern(msg: string | undefined): boolean {
  return (
    !!msg &&
    (msg.includes("aborted") ||
      msg.includes("ECONNRESET") ||
      msg.includes("network") ||
      msg.includes("fetch") ||
      msg.includes("Failed to fetch"))
  );
}

export default function QuizSessionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const sessionId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const isReviewMode = searchParams.get("review") === "true";
  const questionParam = searchParams.get("question");

  // Hooks
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

  // Reactive online status — used to gate the timer-expiry redirect and to
  // soften offline failures on the question images.
  const isOnline = useOnlineStatus();

  // UI state
  const [isPaused, setIsPaused] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showUnansweredWarning, setShowUnansweredWarning] = useState(false);
  const [unansweredWarningCount, setUnansweredWarningCount] = useState(0);
  const [showAllAnsweredPrompt, setShowAllAnsweredPrompt] = useState(false);
  const [showFlagDialog, setShowFlagDialog] = useState(false);
  const [timerExpired, setTimerExpired] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
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
        log.error("Error fetching session config:", error);
      } finally {
        setSessionConfigLoading(false);
      }
    };

    fetchSessionConfig();
  }, [isReviewMode, sessionId]);

  // Determine hybrid preset. Only `enableOfflineSupport` is read by useHybridQuiz —
  // disabled for timed sessions where reload-on-reconnect is the correct behavior,
  // enabled for untimed sessions where loss recovery matters.
  const getHybridPreset = useCallback(() => {
    if (!sessionConfig) return HybridPresets.TUTOR_MODE;
    const { mode, timing } = sessionConfig;
    if (mode === "practice") return { enableOfflineSupport: timing === "untimed" };
    if (mode === "tutor") return { enableOfflineSupport: timing !== "timed" };
    return HybridPresets.TUTOR_MODE;
  }, [sessionConfig]);

  // Initialize hybrid quiz
  const [hybridState, hybridActions] = useHybridQuiz({
    sessionId: isReviewMode ? "" : sessionId || "",
    ...getHybridPreset(),
    onQuizCompleted: () => {
      if (isReviewMode) return;
    },
    onTimerExpired: () => {
      if (isReviewMode) return;
      if (timerExpired) return; // Guard: the hook's setInterval can fire callback twice on tick=0 in some race conditions
      log.debug("[Quiz Page] Timer expired, showing dialog");

      // Commit any pending answer selection (practice mode) before the hook
      // proceeds to forced completion. The dispatch is queued; what actually
      // lets it land in stateRef before handleCompleteQuiz reads it is the
      // `await autoSaveManager.waitForIdle(1500)` inside handleCompleteQuiz —
      // that await yields the microtask checkpoint, React commits the queued
      // SUBMIT_ANSWER reducer update, stateRef gets the new value, and
      // handleCompleteQuiz then reads it on the next line. Without that
      // await chain (i.e. if completion were synchronous), this commit would
      // race React's batching and silently drop the answer from the POST.
      const pending = pendingAnswerSelectionRef.current;
      if (pending) {
        try {
          hybridActions.submitAnswer(pending.questionId, pending.answerId);
          log.debug("[Quiz Page] Committed pending selection on timer expiry:", pending);
        } catch (err) {
          log.warn("[Quiz Page] Failed to commit pending selection on timer expiry:", err);
        }
        setPendingAnswerSelection(null);
        pendingAnswerSelectionRef.current = null;
      }

      setTimerExpired(true);
      runCompletionRef.current?.();
    },
    onError: (error) => {
      if (isReviewMode) return;
      if (error.includes("already completed")) {
        isNavigatingAwayRef.current = true;
        window.location.href = `/dashboard/quiz/${sessionId}/results`;
        return;
      }
      // Suppress network-error toasts that fire during the offline-timer-expiry
      // flow. runCompletion's offline-wait branch already handles these — it
      // registers an `online` listener and silently retries when the connection
      // returns. Surfacing a "Failed to fetch" toast on top of the
      // TimerExpiredDialog's own offline copy is just noise.
      if (isNetworkErrorPattern(error)) return;
      toast.error(error);
    },
  });

  // Track if we're intentionally navigating away (e.g., Save & Exit)
  const isNavigatingAwayRef = useRef(false);

  // Ref-based re-entry guard for runCompletion. See runCompletion comment for
  // the stale-closure / StrictMode-double-fire scenario this prevents.
  const isCompletionRunningRef = useRef(false);

  // Detect transition to "all questions answered" and prompt the user to submit.
  // Helpful for the common practice-mode flow where someone skips a middle question
  // and only answers it later — the natural Submit button is far away. The prompt
  // fires once per transition; if the user dismisses it and re-answers, the count
  // doesn't transition again so we don't nag.
  //
  // Suppressed when the user is on the last question: they'll see "Submit & Complete
  // Quiz" right in front of them, so the dialog would just be intrusive.
  // Snapshot the count into a local primitive so we can use it as a stable dep.
  // Depending on the whole `hybridState.progress` object made this effect re-run
  // every reducer dispatch (including every timer tick), which broke the
  // prev/now diff that triggers the all-answered dialog.
  const answeredCount = hybridState.progress.current;
  const totalQuestionsCount = hybridState.totalQuestions;
  const currentQuestionNumber = hybridState.currentQuestion;
  const quizStatus = hybridState.status;
  const previousAnsweredCountRef = useRef<number>(answeredCount);
  useEffect(() => {
    if (isReviewMode) return;
    const prev = previousAnsweredCountRef.current;
    const isOnLastQuestion = currentQuestionNumber === totalQuestionsCount;

    if (
      totalQuestionsCount > 0 &&
      answeredCount === totalQuestionsCount &&
      prev < totalQuestionsCount &&
      !isOnLastQuestion &&
      !isCompletingQuiz &&
      quizStatus !== "completed"
    ) {
      setShowAllAnsweredPrompt(true);
    }
    previousAnsweredCountRef.current = answeredCount;
  }, [
    answeredCount,
    totalQuestionsCount,
    currentQuestionNumber,
    quizStatus,
    isCompletingQuiz,
    isReviewMode,
  ]);

  // Centralized completion runner — the SINGLE entry point for every completion
  // path (last-question submit, all-answered prompt, tutor complete button,
  // timer expiry). On success, redirects to the results page. On failure with
  // a network-looking error or while offline, registers a one-shot `online`
  // listener and waits silently for the connection to come back — no failure
  // dialog, the Time's Up / loading UI stays put. On other failures, surfaces
  // the CompletionFailureDialog so the user can decide what to do.
  const runCompletion = useCallback(async () => {
    // Ref-based re-entry guard. The previous state-based `if (isCompletingQuiz)`
    // guard had a stale-closure bug: when the timer's onTimerExpired callback
    // double-fired (StrictMode in dev), both scheduled setTimeouts ran in the
    // same tick — both saw the closure's pre-update isCompletingQuiz=false,
    // both proceeded, and the second handleCompleteQuiz call short-circuited
    // on hasCompletedRef and returned a fake { success: true } that triggered
    // a premature offline redirect to /results.
    if (isCompletionRunningRef.current) return;
    isCompletionRunningRef.current = true;
    setIsCompletingQuiz(true);
    setCompletionError(null);

    const maxAttempts = 3;
    let lastError: string | undefined;

    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const result = await hybridActions.completeQuiz();
          if (result.success) {
            // Timer-expired path shows a "Time's Up!" dialog — give the user a
            // moment to register it before navigating. Manual-submit path
            // redirects immediately.
            const delay = timerExpired ? 2000 : 0;
            isNavigatingAwayRef.current = true;
            setTimeout(() => {
              window.location.href = `/dashboard/quiz/${sessionId}/results`;
            }, delay);
            return;
          }
          lastError = result.error;
          if (!isNetworkErrorPattern(result.error) || attempt === maxAttempts) break;
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        } catch (err) {
          lastError = err instanceof Error ? err.message : "Unknown error";
          if (attempt === maxAttempts) break;
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
      }

      setIsCompletingQuiz(false);

      // If we couldn't reach the server and it looks like a connectivity issue,
      // don't show the persistent failure dialog. Wait for the browser to come
      // back online and retry once. The TimerExpiredDialog (if open) keeps its
      // "you're offline — will submit when reconnected" message in place.
      if (!navigator.onLine || isNetworkErrorPattern(lastError)) {
        const onOnline = () => {
          window.removeEventListener("online", onOnline);
          void runCompletionRef.current?.();
        };
        window.addEventListener("online", onOnline);
        return;
      }

      setCompletionError(
        lastError ||
          "Couldn't reach the server. Your answers are saved locally — try again in a moment."
      );
    } finally {
      // Release the re-entry guard on every exit path EXCEPT the success path,
      // which has already set isNavigatingAwayRef and scheduled the redirect.
      // Releasing on success would let a late online-listener fire trigger a
      // second runCompletion racing the redirect.
      if (!isNavigatingAwayRef.current) {
        isCompletionRunningRef.current = false;
      }
    }
  }, [hybridActions, sessionId, timerExpired]);

  // The hook's onTimerExpired callback runs before runCompletion exists in
  // scope (callback is defined inside useHybridQuiz's options object). Bridge
  // through a ref so the callback can call into the latest runCompletion.
  const runCompletionRef = useRef(runCompletion);
  runCompletionRef.current = runCompletion;

  // Triggered from the all-answered prompt's "Submit Quiz" button.
  const handleSubmitFromAllAnsweredPrompt = useCallback(async () => {
    setShowAllAnsweredPrompt(false);
    await runCompletion();
  }, [runCompletion]);

  // Preload all question images and the "Time's Up" Lottie animation as soon as
  // the quiz initializes. Two reasons:
  //   1. If the user goes offline mid-quiz, the not-yet-seen images are already
  //      in the browser HTTP cache, so the OfflineAwareImage component renders
  //      them instead of the placeholder.
  //   2. The TimerExpiredDialog renders the alarm clock Lottie the instant the
  //      timer hits 0; without a warm cache it loads off the network, which
  //      fails (or just visibly flickers) when offline.
  const hasPreloadedRef = useRef(false);
  useEffect(() => {
    if (hasPreloadedRef.current) return;
    if (isReviewMode) return;
    if (!hybridState.isInitialized) return;
    const questions = hybridActions.getQuestions();
    if (questions.length === 0) return;

    hasPreloadedRef.current = true;
    const urls = questions.flatMap(
      (q) => q.question_images?.map((qi) => qi.image?.url).filter((u): u is string => !!u) ?? []
    );
    preloadImages(urls);
    preloadLottieAnimation("alarm_clock");
    // Warm the `lottie-react` JS chunk too. Without this, TimerExpiredDialog's
    // dynamic import fails with ChunkLoadError when the timer expires offline
    // — the chunk has never been loaded so the browser tries to fetch it cold
    // and gets ERR_INTERNET_DISCONNECTED.
    preloadLottieReactChunk().catch(() => {
      /* best-effort */
    });
  }, [hybridState.isInitialized, hybridActions, isReviewMode]);

  // Browser-level "Leave site?" warning while we're mid-completion or waiting for
  // a reconnection after the timer expired offline. Without this, the user can
  // close the tab during the offline-wait and lose their results submission. The
  // intentional-redirect cases (successful completion → /results, Save & Exit)
  // already set isNavigatingAwayRef before changing location.href, so they pass
  // through silently.
  useEffect(() => {
    if (isReviewMode) return;
    const shouldWarn = isCompletingQuiz || (timerExpired && !isOnline);
    if (!shouldWarn) return;

    const handler = (e: BeforeUnloadEvent) => {
      if (isNavigatingAwayRef.current) return;
      e.preventDefault();
      // Required for the prompt to show in some browsers; modern Chrome/Firefox
      // ignore the string and show a generic message.
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isReviewMode, isCompletingQuiz, timerExpired, isOnline]);

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

    try {
      await hybridActions.saveAndExit();
      isNavigatingAwayRef.current = true;
      window.location.href = "/dashboard/quizzes";
    } catch {
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

  // Helpers for the last-question completion paths. Both read through the
  // stateRef-backed accessors so they see fresh data even when called
  // immediately after a SUBMIT_ANSWER dispatch.
  //
  // `countUnansweredExcludingCurrent`: count of OTHER unanswered questions —
  // used when a commit just happened (or is about to) and we want to know
  // what's left.
  // `countAllUnanswered`: count of every unanswered question — used when no
  // commit is happening (e.g. user is on the last Q with an already-committed
  // answer, clicking "Submit Quiz").
  const countUnansweredExcludingCurrent = useCallback((): number => {
    const allQuestions = hybridActions.getQuestions();
    const currentId = hybridActions.getCurrentQuestion()?.id;
    return allQuestions.filter(
      (q) => q.id !== currentId && !hybridActions.getAnswerForQuestion(q.id)
    ).length;
  }, [hybridActions]);
  const countAllUnanswered = useCallback((): number => {
    return hybridActions.getQuestions().filter((q) => !hybridActions.getAnswerForQuestion(q.id))
      .length;
  }, [hybridActions]);

  const handleSubmitAnswer = async () => {
    const currentQuestion = hybridActions.getCurrentQuestion();
    if (!currentQuestion) return;
    const isLastQuestion = hybridState.currentQuestion === hybridState.totalQuestions;

    // Practice mode: two-step flow with pending selection.
    if (pendingAnswerSelection) {
      // Commit the pending selection to ITS OWN questionId — not the currently-displayed
      // question. If a fast nav happened between the answer click and this submit click,
      // currentQuestion could be N+1 while the pending selection is still for N. The
      // user's intent was to answer N; silently dropping that selection was a bug.
      if (pendingAnswerSelection.questionId !== currentQuestion.id) {
        log.warn(
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

      if (isLastQuestion) {
        const stillUnanswered = countUnansweredExcludingCurrent();
        if (stillUnanswered > 0) {
          // Case A2: committed the final answer but other questions are still
          // unanswered. Show the warning dialog so the user can review them
          // or complete anyway.
          setUnansweredWarningCount(stillUnanswered);
          setShowUnansweredWarning(true);
        } else {
          // Case A1: this commit completes the quiz. Give React a beat to flush
          // the SUBMIT_ANSWER dispatch before completion reads state via stateRef.
          setTimeout(() => {
            void runCompletion();
          }, 100);
        }
      } else {
        setTimeout(() => hybridActions.nextQuestion(), 100);
      }
      return;
    }

    // No pending selection. Two callers reach here:
    //   * Tutor mode: clicking "Complete Quiz" on the last question (answer was
    //     committed when the option was clicked).
    //   * Practice mode: clicking "Submit Quiz" / "Complete Quiz" on the last
    //     question when the final answer is already committed (case B — user
    //     navigated back, or the prior flow committed without completing).
    // The dialog/runCompletion decision is the same for both.
    if (isLastQuestion) {
      if (isCompletingQuiz) {
        log.debug("[Quiz Page] Already completing quiz, ignoring duplicate click");
        return;
      }

      const stillUnanswered = countAllUnanswered();
      if (stillUnanswered > 0) {
        // Case B: final committed but other questions still unanswered.
        setUnansweredWarningCount(stillUnanswered);
        setShowUnansweredWarning(true);
        return;
      }

      log.debug("[Quiz Page] Completion path with no pending selection - starting completion");
      await runCompletion();
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
          answeredCount={hybridState.progress.current}
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
          onDevSkipTimer={() => hybridActions.__devSetTimer(5)}
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
          isNavigatingAwayRef.current = true;
          window.location.href = "/dashboard/quizzes";
        }}
        onSaveAndExit={handleSaveAndExit}
      />

      <UnansweredWarningDialog
        open={showUnansweredWarning}
        onOpenChange={setShowUnansweredWarning}
        unansweredCount={unansweredWarningCount}
        onContinue={() => setShowUnansweredWarning(false)}
        onCompleteAnyway={async () => {
          setShowUnansweredWarning(false);
          // Route through runCompletion so the retry/error-dialog flow applies — same
          // path as the all-answered prompt and the inline last-question completion.
          await runCompletion();
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
        isOnline={isOnline}
        score={(() => {
          const p = hybridActions.getProgress();
          return { correct: p.correct, total: p.total };
        })()}
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
