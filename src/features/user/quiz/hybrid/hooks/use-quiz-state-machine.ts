/**
 * React Hook for Pure Serverless Hybrid Quiz State Machine
 *
 * This hook provides a React interface to the core quiz state machine,
 * enabling instant UI updates and client-side quiz management.
 */

import { useReducer, useCallback, useEffect, useRef } from "react";
import {
  quizStateReducer,
  createInitialQuizState,
  QuizStateUtils,
  QuizAction,
} from "../core/quiz-state-machine";
import { QuizState, QuizQuestion, QuizAnswer } from "../../types/quiz-question";

export interface UseQuizStateMachineOptions {
  sessionId: string;
  onAnswerSubmitted?: (questionId: string, answer: QuizAnswer, isCorrect: boolean) => void;
  onQuizCompleted?: (finalState: QuizState) => void;
  onStateChange?: (state: QuizState) => void;
  enableLocalStorage?: boolean;
  localStorageKey?: string;
}

export interface QuizStateMachineActions {
  // Quiz Control
  initializeQuiz: (
    questions: QuizQuestion[],
    config?: Partial<QuizState["config"]>,
    status?: string,
    existingAnswers?: Map<string, QuizAnswer>,
    currentQuestionIndex?: number,
    totalTimeSpent?: number
  ) => void;
  startQuiz: () => void;
  pauseQuiz: () => void;
  resumeQuiz: () => void;
  completeQuiz: () => void;

  // Answer Management
  submitAnswer: (questionId: string, selectedOptionId: string) => boolean;

  // Navigation
  navigateToQuestion: (index: number) => boolean;
  nextQuestion: () => boolean;
  previousQuestion: () => boolean;

  // Utilities
  getCurrentQuestion: () => QuizQuestion | null;
  getAnswerForQuestion: (questionId: string) => QuizAnswer | null;
  isQuestionAnswered: (questionId: string) => boolean;
  /**
   * Returns the post-dispatch state synchronously. useReducer batches updates,
   * so reading the rendered `state` (or a ref set on render) right after a
   * dispatch still sees the pre-dispatch value. The state machine mirrors
   * mutating dispatches into a ref synchronously; this getter exposes that ref.
   * Use it whenever you need "the state including the answer I just submitted".
   */
  getCurrentState: () => QuizState;

  // Sync Management
  markSyncSuccess: (timestamp?: number) => void;
  markSyncFailed: () => void;
  setOnlineStatus: (isOnline: boolean) => void;
}

