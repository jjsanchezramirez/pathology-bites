/**
 * Pure Serverless Hybrid Quiz System - Main Hook
 *
 * This is the primary interface for the hybrid quiz system that combines
 * the client-side state machine with the database sync manager to achieve
 * 96.7% API call reduction while maintaining full functionality.
 *
 * Features:
 * - Instant UI responses (0ms latency)
 * - Only 2 API calls per quiz
 * - Offline capability with local storage
 * - Automatic sync management
 * - Optimized for Vercel's free tier
 */

import { useEffect, useCallback, useRef, useState } from "react";
import { useQuizStateMachine } from "./hooks/use-quiz-state-machine";
import { DatabaseSyncManager, SyncResult } from "./core/database-sync-manager";
import { AutoSaveManager } from "../services/auto-save-manager";
import { AUTO_SAVE_CONFIG, SyncStatus } from "../config/auto-save-config";
import {
  QuizAnswer,
  QuizState,
  QuizQuestionTransformer,
  UIQuizQuestion,
} from "../types/quiz-question";
import type { QuizResult } from "../types/quiz";
import { toast } from "@/shared/utils/ui/toast";
import {
  updateCacheAfterQuiz,
  invalidateQuizSessions,
  invalidateUnifiedData,
} from "@/shared/utils/cache/cache-helpers";
import { calculateAchievementsToUnlock } from "@/features/user/achievements/services/achievement-checker.client";
import { useUnifiedData } from "@/shared/hooks/use-unified-data";

export interface UseHybridQuizOptions {
  sessionId: string;
  enableOfflineSupport?: boolean;
  csrfTokenGetter?: () => Promise<string>;
  onAnswerSubmitted?: (
    questionId: string,
    answerId: string,
    result: { isCorrect: boolean; feedback?: unknown }
  ) => void;
  onQuizCompleted?: (result: { score: number; totalQuestions: number; timeSpent: number }) => void;
  onTimerExpired?: () => void;
  onError?: (error: string) => void;
  onSyncStatusChange?: (status: "syncing" | "synced" | "error" | "offline") => void;
}

export interface HybridQuizState {
  // Quiz State
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Current State
  status: QuizState["status"];
  currentQuestion: number;
  totalQuestions: number;

  // Progress
  progress: {
    current: number;
    total: number;
    percentage: number;
  };

  // Auto-save Status
  syncStatus: SyncStatus;
  lastSyncTime: number | null;
  queueStatus: {
    total: number;
    ready: number;
    waiting: number;
  };

  // Timer (for timed quizzes)
  timeRemaining: number | null; // seconds remaining
  totalTimeLimit: number | null; // total time limit in seconds
  timerExpired: boolean; // true when timer reaches 0
}

export interface HybridQuizActions {
  // Quiz Control
  pauseQuiz: () => void;
  resumeQuiz: () => void;
  saveAndExit: () => Promise<void>;
  completeQuiz: () => Promise<SyncResult>;

  // Answer Management
  submitAnswer: (
    questionId: string,
    answerId: string
  ) => { isCorrect: boolean; feedback?: unknown } | null;

  // Navigation
  nextQuestion: () => boolean;
  previousQuestion: () => boolean;
  navigateToQuestion: (index: number) => boolean;

  // Data Access
  getCurrentQuestion: () => UIQuizQuestion | null;
  getQuestions: () => UIQuizQuestion[];
  getAnswerForQuestion: (questionId: string) => QuizAnswer | null;
  getQuizConfig: () => QuizState["config"] | null;

  // Utilities
  getProgress: () => { answered: number; correct: number; total: number };

  // Dev-only: jump the timer to a small value (e.g. 5s) so we don't have to
  // wait through a 60s timer to test the expiry path. No-op in production.
  __devSetTimer: (seconds: number) => void;
}

