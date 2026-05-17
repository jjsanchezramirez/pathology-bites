// Test suite for quiz state machine core functionality
import { describe, it, expect, beforeEach } from "vitest";
import { quizStateReducer } from "@/features/user/quiz/hybrid/core/quiz-state-machine";
import type { QuizState, QuizQuestion } from "@/features/user/quiz/types/quiz-question";
import { createMockConfig } from "@tests/helpers/test-helpers";

describe("Quiz State Machine", () => {
  let initialState: QuizState;
  let mockQuestions: QuizQuestion[];

  beforeEach(() => {
    // Create mock questions with proper structure
    mockQuestions = [
      {
        id: "q1",
        stem: "Question 1",
        question_options: [
          { id: "opt1-1", text: "Option A", is_correct: true },
          { id: "opt1-2", text: "Option B", is_correct: false },
        ],
        explanation: "Explanation 1",
        category: "Test Category",
        difficulty: "medium",
        question_images: [],
      },
      {
        id: "q2",
        stem: "Question 2",
        question_options: [
          { id: "opt2-1", text: "Option A", is_correct: false },
          { id: "opt2-2", text: "Option B", is_correct: true },
        ],
        explanation: "Explanation 2",
        category: "Test Category",
        difficulty: "easy",
        question_images: [],
      },
      {
        id: "q3",
        stem: "Question 3",
        question_options: [
          { id: "opt3-1", text: "Option A", is_correct: true },
          { id: "opt3-2", text: "Option B", is_correct: false },
        ],
        explanation: "Explanation 3",
        category: "Test Category",
        difficulty: "hard",
        question_images: [],
      },
    ];

    initialState = {
      sessionId: "",
      questions: [],
      config: createMockConfig(),
      currentQuestionIndex: 0,
      totalQuestions: 0,
      answers: new Map(),
      status: "not_started",
      progress: {
        answered: 0,
        correct: 0,
        incorrect: 0,
        percentage: 0,
      },
      totalTimeSpent: 0,
      syncStatus: {
        pendingChanges: false,
        isOnline: true,
      },
    };
  });

  describe("INITIALIZE action", () => {
    it("should initialize quiz state with questions", () => {
      const action = {
        type: "INITIALIZE" as const,
        payload: {
          sessionId: "test-session-1",
          questions: mockQuestions,
          config: createMockConfig(),
        },
      };

      const newState = quizStateReducer(initialState, action);

      expect(newState.sessionId).toBe("test-session-1");
      expect(newState.questions).toHaveLength(3);
      expect(newState.totalQuestions).toBe(3);
      expect(newState.status).toBe("not_started");
      expect(newState.currentQuestionIndex).toBe(0);
    });

    it("should restore existing answers when resuming", () => {
      const existingAnswers = new Map([
        [
          "q1",
          {
            questionId: "q1",
            selectedOptionId: "opt1-1",
            isCorrect: true,
            timestamp: Date.now(),
            timeSpent: 30,
          },
        ],
        [
          "q2",
          {
            questionId: "q2",
            selectedOptionId: "opt2-2",
            isCorrect: true,
            timestamp: Date.now(),
            timeSpent: 45,
          },
        ],
      ]);

      const action = {
        type: "INITIALIZE" as const,
        payload: {
          sessionId: "test-session-1",
          questions: mockQuestions,
          config: createMockConfig(),
          status: "in_progress",
          existingAnswers,
          currentQuestionIndex: 2,
          totalTimeSpent: 75,
        },
      };

      const newState = quizStateReducer(initialState, action);

      expect(newState.answers.size).toBe(2);
      expect(newState.currentQuestionIndex).toBe(2);
      expect(newState.totalTimeSpent).toBe(75);
      expect(newState.progress.answered).toBe(2);
      expect(newState.progress.correct).toBe(2);
      expect(newState.progress.percentage).toBe(67); // 2/3 = 66.67% rounded to 67
    });

    it("should handle completed quiz status", () => {
      const action = {
        type: "INITIALIZE" as const,
        payload: {
          sessionId: "test-session-1",
          questions: mockQuestions,
          config: createMockConfig(),
          status: "completed",
        },
      };

      const newState = quizStateReducer(initialState, action);

      expect(newState.status).toBe("completed");
    });
  });

  describe("START_QUIZ action", () => {
    beforeEach(() => {
      initialState = quizStateReducer(initialState, {
        type: "INITIALIZE",
        payload: {
          sessionId: "test-session",
          questions: mockQuestions,
          config: createMockConfig(),
        },
      });
    });

    it("should change status to in_progress", () => {
      const action = { type: "START_QUIZ" as const };
      const newState = quizStateReducer(initialState, action);

      expect(newState.status).toBe("in_progress");
      expect(newState.startTime).toBeDefined();
      expect(newState.syncStatus.pendingChanges).toBe(true);
    });
  });

  describe("SUBMIT_ANSWER action", () => {
    beforeEach(() => {
      initialState = quizStateReducer(initialState, {
        type: "INITIALIZE",
        payload: {
          sessionId: "test-session",
          questions: mockQuestions,
          config: createMockConfig(),
        },
      });
      initialState = quizStateReducer(initialState, { type: "START_QUIZ" });
    });

    it("should record correct answer", () => {
      const action = {
        type: "SUBMIT_ANSWER" as const,
        payload: {
          questionId: "q1",
          selectedOptionId: "opt1-1", // correct option
          timeSpent: 30,
        },
      };

      const newState = quizStateReducer(initialState, action);

      expect(newState.answers.size).toBe(1);
      const answer = newState.answers.get("q1");
      expect(answer).toBeDefined();
      expect(answer?.isCorrect).toBe(true);
      expect(answer?.selectedOptionId).toBe("opt1-1");
      expect(answer?.timeSpent).toBe(30);
      expect(newState.progress.answered).toBe(1);
      expect(newState.progress.correct).toBe(1);
      expect(newState.progress.incorrect).toBe(0);
      expect(newState.totalTimeSpent).toBe(30);
    });

    it("should record incorrect answer", () => {
      const action = {
        type: "SUBMIT_ANSWER" as const,
        payload: {
          questionId: "q1",
          selectedOptionId: "opt1-2", // incorrect option
          timeSpent: 45,
        },
      };

      const newState = quizStateReducer(initialState, action);

      const answer = newState.answers.get("q1");
      expect(answer?.isCorrect).toBe(false);
      expect(newState.progress.answered).toBe(1);
      expect(newState.progress.correct).toBe(0);
      expect(newState.progress.incorrect).toBe(1);
    });

    it("should update progress percentage correctly", () => {
      let state = initialState;

      // Answer first question
      state = quizStateReducer(state, {
        type: "SUBMIT_ANSWER",
        payload: { questionId: "q1", selectedOptionId: "opt1-1", timeSpent: 30 },
      });
      expect(state.progress.percentage).toBe(33); // 1/3 = 33.33% rounded to 33

      // Answer second question
      state = quizStateReducer(state, {
        type: "SUBMIT_ANSWER",
        payload: { questionId: "q2", selectedOptionId: "opt2-2", timeSpent: 40 },
      });
      expect(state.progress.percentage).toBe(67); // 2/3 = 66.67% rounded to 67

      // Answer third question
      state = quizStateReducer(state, {
        type: "SUBMIT_ANSWER",
        payload: { questionId: "q3", selectedOptionId: "opt3-1", timeSpent: 35 },
      });
      expect(state.progress.percentage).toBe(100); // 3/3 = 100%
    });

    it("should allow changing an answer", () => {
      let state = initialState;

      // Submit first answer (incorrect)
      state = quizStateReducer(state, {
        type: "SUBMIT_ANSWER",
        payload: { questionId: "q1", selectedOptionId: "opt1-2", timeSpent: 30 },
      });
      expect(state.progress.correct).toBe(0);

      // Change to correct answer
      state = quizStateReducer(state, {
        type: "SUBMIT_ANSWER",
        payload: { questionId: "q1", selectedOptionId: "opt1-1", timeSpent: 15 },
      });
      expect(state.progress.correct).toBe(1);
      expect(state.progress.answered).toBe(1); // Should still be 1, not 2
      expect(state.totalTimeSpent).toBe(45); // 30 + 15
    });

    it("should accumulate time spent correctly", () => {
      let state = initialState;

      state = quizStateReducer(state, {
        type: "SUBMIT_ANSWER",
        payload: { questionId: "q1", selectedOptionId: "opt1-1", timeSpent: 30 },
      });

      state = quizStateReducer(state, {
        type: "SUBMIT_ANSWER",
        payload: { questionId: "q2", selectedOptionId: "opt2-2", timeSpent: 45 },
      });

      state = quizStateReducer(state, {
        type: "SUBMIT_ANSWER",
        payload: { questionId: "q3", selectedOptionId: "opt3-1", timeSpent: 60 },
      });

      expect(state.totalTimeSpent).toBe(135); // 30 + 45 + 60
    });

    it("should return unchanged state for invalid question ID", () => {
      const action = {
        type: "SUBMIT_ANSWER" as const,
        payload: {
          questionId: "invalid-id",
          selectedOptionId: "opt1-1",
          timeSpent: 30,
        },
      };

      const newState = quizStateReducer(initialState, action);

      expect(newState).toEqual(initialState);
      expect(newState.answers.size).toBe(0);
    });

    it("should mark sync as pending after answer", () => {
      const action = {
        type: "SUBMIT_ANSWER" as const,
        payload: {
          questionId: "q1",
          selectedOptionId: "opt1-1",
          timeSpent: 30,
        },
      };

      const newState = quizStateReducer(initialState, action);

      expect(newState.syncStatus.pendingChanges).toBe(true);
    });
  });

  describe("NAVIGATE_TO_QUESTION action", () => {
    beforeEach(() => {
      initialState = quizStateReducer(initialState, {
        type: "INITIALIZE",
        payload: {
          sessionId: "test-session",
          questions: mockQuestions,
          config: createMockConfig(),
        },
      });
    });

    it("should navigate to valid question index", () => {
      const action = {
        type: "NAVIGATE_TO_QUESTION" as const,
        payload: { index: 2 },
      };

      const newState = quizStateReducer(initialState, action);

      expect(newState.currentQuestionIndex).toBe(2);
    });

    it("should not navigate to negative index", () => {
      const action = {
        type: "NAVIGATE_TO_QUESTION" as const,
        payload: { index: -1 },
      };

      const newState = quizStateReducer(initialState, action);

      expect(newState.currentQuestionIndex).toBe(0); // unchanged
    });

    it("should not navigate beyond question count", () => {
      const action = {
        type: "NAVIGATE_TO_QUESTION" as const,
        payload: { index: 5 },
      };

      const newState = quizStateReducer(initialState, action);

      expect(newState.currentQuestionIndex).toBe(0); // unchanged
    });
  });

  describe("PAUSE_QUIZ and RESUME_QUIZ actions", () => {
    beforeEach(() => {
      initialState = quizStateReducer(initialState, {
        type: "INITIALIZE",
        payload: {
          sessionId: "test-session",
          questions: mockQuestions,
          config: createMockConfig(),
        },
      });
      initialState = quizStateReducer(initialState, { type: "START_QUIZ" });
    });

    it("should maintain in_progress status when paused", () => {
      const action = { type: "PAUSE_QUIZ" as const };
      const newState = quizStateReducer(initialState, action);

      expect(newState.status).toBe("in_progress");
      expect(newState.syncStatus.pendingChanges).toBe(true);
    });

    it("should maintain in_progress status when resumed", () => {
      let state = quizStateReducer(initialState, { type: "PAUSE_QUIZ" });
      state = quizStateReducer(state, { type: "RESUME_QUIZ" });

      expect(state.status).toBe("in_progress");
      expect(state.syncStatus.pendingChanges).toBe(true);
    });
  });

  describe("COMPLETE_QUIZ action", () => {
    beforeEach(() => {
      initialState = quizStateReducer(initialState, {
        type: "INITIALIZE",
        payload: {
          sessionId: "test-session",
          questions: mockQuestions,
          config: createMockConfig(),
        },
      });
      initialState = quizStateReducer(initialState, { type: "START_QUIZ" });
    });

    it("should change status to completed", () => {
      const action = { type: "COMPLETE_QUIZ" as const };
      const newState = quizStateReducer(initialState, action);

      expect(newState.status).toBe("completed");
      expect(newState.endTime).toBeDefined();
      expect(newState.syncStatus.pendingChanges).toBe(true);
    });
  });

  describe("SYNC_SUCCESS and SYNC_FAILED actions", () => {
    beforeEach(() => {
      initialState = quizStateReducer(initialState, {
        type: "INITIALIZE",
        payload: {
          sessionId: "test-session",
          questions: mockQuestions,
          config: createMockConfig(),
        },
      });
    });

    it("should update last sync timestamp on success", () => {
      const timestamp = Date.now();
      const action = {
        type: "SYNC_SUCCESS" as const,
        payload: { timestamp },
      };

      const newState = quizStateReducer(initialState, action);

      expect(newState.syncStatus.lastSyncTime).toBe(timestamp);
      expect(newState.syncStatus.pendingChanges).toBe(false);
    });

    it("should keep pending changes on sync failure", () => {
      const stateWithPendingChanges = {
        ...initialState,
        syncStatus: { ...initialState.syncStatus, pendingChanges: true },
      };

      const action = { type: "SYNC_FAILED" as const };
      const newState = quizStateReducer(stateWithPendingChanges, action);

      expect(newState.syncStatus.pendingChanges).toBe(true);
    });
  });

  describe("SET_ONLINE_STATUS action", () => {
    it("should update online status", () => {
      const action = {
        type: "SET_ONLINE_STATUS" as const,
        payload: { isOnline: false },
      };

      const newState = quizStateReducer(initialState, action);

      expect(newState.syncStatus.isOnline).toBe(false);
    });
  });

  describe("Integration: Complete quiz flow", () => {
    it("should handle full quiz lifecycle", () => {
      // Initialize
      let state = quizStateReducer(initialState, {
        type: "INITIALIZE",
        payload: {
          sessionId: "integration-test",
          questions: mockQuestions,
          config: createMockConfig({ mode: "tutor", timing: "untimed" }),
        },
      });

      expect(state.status).toBe("not_started");
      expect(state.totalQuestions).toBe(3);

      // Start quiz
      state = quizStateReducer(state, { type: "START_QUIZ" });
      expect(state.status).toBe("in_progress");

      // Answer all questions
      state = quizStateReducer(state, {
        type: "SUBMIT_ANSWER",
        payload: { questionId: "q1", selectedOptionId: "opt1-1", timeSpent: 30 },
      });
      state = quizStateReducer(state, {
        type: "NAVIGATE_TO_QUESTION",
        payload: { index: 1 },
      });
      state = quizStateReducer(state, {
        type: "SUBMIT_ANSWER",
        payload: { questionId: "q2", selectedOptionId: "opt2-1", timeSpent: 40 },
      });
      state = quizStateReducer(state, {
        type: "NAVIGATE_TO_QUESTION",
        payload: { index: 2 },
      });
      state = quizStateReducer(state, {
        type: "SUBMIT_ANSWER",
        payload: { questionId: "q3", selectedOptionId: "opt3-1", timeSpent: 35 },
      });

      // Verify progress
      expect(state.progress.answered).toBe(3);
      expect(state.progress.correct).toBe(2); // q1 and q3 correct, q2 incorrect
      expect(state.progress.incorrect).toBe(1);
      expect(state.progress.percentage).toBe(100);
      expect(state.totalTimeSpent).toBe(105);

      // Complete quiz
      state = quizStateReducer(state, { type: "COMPLETE_QUIZ" });
      expect(state.status).toBe("completed");

      // Sync
      const syncTimestamp = Date.now();
      state = quizStateReducer(state, {
        type: "SYNC_SUCCESS",
        payload: { timestamp: syncTimestamp },
      });
      expect(state.syncStatus.pendingChanges).toBe(false);
      expect(state.syncStatus.lastSyncTime).toBe(syncTimestamp);
    });
  });
});