export function useQuizStateMachine(options: UseQuizStateMachineOptions) {
  const {
    sessionId,
    onAnswerSubmitted,
    onQuizCompleted,
    onStateChange,
    enableLocalStorage = true,
    localStorageKey = `pathology-bites-quiz-draft-${sessionId}`,
  } = options;

  // Initialize state from localStorage if available
  const getInitialState = useCallback((): QuizState => {
    if (enableLocalStorage && typeof window !== "undefined" && sessionId) {
      try {
        const saved = localStorage.getItem(localStorageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          // Convert answers Map from JSON
          parsed.answers = new Map(parsed.answers || []);
          return parsed;
        }
      } catch (error) {
        console.warn("Failed to load quiz state from localStorage:", error);
      }
    }
    return createInitialQuizState();
  }, [enableLocalStorage, localStorageKey, sessionId]);

  const [state, dispatch] = useReducer(quizStateReducer, null, getInitialState);

  // Track timing for current question
  const questionStartTime = useRef<number>(Date.now());
  const previousQuestionIndex = useRef<number>(state.currentQuestionIndex);

  // Keep a ref to the current state for navigation functions
  const stateRef = useRef(state);
  stateRef.current = state;

  // Dispatches that mutate `answers` (or any state field a caller might read
  // synchronously after the call) are mirrored into stateRef by running the
  // pure reducer right here. useReducer batches updates; without this mirror,
  // code that reads stateRef.current immediately after `dispatch` (e.g. the
  // timer-expiry path in use-hybrid-quiz handleCompleteQuiz) sees the
  // pre-dispatch state. On next render, line 96 overwrites stateRef with the
  // real reducer output — which by then matches what we mirrored.
  //
  // FUTURE — proper fix when there's a reason to revisit:
  // Replace the `useReducer` + ref-mirror combo with an external store read
  // via `useSyncExternalStore`. A plain JS module/class holds the state,
  // exposes `getState() / subscribe(listener) / dispatch(action)`, with
  // dispatch running the pure reducer synchronously and notifying subscribers.
  // Components read via `useSyncExternalStore(store.subscribe, store.getState)`.
  // The mirror, `getCurrentState()` action, and the `stateRef = useRef(state);
  // stateRef.current = state;` lines in both this file and use-hybrid-quiz all
  // become unnecessary because reads are already synchronous against the store.
  // Estimated ~half-day of work plus careful testing — the quiz hook has a
  // lot of subtle behavior layered on top of the current state-management
  // pattern (re-entry guards, autosave race fixes, StrictMode double-init
  // handling) that must be preserved across the rewrite. Don't do it without
  // an independent trigger (perf issue, second similar bug, etc.); the mirror
  // is ugly but localized.
  const dispatchAndMirror = useCallback((action: QuizAction) => {
    dispatch(action);
    stateRef.current = quizStateReducer(stateRef.current, action);
  }, []);

  // Save to localStorage on state changes
  useEffect(() => {
    if (enableLocalStorage && typeof window !== "undefined") {
      // Skip persistence when there's no real session id — prevents the orphan
      // "pathology-bites-quiz-state-" (empty suffix) key from accumulating.
      if (!sessionId) return;
      try {
        // Don't save to localStorage if quiz is completed (will be cleared anyway)
        if (state.status === "completed") {
          console.log("[State Machine] Quiz completed - clearing localStorage instead of saving");
          localStorage.removeItem(localStorageKey);
          return;
        }

        // Guard: in rare edge cases (legacy localStorage rehydration, race during init)
        // `state.answers` may briefly be an array rather than a Map. Coerce defensively
        // so JSON.stringify doesn't throw and lose the entire save.
        const answersEntries =
          state.answers instanceof Map
            ? Array.from(state.answers.entries())
            : Array.isArray(state.answers)
              ? state.answers
              : [];
        const stateToSave = {
          ...state,
          // Convert Map to array for JSON serialization
          answers: answersEntries,
          // Timestamp so TTL cleanup (storage-cleanup.ts) can age this out as a backstop
          // if the explicit removal on completion didn't run.
          lastSaved: Date.now(),
        };
        localStorage.setItem(localStorageKey, JSON.stringify(stateToSave));
      } catch (error) {
        console.warn("Failed to save quiz state to localStorage:", error);
      }
    }
  }, [state, enableLocalStorage, localStorageKey, sessionId]);

  // Call onStateChange callback
  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  // Track question timing
  useEffect(() => {
    if (state.currentQuestionIndex !== previousQuestionIndex.current) {
      questionStartTime.current = Date.now();
      previousQuestionIndex.current = state.currentQuestionIndex;
    }
  }, [state.currentQuestionIndex]);

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => dispatch({ type: "SET_ONLINE_STATUS", payload: { isOnline: true } });
    const handleOffline = () =>
      dispatch({ type: "SET_ONLINE_STATUS", payload: { isOnline: false } });

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Actions object
  const actions: QuizStateMachineActions = {
    initializeQuiz: useCallback(
      (
        questions: QuizQuestion[],
        config?: Partial<QuizState["config"]>,
        status?: string,
        existingAnswers?: Map<string, QuizAnswer>,
        currentQuestionIndex?: number,
        totalTimeSpent?: number
      ) => {
        const fullConfig = {
          mode: "tutor" as const,
          timing: "untimed" as const,
          showExplanations: true,
          allowReview: true,
          ...config,
        };

        dispatch({
          type: "INITIALIZE",
          payload: {
            sessionId,
            questions,
            config: fullConfig,
            status,
            existingAnswers,
            currentQuestionIndex,
            totalTimeSpent,
          },
        });
      },
      [sessionId]
    ),

    startQuiz: useCallback(() => {
      dispatch({ type: "START_QUIZ" });
      questionStartTime.current = Date.now();
    }, []),

    pauseQuiz: useCallback(() => {
      dispatch({ type: "PAUSE_QUIZ" });
    }, []),

    resumeQuiz: useCallback(() => {
      dispatch({ type: "RESUME_QUIZ" });
      questionStartTime.current = Date.now();
    }, []),

    completeQuiz: useCallback(() => {
      dispatch({ type: "COMPLETE_QUIZ" });
      onQuizCompleted?.(state);
    }, [state, onQuizCompleted]),

    submitAnswer: useCallback(
      (questionId: string, selectedOptionId: string): boolean => {
        const timeSpentMs = Date.now() - questionStartTime.current;
        const timeSpent = Math.round(timeSpentMs / 1000); // Convert milliseconds to seconds

        // dispatchAndMirror, not dispatch — the timer-expiry path dispatches a
        // pending SUBMIT_ANSWER, then runs `runCompletion` which reads stateRef
        // before the next React render. Plain dispatch leaves stateRef stale
        // and drops the just-committed answer from the /complete POST.
        dispatchAndMirror({
          type: "SUBMIT_ANSWER",
          payload: {
            questionId,
            selectedOptionId,
            timeSpent,
          },
        });

        // Get the answer result for callback. Read from stateRef (which we
        // just mirrored to) rather than the closure-captured `state`, since
        // questions live on initial state and that won't differ here, but
        // staying consistent with the post-dispatch view keeps the logic
        // predictable as more state moves through this path.
        const question = stateRef.current.questions.find((q) => q.id === questionId);
        if (question && question.question_options) {
          const selectedOption = question.question_options.find(
            (opt) => opt.id === selectedOptionId
          );
          const isCorrect = selectedOption?.is_correct ?? false;

          const answer: QuizAnswer = {
            questionId,
            selectedOptionId,
            isCorrect,
            timestamp: Date.now(),
            timeSpent,
          };

          onAnswerSubmitted?.(questionId, answer, isCorrect);
          return isCorrect;
        }

        return false;
      },
      [dispatchAndMirror, onAnswerSubmitted]
    ),

    navigateToQuestion: useCallback(
      (index: number): boolean => {
        if (index >= 0 && index < state.totalQuestions) {
          dispatch({ type: "NAVIGATE_TO_QUESTION", payload: { index } });
          return true;
        }
        return false;
      },
      [state.totalQuestions]
    ),

    nextQuestion: useCallback((): boolean => {
      // Use ref to get the most current state to avoid stale closures
      const currentState = stateRef.current;
      if (QuizStateUtils.canNavigateNext(currentState)) {
        dispatch({
          type: "NAVIGATE_TO_QUESTION",
          payload: { index: currentState.currentQuestionIndex + 1 },
        });
        return true;
      }
      return false;
    }, []),

    previousQuestion: useCallback((): boolean => {
      // Use ref to get the most current state to avoid stale closures
      const currentState = stateRef.current;
      if (QuizStateUtils.canNavigatePrevious(currentState)) {
        dispatch({
          type: "NAVIGATE_TO_QUESTION",
          payload: { index: currentState.currentQuestionIndex - 1 },
        });
        return true;
      }
      return false;
    }, []),

    getCurrentQuestion: useCallback((): QuizQuestion | null => {
      return QuizStateUtils.getCurrentQuestion(state);
    }, [state]),

    getAnswerForQuestion: useCallback(
      (questionId: string): QuizAnswer | null => {
        return QuizStateUtils.getAnswerForQuestion(state, questionId);
      },
      [state]
    ),

    isQuestionAnswered: useCallback(
      (questionId: string): boolean => {
        return QuizStateUtils.isQuestionAnswered(state, questionId);
      },
      [state]
    ),

    getCurrentState: useCallback((): QuizState => stateRef.current, []),

    markSyncSuccess: useCallback((timestamp?: number) => {
      dispatch({ type: "SYNC_SUCCESS", payload: { timestamp: timestamp || Date.now() } });
    }, []),

    markSyncFailed: useCallback(() => {
      dispatch({ type: "SYNC_FAILED" });
    }, []),

    setOnlineStatus: useCallback((isOnline: boolean) => {
      dispatch({ type: "SET_ONLINE_STATUS", payload: { isOnline } });
    }, []),
  };

  return {
    state,
    actions,
    // Computed properties for convenience
    currentQuestion: QuizStateUtils.getCurrentQuestion(state),
    canNavigateNext: QuizStateUtils.canNavigateNext(state),
    canNavigatePrevious: QuizStateUtils.canNavigatePrevious(state),
    needsSync: QuizStateUtils.needsSync(state),
    isInitialized: state.questions.length > 0,
    isActive: state.status === "in_progress",
    isCompleted: state.status === "completed",
  };
}
