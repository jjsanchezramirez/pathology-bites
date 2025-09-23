/**
 * Integration Tests for Pure Serverless Hybrid Quiz System
 *
 * These tests verify that the hybrid system integrates correctly
 * with React components and provides the expected functionality.
 */

import { renderHook, act } from "@testing-library/react";
import { useHybridQuiz, HybridPresets } from "@/features/quiz/hybrid";

// Mock fetch for testing
global.fetch = jest.fn();

const mockQuestions = [
  {
    id: "q1",
    text: "What is the capital of France?",
    options: [
      { id: "a1", text: "London", isCorrect: false },
      { id: "a2", text: "Paris", isCorrect: true },
      { id: "a3", text: "Berlin", isCorrect: false },
      { id: "a4", text: "Madrid", isCorrect: false },
    ],
    category: "Geography",
  },
  {
    id: "q2",
    text: "What is 2 + 2?",
    options: [
      { id: "b1", text: "3", isCorrect: false },
      { id: "b2", text: "4", isCorrect: true },
      { id: "b3", text: "5", isCorrect: false },
      { id: "b4", text: "6", isCorrect: false },
    ],
    category: "Math",
  },
];

describe("Hybrid Quiz Integration", () => {
  beforeEach(() => {
    // Reset fetch mock
    (fetch as jest.Mock).mockClear();

    // Mock successful API responses
    (fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("/sessions/")) {
        if (url.includes("/complete")) {
          // Mock quiz completion response
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                data: { score: 2, totalQuestions: 2, totalTimeSpent: 120 },
              }),
          });
        } else if (url.includes("/sync")) {
          // Mock old sync response (legacy)
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({ success: true, timestamp: Date.now() }),
          });
        } else {
          // Mock fetch quiz data response
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                data: {
                  questions: mockQuestions,
                  config: {
                    mode: "tutor",
                    timing: "untimed",
                    showExplanations: true,
                    allowReview: true,
                  },
                  answers: [],
                },
              }),
          });
        }
      } else if (url.includes("/attempts/batch")) {
        // Mock batch answer submission
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      }
      return Promise.reject(new Error("Unknown URL: " + url));
    });

    // Mock localStorage
    const localStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };
    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
    });
  });

  it("should initialize hybrid quiz system", async () => {
    const { result } = renderHook(() =>
      useHybridQuiz({
        sessionId: "test-session-1",
        ...HybridPresets.TUTOR_MODE,
      }),
    );

    // Initially loading
    expect(result.current[0].isLoading).toBe(true);
    expect(result.current[0].isInitialized).toBe(false);

    // Wait for initialization
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Should be initialized after API call
    expect(result.current[0].isInitialized).toBe(true);
    expect(result.current[0].isLoading).toBe(false);
    expect(result.current[0].totalQuestions).toBe(2);
    expect(result.current[0].metrics.totalApiCalls).toBe(1); // Only 1 API call for initialization
  });

  it("should handle quiz flow with instant responses", async () => {
    const onAnswerSubmitted = jest.fn();
    const onQuizCompleted = jest.fn();

    const { result } = renderHook(() =>
      useHybridQuiz({
        sessionId: "test-session-2",
        ...HybridPresets.TUTOR_MODE,
        onAnswerSubmitted,
        onQuizCompleted,
      }),
    );

    // Wait for initialization
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const [state, actions] = result.current;

    // Start quiz
    await act(async () => {
      await actions.startQuiz();
    });

    expect(result.current[0].status).toBe("in_progress");

    // Submit first answer (correct)
    act(() => {
      const response = actions.submitAnswer("q1", "a2");
      expect(response?.isCorrect).toBe(true);
      expect(response?.feedback?.instant).toBe(true);
    });

    expect(onAnswerSubmitted).toHaveBeenCalledWith(
      "q1",
      "a2",
      expect.objectContaining({
        isCorrect: true,
      }),
    );

    // Check progress updated instantly
    expect(result.current[0].progress.current).toBe(1);
    expect(result.current[0].progress.percentage).toBe(50);

    // Navigate to next question
    act(() => {
      const success = actions.nextQuestion();
      expect(success).toBe(true);
    });

    expect(result.current[0].currentQuestion).toBe(2);

    // Submit second answer (incorrect)
    act(() => {
      const response = actions.submitAnswer("q2", "b1");
      expect(response?.isCorrect).toBe(false);
    });

    // Complete quiz
    await act(async () => {
      const result = await actions.completeQuiz();
      expect(result.success).toBe(true);
    });

    expect(result.current[0].status).toBe("completed");
    expect(result.current[0].metrics.totalApiCalls).toBe(2); // Only 2 API calls total!

    // Wait for async callback
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(onQuizCompleted).toHaveBeenCalledWith({
      score: 1,
      totalQuestions: 2,
      timeSpent: expect.any(Number),
    });
  });

  it("should provide instant navigation without API calls", async () => {
    const { result } = renderHook(() =>
      useHybridQuiz({
        sessionId: "test-session-3",
        ...HybridPresets.PRACTICE_MODE,
      }),
    );

    // Wait for initialization
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const [, actions] = result.current;

    // Start at question 1, navigate to question 2
    act(() => {
      const success = actions.nextQuestion();
      expect(success).toBe(true);
    });
    expect(result.current[0].currentQuestion).toBe(2);

    // Navigate back to question 1
    act(() => {
      const success = actions.previousQuestion();
      expect(success).toBe(true);
    });
    expect(result.current[0].currentQuestion).toBe(1);

    // Navigate directly to question 2 (0-indexed, so index 1)
    act(() => {
      expect(actions.navigateToQuestion(1)).toBe(true);
    });
    expect(result.current[0].currentQuestion).toBe(2);

    // Navigation should not trigger additional API calls
    expect(result.current[0].metrics.totalApiCalls).toBe(1); // Still only the initial fetch
  });

  it("should handle offline scenarios", async () => {
    const { result } = renderHook(() =>
      useHybridQuiz({
        sessionId: "test-session-4",
        ...HybridPresets.OFFLINE_MODE,
      }),
    );

    // Wait for initialization
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Simulate going offline
    act(() => {
      // Trigger offline event
      window.dispatchEvent(new Event("offline"));
    });

    const [, actions] = result.current;

    // Should still work offline
    await act(async () => {
      await actions.startQuiz();
    });

    act(() => {
      const response = actions.submitAnswer("q1", "a2");
      expect(response?.isCorrect).toBe(true);
    });

    // Progress should update even offline
    expect(result.current[0].progress.current).toBe(1);
    expect(result.current[0].realtimeStats.connected).toBe(false);
  });

  it("should provide correct performance metrics", async () => {
    const { result } = renderHook(() =>
      useHybridQuiz({
        sessionId: "test-session-5",
        ...HybridPresets.TUTOR_MODE,
      }),
    );

    // Wait for initialization
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    const [state, actions] = result.current;

    // Start and complete quiz
    await act(async () => {
      await actions.startQuiz();
    });

    act(() => {
      actions.submitAnswer("q1", "a2");
      actions.submitAnswer("q2", "b2");
    });

    await act(async () => {
      await actions.completeQuiz();
    });

    // Check final metrics
    const finalState = result.current[0];
    expect(finalState.metrics.totalApiCalls).toBe(2); // Fetch + Sync
    expect(finalState.metrics.averageResponseTime).toBeGreaterThanOrEqual(0);
    expect(finalState.realtimeStats.latency).toBe(0); // Client-side operations
  });

  it("should handle API errors gracefully", async () => {
    const onError = jest.fn();

    // Mock API failure
    (fetch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        statusText: "Internal Server Error",
      }),
    );

    const { result } = renderHook(() =>
      useHybridQuiz({
        sessionId: "test-session-6",
        ...HybridPresets.TUTOR_MODE,
        onError,
      }),
    );

    // Wait for initialization attempt
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(onError).toHaveBeenCalledWith(
      expect.stringContaining("Failed to initialize quiz"),
    );
    expect(result.current[0].isInitialized).toBe(false);
  });
});
