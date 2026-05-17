// Test helper utilities for creating mock data and common test operations
import { vi } from "vitest";
import type { QuizQuestion, QuizConfig, QuizState } from "@/features/user/quiz/types/quiz-question";

/**
 * Create a mock quiz question for testing
 */
export function createMockQuestion(overrides?: Partial<QuizQuestion>): QuizQuestion {
  const defaultQuestion: QuizQuestion = {
    id: `question-${Math.random().toString(36).substr(2, 9)}`,
    stem: "What is the diagnosis?",
    options: [
      { id: "opt-1", text: "Option A" },
      { id: "opt-2", text: "Option B" },
      { id: "opt-3", text: "Option C" },
      { id: "opt-4", text: "Option D" },
    ],
    correctOptionId: "opt-1",
    explanation: "This is the explanation",
    category: "Test Category",
    difficulty: "medium",
    imageUrl: null,
    ...overrides,
  };

  return defaultQuestion;
}

/**
 * Create multiple mock questions
 */
export function createMockQuestions(count: number): QuizQuestion[] {
  return Array.from({ length: count }, (_, i) =>
    createMockQuestion({
      id: `question-${i + 1}`,
      stem: `Question ${i + 1}`,
    })
  );
}

/**
 * Create a mock quiz configuration
 */
export function createMockConfig(overrides?: Partial<QuizConfig>): QuizConfig {
  return {
    mode: "practice",
    timing: "untimed",
    questionCount: 10,
    questionType: "all",
    categorySelection: "all",
    selectedCategories: [],
    shuffleQuestions: false,
    shuffleAnswers: false,
    showProgress: true,
    showExplanations: false,
    ...overrides,
  };
}

/**
 * Create a mock quiz state
 */
export function createMockQuizState(overrides?: Partial<QuizState>): QuizState {
  const questions = createMockQuestions(5);
  return {
    sessionId: `session-${Math.random().toString(36).substr(2, 9)}`,
    questions,
    config: createMockConfig(),
    currentQuestionIndex: 0,
    totalQuestions: questions.length,
    answers: new Map(),
    status: "not_started",
    progress: {
      answered: 0,
      correct: 0,
      percentage: 0,
    },
    totalTimeSpent: 0,
    syncStatus: {
      lastSyncTimestamp: null,
      pendingChanges: false,
      isOnline: true,
    },
    ...overrides,
  };
}

/**
 * Mock localStorage for testing
 */
export function mockLocalStorage() {
  const store: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach((key) => delete store[key]);
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  };
}

/**
 * Wait for a specific amount of time (for testing async operations)
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean,
  timeout = 5000,
  interval = 50
): Promise<void> {
  const startTime = Date.now();

  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error(`Timeout waiting for condition after ${timeout}ms`);
    }
    await wait(interval);
  }
}

/**
 * Mock fetch for API testing
 */
export function mockFetch(responses: Record<string, any>) {
  return vi.fn((url: string, options?: RequestInit) => {
    const method = options?.method || "GET";
    const key = `${method} ${url}`;
    const response = responses[key] || responses[url];

    if (!response) {
      return Promise.reject(new Error(`No mock response for ${key}`));
    }

    return Promise.resolve({
      ok: true,
      status: 200,
      statusText: "OK",
      json: () => Promise.resolve(response),
      text: () => Promise.resolve(JSON.stringify(response)),
      headers: new Headers(),
      ...response.mockResponse,
    });
  });
}

/**
 * Create a mock timer for testing timed quizzes
 */
export function createMockTimer() {
  let currentTime = 0;
  const callbacks: (() => void)[] = [];

  return {
    getCurrentTime: () => currentTime,
    advance: (ms: number) => {
      currentTime += ms;
      callbacks.forEach((cb) => cb());
    },
    reset: () => {
      currentTime = 0;
      callbacks.length = 0;
    },
    onTick: (callback: () => void) => {
      callbacks.push(callback);
    },
  };
}

/**
 * Suppress console errors/warnings during tests
 */
export function suppressConsole() {
  const originalError = console.error;
  const originalWarn = console.warn;

  beforeAll(() => {
    console.error = vi.fn();
    console.warn = vi.fn();
  });

  afterAll(() => {
    console.error = originalError;
    console.warn = originalWarn;
  });
}
