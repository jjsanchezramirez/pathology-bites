/**
 * Pure Serverless Hybrid Quiz System - Database Sync Manager
 *
 * This component handles the batched synchronization with the server,
 * achieving the 96.7% API call reduction by batching all operations
 * into just 2 API calls per quiz session.
 *
 * API Call #1: Initial quiz data fetch
 * API Call #2: Final batch submission of all answers and completion data
 */

import {
  QuizState,
  QuizAnswer,
  QuizQuestion,
  QuizQuestionTransformer,
  ApiQuestionResponse,
} from "../../types/quiz-question";

export interface QuizSyncData {
  sessionId: string;
  answers: Array<{
    questionId: string;
    selectedOptionId: string;
    isCorrect: boolean;
    timestamp: number;
    timeSpent: number;
  }>;
  progress: {
    answered: number;
    correct: number;
    incorrect: number;
    percentage: number;
  };
  timing: {
    startTime?: number;
    endTime?: number;
    totalTimeSpent: number;
  };
  status: QuizState["status"];
  metadata?: Record<string, unknown>;
  achievementIds?: string[]; // Client-calculated achievement IDs to unlock
}

export interface QuizProgressData {
  sessionId: string;
  currentQuestionIndex: number;
  timeRemaining?: number | null;
  totalTimeSpent: number;
  answers: Array<{
    questionId: string;
    selectedOptionId: string;
    isCorrect: boolean;
    timestamp: number;
    timeSpent: number;
  }>;
}

export interface SyncResult {
  success: boolean;
  timestamp: number;
  error?: string;
  serverResponse?: {
    message?: string;
    data?: unknown;
    newAchievements?: unknown[];
    metadata?: {
      totalQuizzes: number;
      lastQuizTimestamp: string;
    };
    [key: string]: unknown;
  };
}

export interface DatabaseSyncManagerOptions {
  apiBaseUrl?: string;
  csrfTokenGetter?: () => Promise<string>;
  onSyncStart?: () => void;
  onSyncSuccess?: (result: SyncResult) => void;
  onSyncError?: (error: string) => void;
}

/**
 * Manages batched synchronization with the server
 * Optimized for minimal API calls and maximum efficiency
 */
export class DatabaseSyncManager {
  private options: Required<DatabaseSyncManagerOptions>;
  private isSyncing = false;

  constructor(options: DatabaseSyncManagerOptions = {}) {
    this.options = {
      apiBaseUrl: "/api/user/quiz",
      csrfTokenGetter: async () => "", // Default no-op, should be provided by caller
      onSyncStart: () => {},
      onSyncSuccess: () => {},
      onSyncError: () => {},
      ...options,
    };
  }