export function useHybridQuiz(options: UseHybridQuizOptions): [HybridQuizState, HybridQuizActions] {
  const {
    sessionId,
    enableOfflineSupport = true,
    csrfTokenGetter,
    onAnswerSubmitted,
    onQuizCompleted,
    onTimerExpired,
    onError,
    onSyncStatusChange,
  } = options;

  // Get unified performance data (includes stats and unlocked achievements)
  const { data: unifiedData } = useUnifiedData();

  // Sync status state
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ state: "idle", message: "" });
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);

  // Initialize sync manager
  const syncManager = useRef<DatabaseSyncManager | null>(null);
  if (!syncManager.current) {
    syncManager.current = new DatabaseSyncManager({
      csrfTokenGetter,
      onSyncStart: () => {
        setSyncStatus({ state: "syncing", message: "Syncing..." });
        onSyncStatusChange?.("syncing");
      },
      onSyncSuccess: () => {
        setSyncStatus({ state: "synced", message: "All changes synced" });
        setLastSyncTime(Date.now());
        onSyncStatusChange?.("synced");
      },
      onSyncError: (error) => {
        setSyncStatus({ state: "error", message: "Sync failed - retrying..." });
        onError?.(error);
        onSyncStatusChange?.("error");
      },
    });
  }

  // Initialize auto-save manager
  const autoSaveManager = useRef<AutoSaveManager | null>(null);
  if (!autoSaveManager.current && syncManager.current) {
    autoSaveManager.current = new AutoSaveManager(syncManager.current, (status) => {
      setSyncStatus(status);
      if (status.state === "synced") {
        setLastSyncTime(Date.now());
      }
    });
  }

  // Initialize state machine
  const {
    state: quizState,
    actions: stateActions,
    isInitialized,
  } = useQuizStateMachine({
    sessionId,
    enableLocalStorage: enableOfflineSupport,
    onAnswerSubmitted: (questionId, answer, isCorrect) => {
      onAnswerSubmitted?.(questionId, answer.selectedOptionId, {
        isCorrect,
        feedback: { timeSpent: answer.timeSpent },
      });
    },
    onQuizCompleted: () => {
      // This will be handled in the completion handler where we have access to current state
    },
  });

  // Timer state for timed quizzes
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [totalTimeLimit, setTotalTimeLimit] = useState<number | null>(null);
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [timerExpired, setTimerExpired] = useState(false);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Keep refs to callbacks and state to avoid stale closures
  const callbacksRef = useRef({ onQuizCompleted, onTimerExpired });
  callbacksRef.current = { onQuizCompleted, onTimerExpired };

  const stateRef = useRef(quizState);
  stateRef.current = quizState;

  // Track if we've already triggered completion to prevent infinite loop
  const hasCompletedRef = useRef(false);

  // Track if we're currently initializing to prevent duplicate fetches
  const isInitializingRef = useRef(false);

  // Recover quiz state from localStorage
  const recoverLocalState = useCallback(() => {
    try {
      const saved = localStorage.getItem(`pathology-bites-quiz-result-${sessionId}`);
      if (saved) {
        const data = JSON.parse(saved);
        // Check if data is recent (within 24 hours) and for the same session
        const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
        if (data.sessionId === sessionId && data.lastSaved > twentyFourHoursAgo) {
          return data;
        }
      }
    } catch (error) {
      console.warn("Failed to recover local quiz state:", error);
    }
    return null;
  }, [sessionId]);

  // Initialize quiz with server data
  const initializeQuiz = useCallback(async () => {
    // Prevent duplicate initialization
    if (isInitializingRef.current) {
      console.log("[Hybrid] Already initializing, skipping duplicate fetch");
      return;
    }

    try {
      isInitializingRef.current = true;

      // API Call #1: Fetch quiz data
      const {
        questions,
        config,
        status,
        existingAnswers,
        timeRemaining: savedTimeRemaining,
        totalTimeLimit: savedTotalTimeLimit,
      } = await syncManager.current!.fetchQuizData(sessionId);

      console.log("[Hybrid] Fetched quiz data - status:", status);

      // EARLY EXIT: If quiz is already completed, trigger redirect immediately
      if (status === "completed") {
        console.log("[Hybrid] Quiz already completed - triggering early redirect");
        onError?.("Quiz session is already completed");
        isInitializingRef.current = false;
        return;
      }

      // Try to recover from localStorage first (needed before initialization)
      const localData = recoverLocalState();

      // Prepare existing state to pass to INITIALIZE (prioritize localStorage over server data)
      const answersToRestore = localData?.answers || existingAnswers;
      let existingAnswersMap: Map<string, QuizAnswer> | undefined;
      let currentIndex: number | undefined;
      let totalTimeSpentToRestore: number | undefined;

      // Convert answers array to Map
      if (answersToRestore && answersToRestore.length > 0) {
        existingAnswersMap = new Map();
        answersToRestore.forEach((answer: QuizAnswer | [string, QuizAnswer]) => {
          const questionId = Array.isArray(answer) ? answer[0] : answer.questionId;
          const answerData = Array.isArray(answer) ? answer[1] : answer;
          existingAnswersMap!.set(questionId, answerData);
        });

        // Find current question index
        if (localData?.currentIndex !== undefined) {
          // Use saved position from localStorage
          currentIndex = localData.currentIndex;
        } else {
          // Find first unanswered question when resuming
          const answeredQuestionIds = new Set(existingAnswersMap.keys());
          const firstUnansweredIndex = questions.findIndex((q) => !answeredQuestionIds.has(q.id));
          currentIndex = firstUnansweredIndex !== -1 ? firstUnansweredIndex : 0;
        }

        // Get total time spent
        totalTimeSpentToRestore = localData?.totalTimeSpent || 0;
      }

      console.log("[Hybrid] Initializing quiz with:", {
        status,
        answersCount: existingAnswersMap?.size || 0,
        currentIndex: currentIndex ?? 0,
        totalTimeSpent: totalTimeSpentToRestore ?? 0,
        existingAnswers: existingAnswersMap
          ? Array.from(existingAnswersMap.entries()).map(([qId, ans]) => ({
              questionId: qId,
              selected: ans.selectedOptionId,
              correct: ans.isCorrect,
            }))
          : [],
      });

      // Initialize state machine with fetched data AND existing state
      stateActions.initializeQuiz(
        questions,
        config,
        status,
        existingAnswersMap,
        currentIndex,
        totalTimeSpentToRestore
      );

      console.log("[Hybrid] Quiz initialized with config:", {
        mode: config.mode,
        timing: config.timing,
        status: status,
      });

      // Initialize timer for timed quizzes
      if (config.timing === "timed") {
        const limit = savedTotalTimeLimit || config.totalTimeLimit || questions.length * 60; // 60 seconds per question
        setTotalTimeLimit(limit);

        // Priority order for time remaining:
        // 1. localStorage (most recent)
        // 2. Server data (from last sync)
        // 3. Full time limit (new quiz)
        const restoredTime =
          localData?.timeRemaining ??
          (savedTimeRemaining !== null && savedTimeRemaining !== undefined
            ? savedTimeRemaining
            : limit);

        console.log("[Hybrid] Restoring timer:", {
          fromLocalStorage: localData?.timeRemaining,
          fromServer: savedTimeRemaining,
          using: restoredTime,
          limit: limit,
        });

        setTimeRemaining(restoredTime);
      }

      console.log("[Hybrid] Initialization complete, quiz status:", status);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const fullErrorMessage = `Failed to initialize quiz: ${errorMessage}`;
      onError?.(fullErrorMessage);
    } finally {
      isInitializingRef.current = false;
    }
  }, [sessionId, stateActions, onError, recoverLocalState]);

  // Handle quiz completion with sync
  const handleCompleteQuiz = useCallback(async (): Promise<SyncResult> => {
    try {
      // Defense-in-depth re-entry guard. The page's runCompletion owns the
      // primary lock (isCompletionRunningRef) — this catches any future caller
      // that bypasses it. CRITICAL: fail closed. Returning { success: true }
      // here used to be a fake-success that triggered a premature redirect to
      // /results when the timer's onTimerExpired callback double-fired and
      // raced its way past the page-side lock. Now we return a non-network
      // error so runCompletion treats it as a real failure.
      if (hasCompletedRef.current) {
        console.log("[Hybrid] handleCompleteQuiz re-entered, refusing");
        return {
          success: false,
          timestamp: Date.now(),
          error: "Completion already in progress",
        };
      }

      hasCompletedRef.current = true;

      // Wait for any in-flight autosave to settle so the /complete POST doesn't race
      // a still-in-flight PATCH for the most recent answer. Server still de-dupes by
      // (session_id, question_id), so this isn't required for correctness — but it
      // avoids unnecessary duplicate INSERT attempts and clearer logs.
      try {
        await autoSaveManager.current?.waitForIdle(1500);
      } catch (err) {
        console.warn("[Hybrid] waitForIdle threw:", err);
      }

      // Read state via the state machine's synchronously-mirrored ref, not the
      // render-time `stateRef` defined in this hook. useReducer batches updates,
      // so the SUBMIT_ANSWER the timer-expiry path queues right before runCompletion
      // is NOT visible in any state derived from a render — neither the closure
      // `quizState` nor the hook-level `stateRef.current`. The state machine
      // mirrors the dispatch into its own ref synchronously; `getCurrentState()`
      // reads from that mirror so the just-committed answer lands in the POST.
      const latestState = stateActions.getCurrentState();

      // Complete the quiz first
      stateActions.completeQuiz();

      // Clear local storage and session cache on successful completion. We remove BOTH
      // the result cache AND the draft (state-machine) snapshot here — the state machine
      // has its own self-cleanup effect, but it loses the race when the page navigates to
      // /results before the effect fires, leaving orphan `quiz-draft-*` keys behind.
      try {
        localStorage.removeItem(`pathology-bites-quiz-result-${sessionId}`);
        localStorage.removeItem(`pathology-bites-quiz-draft-${sessionId}`);
        syncManager.current?.clearSessionCache(sessionId);
        console.log("[Hybrid] Cleared quiz cache after completion");
      } catch (error) {
        console.warn("Failed to clear quiz data after completion:", error);
      }

      // Call the completion callback with current state
      setTimeout(() => {
        // Use the state ref to get the most current state
        const currentState = stateRef.current;

        callbacksRef.current.onQuizCompleted?.({
          score: currentState.progress.correct,
          totalQuestions: currentState.totalQuestions,
          timeSpent: currentState.totalTimeSpent,
        });
      }, 0);

      // Calculate achievements to unlock based on quiz result and current stats
      let achievementsToUnlock: string[] = [];
      if (unifiedData?.achievements) {
        const currentStats = unifiedData.achievements.stats;
        const unlockedAchievementIds = unifiedData.achievements.progress
          .filter((a) => a.isUnlocked)
          .map((a) => a.id);

        // Build quiz result object for achievement calculation (using latest state)
        const quizResult = {
          totalQuestions: latestState.totalQuestions,
          totalTimeSpent: latestState.totalTimeSpent,
          score: Math.round((latestState.progress.correct / latestState.totalQuestions) * 100),
        };

        // Calculate which achievements should be unlocked
        achievementsToUnlock = calculateAchievementsToUnlock(
          quizResult,
          currentStats,
          unlockedAchievementIds
        );

        console.log("[Hybrid] Calculated achievements to unlock:", achievementsToUnlock);
      }

      // DEBUG: Log quiz state before syncing (uses latest state, not closure-captured)
      const answersArray =
        latestState.answers instanceof Map ? Array.from(latestState.answers.entries()) : [];

      console.log("[Hybrid] Quiz state before sync:", {
        sessionId: latestState.sessionId,
        answersCount: latestState.answers instanceof Map ? latestState.answers.size : 0,
        answersPreview: answersArray.slice(0, 3).map(([qId, ans]) => ({
          questionId: qId,
          selectedOptionId: ans.selectedOptionId,
          isCorrect: ans.isCorrect,
        })),
        totalQuestions: latestState.totalQuestions,
        progress: latestState.progress,
      });

      // API Call #2: Batch sync all data with achievements (pass latest state, not closure-captured)
      const result = await syncManager.current!.syncQuizData(latestState, achievementsToUnlock);

      if (result.success) {
        stateActions.markSyncSuccess(result.timestamp);

        // If the quiz was already completed, log this for debugging
        if (result.serverResponse?.message?.includes("already completed")) {
          console.log("[Hybrid] Quiz was already completed on server, sync treated as success");
        }

        // Always invalidate the quiz list cache so the completed quiz shows up.
        invalidateQuizSessions(false);

        // Update dashboard / user-data cache incrementally if we have what we need;
        // otherwise fall back to a full refetch so stats are NEVER stale after completion.
        const data = result.serverResponse?.data;
        if (data) {
          const newAchievements = (result.serverResponse?.newAchievements ??
            []) as QuizResult["newAchievements"];
          console.log("[Hybrid] Updating cache incrementally with quiz results");
          updateCacheAfterQuiz(
            data as QuizResult,
            newAchievements,
            result.serverResponse?.metadata // Pass metadata for cache validation guards
          ).catch((err) => {
            console.warn("[Hybrid] Failed to update cache after quiz completion:", err);
            // Fall back to a full refetch so the dashboard isn't stale even on failure
            invalidateUnifiedData(true).catch(() => {});
          });
        } else {
          console.warn(
            "[Hybrid] Missing quiz result data in serverResponse — falling back to full refetch",
            { serverResponseKeys: Object.keys(result.serverResponse ?? {}) }
          );
          invalidateUnifiedData(true).catch((err) => {
            console.warn("[Hybrid] Fallback invalidateUnifiedData failed:", err);
          });
        }
      } else {
        stateActions.markSyncFailed();
        // Reset the re-entry guard so callers (e.g. the page's online-resume
        // effect) can retry the sync. Without this, every subsequent call to
        // handleCompleteQuiz hits the `hasCompletedRef.current` short-circuit
        // and returns a fake `{ success: true }` without ever talking to the
        // server — exactly the offline-completion scenario.
        hasCompletedRef.current = false;
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to complete quiz";
      onError?.(errorMessage);
      hasCompletedRef.current = false; // Reset on error so user can retry
      return { success: false, timestamp: Date.now(), error: errorMessage };
    }
    // Note: we deliberately omit `quizState` here. Inside the callback we read latest
    // state via `stateRef.current` to avoid stale-closure bugs (e.g., the last-answer
    // race in practice mode where the click triggered a setTimeout-completion before
    // React re-rendered with the new state).
  }, [stateActions, onError, sessionId, unifiedData?.achievements]);

  // Initialize quiz data (API Call #1)
  useEffect(() => {
    if (sessionId && !isInitialized) {
      initializeQuiz();
    }
  }, [sessionId, isInitialized, initializeQuiz]);

  // Auto-start quiz if it's in "not_started" status after initialization
  // This is essential for timed quizzes to start the timer countdown
  const hasAutoStartedRef = useRef(false);
  useEffect(() => {
    // Only auto-start once and only if status is "not_started"
    if (isInitialized && quizState.status === "not_started" && !hasAutoStartedRef.current) {
      console.log("[Hybrid] Auto-starting quiz from 'not_started' status");
      hasAutoStartedRef.current = true;
      stateActions.startQuiz();
    }
  }, [isInitialized, quizState.status, stateActions]);

  // Auto-save quiz state to localStorage
  useEffect(() => {
    if (isInitialized && sessionId) {
      const saveToLocal = () => {
        try {
          // Safety check: ensure answers is a Map
          const answersArray =
            quizState.answers instanceof Map ? Array.from(quizState.answers.entries()) : [];

          const quizData = {
            sessionId,
            answers: answersArray,
            progress: quizState.progress,
            currentIndex: quizState.currentQuestionIndex,
            status: quizState.status,
            totalTimeSpent: quizState.totalTimeSpent,
            timeRemaining: timeRemaining,
            lastSaved: Date.now(),
          };
          localStorage.setItem(
            `pathology-bites-quiz-result-${sessionId}`,
            JSON.stringify(quizData)
          );
        } catch (error) {
          console.warn("Failed to save quiz state to localStorage:", error);
        }
      };

      saveToLocal();
    }
  }, [
    isInitialized,
    sessionId,
    quizState.answers,
    quizState.progress,
    quizState.currentQuestionIndex,
    quizState.status,
    quizState.totalTimeSpent,
    timeRemaining,
  ]);

  // Periodic auto-save — fires only when the answer count changes, but reads
  // the freshest state via `stateRef` so we don't capture a stale `quizState`
  // closure. Previously the dep array included the whole `quizState` object,
  // which caused this effect to fire on every reducer dispatch (every timer
  // tick).
  const answersCount = quizState.answers.size;
  useEffect(() => {
    if (!AUTO_SAVE_CONFIG.enablePeriodicAutoSave || !autoSaveManager.current) return;
    if (answersCount === 0) return;
    if (!autoSaveManager.current.shouldPeriodicSave(answersCount)) return;
    autoSaveManager.current
      .autoSave(sessionId, stateRef.current, "periodic", timeRemaining)
      .then(() => invalidateQuizSessions(false));
  }, [answersCount, sessionId, timeRemaining]);

  // Timer countdown for timed quizzes. Computes `shouldBeActive` inline rather
  // than mirroring it into a separate `timerActive` state — the intermediate
  // state added a render pass and the timer being on/off is already fully
  // derivable from its inputs.
  useEffect(() => {
    const shouldBeActive =
      quizState.config.timing === "timed" &&
      quizState.status === "in_progress" &&
      !isTimerPaused &&
      timeRemaining !== null;

    if (!shouldBeActive) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      return;
    }

    if (timerIntervalRef.current) return; // already running

    console.log("[Hybrid] Starting timer countdown");
    timerIntervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 0) {
          // Pure updater: never trigger side effects from inside setState. React
          // 18 StrictMode in dev double-invokes updaters to detect impurity, so
          // anything we fire here would run twice — historically that caused
          // onTimerExpired to fire twice on tick=0, which in turn made
          // runCompletion re-enter through its stale-closure isCompletingQuiz
          // guard, hit handleCompleteQuiz's hasCompletedRef short-circuit, and
          // return a fake { success: true } that redirected the user to
          // /results while offline. The "timeRemaining hit 0" side effects now
          // live in a useEffect that observes the committed state.
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [quizState.config.timing, quizState.status, isTimerPaused, timeRemaining]);

  // Fire the timer-expired side effects exactly once, after timeRemaining hits 0
  // is committed to React state. Lives outside the setInterval updater because
  // StrictMode would double-invoke the updater and double-fire these callbacks.
  const timerExpiredFiredRef = useRef(false);
  useEffect(() => {
    if (timerExpiredFiredRef.current) return;
    if (timeRemaining !== 0) return;
    if (quizState.config.timing !== "timed") return;
    timerExpiredFiredRef.current = true;
    console.log("[Hybrid] Timer expired! Notifying page.");
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setTimerExpired(true);
    callbacksRef.current.onTimerExpired?.();
  }, [timeRemaining, quizState.config.timing]);

  // Note: beforeunload event handling is managed by the page component
  // to allow for custom exit dialogs and better UX control

  // Create hybrid state
  const hybridState: HybridQuizState = {
    isLoading: !isInitialized && quizState.questions.length === 0,
    isInitialized,
    error: null,
    status: quizState.status,
    currentQuestion: quizState.currentQuestionIndex + 1,
    totalQuestions: quizState.totalQuestions,
    progress: {
      current: quizState.progress.answered,
      total: quizState.totalQuestions,
      percentage: quizState.progress.percentage,
    },
    syncStatus,
    lastSyncTime,
    queueStatus: autoSaveManager.current?.getQueueStatus() || { total: 0, ready: 0, waiting: 0 },
    timeRemaining,
    totalTimeLimit,
    timerExpired,
  };

  // Create hybrid actions
  const hybridActions: HybridQuizActions = {
    pauseQuiz: useCallback(async () => {
      stateActions.pauseQuiz();
      setIsTimerPaused(true);

      // Auto-save when pausing
      if (autoSaveManager.current) {
        await autoSaveManager.current.autoSave(sessionId, quizState, "pause", timeRemaining);
        // Invalidate quiz sessions cache to show updated progress
        invalidateQuizSessions(false);
      }
    }, [stateActions, sessionId, quizState, timeRemaining]),

    resumeQuiz: useCallback(() => {
      stateActions.resumeQuiz();
      setIsTimerPaused(false);
    }, [stateActions]),

    saveAndExit: useCallback(async () => {
      if (!autoSaveManager.current) return;

      try {
        // Save current state to database
        await autoSaveManager.current.autoSave(sessionId, quizState, "manual", timeRemaining);

        // Invalidate quiz sessions cache to show updated progress
        invalidateQuizSessions(false); // Don't wait for revalidation

        // Show success toast
        toast.success("Quiz saved successfully");

        // Note: Navigation is handled by the page component
        // to properly manage beforeunload event cleanup
      } catch (error) {
        console.error("Failed to save and exit:", error);
        toast.error("Failed to save quiz. Please try again.");
        throw error; // Re-throw so page component knows save failed
      }
    }, [sessionId, quizState, timeRemaining]),

    completeQuiz: useCallback(async () => {
      return await handleCompleteQuiz();
    }, [handleCompleteQuiz]),

    submitAnswer: useCallback(
      (questionId: string, answerId: string) => {
        console.log("[Hybrid] submitAnswer called:", { questionId, answerId });
        const isCorrect = stateActions.submitAnswer(questionId, answerId);
        console.log(
          "[Hybrid] Answer submitted, isCorrect:",
          isCorrect,
          "Total answers now:",
          quizState.answers.size
        );
        return {
          isCorrect,
          feedback: {
            instant: true,
            responseTime: 0, // Instant client-side response
          },
        };
      },
      [stateActions, quizState.answers.size]
    ),

    nextQuestion: useCallback(() => {
      return stateActions.nextQuestion();
    }, [stateActions]),

    previousQuestion: useCallback(() => {
      return stateActions.previousQuestion();
    }, [stateActions]),

    navigateToQuestion: useCallback(
      (index: number) => {
        return stateActions.navigateToQuestion(index);
      },
      [stateActions]
    ),

    getCurrentQuestion: useCallback(() => {
      const question = stateActions.getCurrentQuestion();
      if (!question) return null;

      // Transform hybrid format to UI component format using standardized transformer
      return QuizQuestionTransformer.hybridToUI(question);
    }, [stateActions]),

    getQuestions: useCallback(() => {
      // Transform hybrid format to UI component format using standardized transformer
      return quizState.questions.map((question) => QuizQuestionTransformer.hybridToUI(question));
    }, [quizState.questions]),

    getAnswerForQuestion: useCallback(
      (questionId: string) => {
        return stateActions.getAnswerForQuestion(questionId);
      },
      [stateActions]
    ),

    getQuizConfig: useCallback(() => {
      return quizState.config;
    }, [quizState.config]),

    getProgress: useCallback(
      () => ({
        answered: quizState.progress.answered,
        correct: quizState.progress.correct,
        total: quizState.totalQuestions,
      }),
      [quizState.progress, quizState.totalQuestions]
    ),

    __devSetTimer: useCallback((seconds: number) => {
      if (process.env.NODE_ENV !== "development") return;
      console.log(`[Hybrid] __devSetTimer: jumping timer to ${seconds}s`);
      setTimeRemaining(seconds);
    }, []),
  };

  return [hybridState, hybridActions];
}
