/**
 * React Hook for Pure Serverless Hybrid Quiz State Machine
 * 
 * This hook provides a React interface to the core quiz state machine,
 * enabling instant UI updates and client-side quiz management.
 */

import { useReducer, useCallback, useEffect, useRef } from 'react';
import {
  quizStateReducer,
  createInitialQuizState,
  QuizStateUtils,
  QuizAction
} from '../core/quiz-state-machine';
import { QuizState, QuizQuestion, QuizAnswer } from '../../types/quiz-question';

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
  initializeQuiz: (questions: QuizQuestion[], config?: Partial<QuizState['config']>) => void;
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
    localStorageKey = `quiz-state-${sessionId}`
  } = options;

  // Initialize state from localStorage if available
  const getInitialState = useCallback((): QuizState => {
    if (enableLocalStorage && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(localStorageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          // Convert answers Map from JSON
          parsed.answers = new Map(parsed.answers || []);
          return parsed;
        }
      } catch (error) {
        console.warn('Failed to load quiz state from localStorage:', error);
      }
    }
    return createInitialQuizState();
  }, [enableLocalStorage, localStorageKey]);

  const [state, dispatch] = useReducer(quizStateReducer, null, getInitialState);

  // Track timing for current question
  const questionStartTime = useRef<number>(Date.now());
  const previousQuestionIndex = useRef<number>(state.currentQuestionIndex);

  // Keep a ref to the current state for navigation functions
  const stateRef = useRef(state);
  stateRef.current = state;

  // Save to localStorage on state changes
  useEffect(() => {
    if (enableLocalStorage && typeof window !== 'undefined') {
      try {
        const stateToSave = {
          ...state,
          // Convert Map to array for JSON serialization
          answers: Array.from(state.answers.entries())
        };
        localStorage.setItem(localStorageKey, JSON.stringify(stateToSave));
      } catch (error) {
        console.warn('Failed to save quiz state to localStorage:', error);
      }
    }
  }, [state, enableLocalStorage, localStorageKey]);

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
    const handleOnline = () => dispatch({ type: 'SET_ONLINE_STATUS', payload: { isOnline: true } });
    const handleOffline = () => dispatch({ type: 'SET_ONLINE_STATUS', payload: { isOnline: false } });

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Actions object
  const actions: QuizStateMachineActions = {
    initializeQuiz: useCallback((questions: QuizQuestion[], config?: Partial<QuizState['config']>) => {
      const fullConfig = {
        mode: 'tutor' as const,
        timing: 'untimed' as const,
        showExplanations: true,
        allowReview: true,
        ...config
      };
      
      dispatch({
        type: 'INITIALIZE',
        payload: {
          sessionId,
          questions,
          config: fullConfig
        }
      });
    }, [sessionId]),

    startQuiz: useCallback(() => {
      dispatch({ type: 'START_QUIZ' });
      questionStartTime.current = Date.now();
    }, []),

    pauseQuiz: useCallback(() => {
      dispatch({ type: 'PAUSE_QUIZ' });
    }, []),

    resumeQuiz: useCallback(() => {
      dispatch({ type: 'RESUME_QUIZ' });
      questionStartTime.current = Date.now();
    }, []),

    completeQuiz: useCallback(() => {
      dispatch({ type: 'COMPLETE_QUIZ' });
      onQuizCompleted?.(state);
    }, [state, onQuizCompleted]),

    submitAnswer: useCallback((questionId: string, selectedOptionId: string): boolean => {
      const timeSpentMs = Date.now() - questionStartTime.current;
      const timeSpent = Math.round(timeSpentMs / 1000); // Convert milliseconds to seconds

      dispatch({
        type: 'SUBMIT_ANSWER',
        payload: {
          questionId,
          selectedOptionId,
          timeSpent
        }
      });

      // Get the answer result for callback
      const question = state.questions.find(q => q.id === questionId);
      if (question) {
        const selectedOption = question.options.find(opt => opt.id === selectedOptionId);
        const isCorrect = selectedOption?.is_correct ?? false;
        
        const answer: QuizAnswer = {
          questionId,
          selectedOptionId,
          isCorrect,
          timestamp: Date.now(),
          timeSpent
        };
        
        onAnswerSubmitted?.(questionId, answer, isCorrect);
        return isCorrect;
      }
      
      return false;
    }, [state.questions, onAnswerSubmitted]),

    navigateToQuestion: useCallback((index: number): boolean => {
      if (index >= 0 && index < state.totalQuestions) {
        dispatch({ type: 'NAVIGATE_TO_QUESTION', payload: { index } });
        return true;
      }
      return false;
    }, [state.totalQuestions]),

    nextQuestion: useCallback((): boolean => {
      // Use ref to get the most current state to avoid stale closures
      const currentState = stateRef.current;
      if (QuizStateUtils.canNavigateNext(currentState)) {
        dispatch({ type: 'NAVIGATE_TO_QUESTION', payload: { index: currentState.currentQuestionIndex + 1 } });
        return true;
      }
      return false;
    }, []),

    previousQuestion: useCallback((): boolean => {
      // Use ref to get the most current state to avoid stale closures
      const currentState = stateRef.current;
      if (QuizStateUtils.canNavigatePrevious(currentState)) {
        dispatch({ type: 'NAVIGATE_TO_QUESTION', payload: { index: currentState.currentQuestionIndex - 1 } });
        return true;
      }
      return false;
    }, []),

    getCurrentQuestion: useCallback((): QuizQuestion | null => {
      return QuizStateUtils.getCurrentQuestion(state);
    }, [state]),

    getAnswerForQuestion: useCallback((questionId: string): QuizAnswer | null => {
      return QuizStateUtils.getAnswerForQuestion(state, questionId);
    }, [state]),

    isQuestionAnswered: useCallback((questionId: string): boolean => {
      return QuizStateUtils.isQuestionAnswered(state, questionId);
    }, [state]),

    markSyncSuccess: useCallback((timestamp?: number) => {
      dispatch({ type: 'SYNC_SUCCESS', payload: { timestamp: timestamp || Date.now() } });
    }, []),

    markSyncFailed: useCallback(() => {
      dispatch({ type: 'SYNC_FAILED' });
    }, []),

    setOnlineStatus: useCallback((isOnline: boolean) => {
      dispatch({ type: 'SET_ONLINE_STATUS', payload: { isOnline } });
    }, [])
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
    isActive: state.status === 'in_progress',
    isCompleted: state.status === 'completed'
  };
}