  /**
   * API Call #1: Fetch initial quiz data
   * This is the only "read" operation in the hybrid system
   *
   * OPTIMIZED: Uses localStorage cache to eliminate API calls for:
   * - Quiz resumption (paused quizzes)
   * - Page refreshes during active quiz
   * - Review mode (uses cached quiz data + results)
   */
  async fetchQuizData(sessionId: string): Promise<{
    questions: QuizQuestion[];
    config: {
      mode: "tutor" | "practice";
      timing: "timed" | "untimed";
      showExplanations: boolean;
      allowReview: boolean;
      totalTimeLimit?: number;
      [key: string]: unknown;
    };
    status?: string;
    existingAnswers?: QuizAnswer[];
    timeRemaining?: number | null;
    totalTimeLimit?: number | null;
  }> {
    try {
      // OPTIMIZATION: Check localStorage cache first
      const cacheKey = `pathology-bites-quiz-result-${sessionId}`;
      const cachedData = this.getFromCache(cacheKey);

      if (cachedData) {
        console.log("[Hybrid] Using cached quiz session data - 0 API calls");
        return cachedData as {
          questions: QuizQuestion[];
          config: {
            mode: "tutor" | "practice";
            timing: "timed" | "untimed";
            showExplanations: boolean;
            allowReview: boolean;
            totalTimeLimit?: number;
            [key: string]: unknown;
          };
          status?: string;
          existingAnswers?: QuizAnswer[];
          timeRemaining?: number | null;
          totalTimeLimit?: number | null;
        };
      }

      console.log("[Hybrid] No cache found, fetching from server");
      const response = await fetch(`${this.options.apiBaseUrl}/sessions/${sessionId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Include cookies for authentication
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch quiz data: ${response.statusText}`);
      }

      const response_data = await response.json();

      // Handle API response format: { success: true, data: quizSession }
      const data = response_data.data || response_data;

      // Transform QuestionWithDetails[] to QuizQuestion[] format using standardized transformer
      const transformedQuestions = (data.questions || []).map((q: unknown) =>
        QuizQuestionTransformer.apiToHybrid(q as ApiQuestionResponse)
      );

      // Transform config to hybrid system format
      const transformedConfig = {
        mode: (data.config?.mode as "tutor" | "practice") || "tutor",
        timing: (data.config?.timing as "timed" | "untimed") || "untimed",
        showExplanations: data.config?.showExplanations ?? true,
        allowReview: data.config?.allowReview ?? true,
        ...data.config,
      };

      // Enhanced logging to debug quiz continuation issue
      console.log("[Hybrid] Server response data.answers:", data.answers);
      console.log("[Hybrid] Server response data.status:", data.status);
      console.log("[Hybrid] Server response data.currentQuestionIndex:", data.currentQuestionIndex);

      const result = {
        questions: transformedQuestions,
        config: transformedConfig,
        status: data.status,
        existingAnswers: data.answers || [],
        timeRemaining: data.timeRemaining ?? null,
        totalTimeLimit: data.totalTimeLimit ?? null,
      };

      // OPTIMIZATION: Cache the result for future use
      this.saveToCache(cacheKey, result);

      return result;
    } catch (error) {
      console.error("Failed to fetch quiz data:", error);
      throw error;
    }
  }

  /**
   * Get data from localStorage cache
   * Works with with CacheEntry format from cache-service.ts
   */
  private getFromCache(key: string): unknown | null {
    try {
      if (typeof window === "undefined") return null;

      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const parsed = JSON.parse(cached);

      // Check if cache is still valid using TTL from entry
      const ttl = parsed.ttl || 30 * 24 * 60 * 60 * 1000; // Default 30 days if not set
      const now = Date.now();
      if (parsed.timestamp && now - parsed.timestamp < ttl) {
        return parsed.data;
      }

      // Cache expired, remove it
      localStorage.removeItem(key);
      return null;
    } catch (error) {
      console.warn("Failed to read from cache:", error);
      return null;
    }
  }

  /**
   * Save data to localStorage cache
   * Uses CacheEntry format that works with cache-service.ts
   * Default 30-day TTL for quiz sessions (needed for review, ~10-20KB per quiz)
   */
  private saveToCache(key: string, data: unknown, ttl: number = 30 * 24 * 60 * 60 * 1000): void {
    try {
      if (typeof window === "undefined") return;

      const cacheData = {
        data,
        timestamp: Date.now(),
        ttl, // Default 24 hours
        key,
      };

      localStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.warn("Failed to save to cache:", error);
    }
  }

  /**
   * Clear quiz session cache (call after deletion)
   */
  clearSessionCache(sessionId: string): void {
    try {
      if (typeof window === "undefined") return;
      localStorage.removeItem(`pathology-bites-quiz-result-${sessionId}`);
    } catch (error) {
      console.warn("Failed to clear cache:", error);
    }
  }

  /**
   * API Call #2: Batch submit all quiz data
   * This is the only "write" operation in the hybrid system
   */
  async syncQuizData(quizState: QuizState, achievementIds?: string[]): Promise<SyncResult> {
    if (this.isSyncing) {
      return { success: false, timestamp: Date.now(), error: "Sync already in progress" };
    }

    this.isSyncing = true;
    this.options.onSyncStart();

    try {
      const syncData = this.prepareSyncData(quizState);
      // Add achievement IDs to sync data if provided
      if (achievementIds) {
        syncData.achievementIds = achievementIds;
      }
      const result = await this.performSync(syncData);

      if (result.success) {
        this.options.onSyncSuccess(result);
      } else {
        this.options.onSyncError(result.error || "Unknown sync error");
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.options.onSyncError(errorMessage);
      return { success: false, timestamp: Date.now(), error: errorMessage };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Save quiz progress without completing (for pause, navigation, periodic saves)
   */
  async saveProgress(quizState: QuizState, timeRemaining?: number | null): Promise<SyncResult> {
    try {
      this.options.onSyncStart();

      // Guard: defensively handle the case where `answers` is briefly an array (e.g. raw
      // legacy localStorage rehydration before the state machine coerces it to a Map).
      const answersEntries: Array<[string, QuizAnswer]> =
        quizState.answers instanceof Map
          ? Array.from(quizState.answers.entries())
          : Array.isArray(quizState.answers)
            ? (quizState.answers as Array<[string, QuizAnswer]>)
            : [];
      const progressData: QuizProgressData = {
        sessionId: quizState.sessionId,
        currentQuestionIndex: quizState.currentQuestionIndex,
        timeRemaining,
        totalTimeSpent: quizState.totalTimeSpent,
        answers: answersEntries.map(([questionId, answer]) => ({
          questionId,
          selectedOptionId: answer.selectedOptionId,
          isCorrect: answer.isCorrect,
          timestamp: answer.timestamp,
          timeSpent: answer.timeSpent,
        })),
      };

      // Get CSRF token
      const csrfToken = await this.options.csrfTokenGetter();

      // OPTIMIZATION: Single API call - PATCH endpoint now accepts answers!
      // This combines what used to be 2 calls (batch + PATCH) into 1
      console.log("[Hybrid] Saving progress with single API call (answers + progress)");

      const updateResponse = await fetch(
        `${this.options.apiBaseUrl}/sessions/${progressData.sessionId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken,
          },
          credentials: "include",
          body: JSON.stringify({
            status: "in_progress", // Ensure status is set to in_progress
            currentQuestionIndex: progressData.currentQuestionIndex,
            timeRemaining: progressData.timeRemaining,
            totalTimeSpent: progressData.totalTimeSpent,
            // OPTIMIZATION: Include answers in the same request!
            answers: progressData.answers.map((answer) => ({
              questionId: answer.questionId,
              selectedAnswerId: answer.selectedOptionId,
              timeSpent: answer.timeSpent,
              timestamp: answer.timestamp,
            })),
          }),
        }
      );

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        throw new Error(`Failed to update progress: ${errorText}`);
      }

      const result = {
        success: true,
        timestamp: Date.now(),
      };

      this.options.onSyncSuccess(result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.options.onSyncError(errorMessage);
      return { success: false, timestamp: Date.now(), error: errorMessage };
    }
  }

  /**
   * Prepare quiz state data for efficient transmission
   */
  private prepareSyncData(quizState: QuizState): QuizSyncData {
    // Convert Map to Array for JSON serialization (with the same defensive guard
    // used elsewhere — `answers` can briefly be an array during rehydration).
    const answersEntries: Array<[string, QuizAnswer]> =
      quizState.answers instanceof Map
        ? Array.from(quizState.answers.entries())
        : Array.isArray(quizState.answers)
          ? (quizState.answers as Array<[string, QuizAnswer]>)
          : [];
    const answers = answersEntries.map(([questionId, answer]) => ({
      questionId,
      selectedOptionId: answer.selectedOptionId,
      isCorrect: answer.isCorrect,
      timestamp: answer.timestamp,
      timeSpent: answer.timeSpent, // Already in seconds from state machine
    }));

    return {
      sessionId: quizState.sessionId,
      answers,
      progress: quizState.progress,
      timing: {
        startTime: quizState.startTime,
        endTime: quizState.endTime,
        totalTimeSpent: quizState.totalTimeSpent, // Already in seconds from state machine
      },
      status: quizState.status,
      metadata: {
        questionsCount: quizState.totalQuestions,
        config: quizState.config,
        syncTimestamp: Date.now(),
      },
    };
  }

  /**
   * Perform the actual sync operation. One attempt, no internal retry loop.
   * Retries and offline-wait orchestration are owned by the page's
   * runCompletion — stacking retry loops here made offline detection take
   * ~12s instead of ~3s and obscured which layer was responsible for
   * recovery.
   */
  private async performSync(syncData: QuizSyncData): Promise<SyncResult> {
    try {
      const csrfToken = await this.options.csrfTokenGetter();

      const completePayload = {
        answers: syncData.answers.map((answer) => ({
          questionId: answer.questionId,
          selectedAnswerId: answer.selectedOptionId,
          timeSpent: answer.timeSpent,
          timestamp: answer.timestamp,
        })),
        achievementIds: syncData.achievementIds || [],
      };

      const completeResponse = await fetch(
        `${this.options.apiBaseUrl}/sessions/${syncData.sessionId}/complete`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrfToken,
          },
          credentials: "include",
          body: JSON.stringify(completePayload),
        }
      );

      if (!completeResponse.ok) {
        const errorText = await completeResponse.text();

        if (
          errorText.includes("Quiz session is already completed") ||
          errorText.includes("already completed")
        ) {
          return {
            success: true,
            timestamp: Date.now(),
            serverResponse: { message: "Quiz was already completed" },
          };
        }

        throw new Error(`Quiz completion failed: ${completeResponse.statusText} - ${errorText}`);
      }

      const serverResponse = await completeResponse.json();

      if (serverResponse.success && serverResponse.data) {
        try {
          const sessionKey = `pathology-bites-quiz-result-${syncData.sessionId}`;
          const existingSession = this.getFromCache(sessionKey);
          const resultsWithAchievements = {
            ...serverResponse.data,
            newAchievements: serverResponse.newAchievements || [],
          };
          const updatedSession = {
            ...(existingSession && typeof existingSession === "object" ? existingSession : {}),
            status: "completed",
            results: resultsWithAchievements,
          };
          this.saveToCache(sessionKey, updatedSession);
        } catch (error) {
          console.warn("Failed to cache results:", error);
        }
      }

      return {
        success: true,
        timestamp: Date.now(),
        serverResponse,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        timestamp: Date.now(),
        error: message,
      };
    }
  }
}
