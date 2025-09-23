/**
 * Tests for Pure Serverless Hybrid Quiz State Machine
 *
 * These tests ensure the core state machine logic works correctly
 * and maintains data integrity across all operations.
 */

import {
  QuizState,
  QuizQuestion,
  quizStateReducer,
  createInitialQuizState,
  QuizStateUtils,
} from "@/features/quiz/hybrid/core/quiz-state-machine";

// Mock questions for testing
const mockQuestions: QuizQuestion[] = [
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

describe("Quiz State Machine", () => {
  let initialState: QuizState;

  beforeEach(() => {
    initialState = createInitialQuizState();
  });

  describe("createInitialQuizState", () => {
    it("should create a valid initial state", () => {
      expect(initialState.status).toBe("not_started");
      expect(initialState.currentQuestionIndex).toBe(0);
      expect(initialState.totalQuestions).toBe(0);
      expect(initialState.questions).toEqual([]);
      expect(initialState.answers.size).toBe(0);
      expect(initialState.progress.answered).toBe(0);
      expect(initialState.progress.correct).toBe(0);
      expect(initialState.progress.incorrect).toBe(0);
      expect(initialState.progress.percentage).toBe(0);
    });
  });

  describe("INITIALIZE action", () => {
    it("should initialize quiz with questions and config", () => {
      const action = {
        type: "INITIALIZE" as const,
        payload: {
          sessionId: "test-session",
          questions: mockQuestions,
          config: {
            mode: "tutor" as const,
            timing: "untimed" as const,
            showExplanations: true,
            allowReview: true,
          },
        },
      };

      const newState = quizStateReducer(initialState, action);

      expect(newState.sessionId).toBe("test-session");
      expect(newState.questions).toEqual(mockQuestions);
      expect(newState.totalQuestions).toBe(2);
      expect(newState.status).toBe("not_started");
      expect(newState.config.mode).toBe("tutor");
    });
  });

  describe("START_QUIZ action", () => {
    it("should start the quiz and set start time", () => {
      const initializedState = quizStateReducer(initialState, {
        type: "INITIALIZE",
        payload: {
          sessionId: "test",
          questions: mockQuestions,
          config: {
            mode: "tutor",
            timing: "untimed",
            showExplanations: true,
            allowReview: true,
          },
        },
      });

      const startedState = quizStateReducer(initializedState, {
        type: "START_QUIZ",
      });

      expect(startedState.status).toBe("in_progress");
      expect(startedState.startTime).toBeDefined();
      expect(startedState.syncStatus.pendingChanges).toBe(true);
    });
  });

  describe("SUBMIT_ANSWER action", () => {
    let startedState: QuizState;

    beforeEach(() => {
      const initializedState = quizStateReducer(initialState, {
        type: "INITIALIZE",
        payload: {
          sessionId: "test",
          questions: mockQuestions,
          config: {
            mode: "tutor",
            timing: "untimed",
            showExplanations: true,
            allowReview: true,
          },
        },
      });
      startedState = quizStateReducer(initializedState, { type: "START_QUIZ" });
    });

    it("should record correct answer", () => {
      const action = {
        type: "SUBMIT_ANSWER" as const,
        payload: {
          questionId: "q1",
          selectedOptionId: "a2", // Correct answer: Paris
          timeSpent: 5000,
        },
      };

      const newState = quizStateReducer(startedState, action);

      expect(newState.answers.size).toBe(1);
      expect(newState.progress.answered).toBe(1);
      expect(newState.progress.correct).toBe(1);
      expect(newState.progress.incorrect).toBe(0);
      expect(newState.progress.percentage).toBe(50); // 1 out of 2 questions
      expect(newState.totalTimeSpent).toBe(5000);

      const answer = newState.answers.get("q1");
      expect(answer?.isCorrect).toBe(true);
      expect(answer?.selectedOptionId).toBe("a2");
      expect(answer?.timeSpent).toBe(5000);
    });

    it("should record incorrect answer", () => {
      const action = {
        type: "SUBMIT_ANSWER" as const,
        payload: {
          questionId: "q1",
          selectedOptionId: "a1", // Incorrect answer: London
          timeSpent: 3000,
        },
      };

      const newState = quizStateReducer(startedState, action);

      expect(newState.progress.answered).toBe(1);
      expect(newState.progress.correct).toBe(0);
      expect(newState.progress.incorrect).toBe(1);

      const answer = newState.answers.get("q1");
      expect(answer?.isCorrect).toBe(false);
      expect(answer?.selectedOptionId).toBe("a1");
    });

    it("should handle multiple answers", () => {
      let state = quizStateReducer(startedState, {
        type: "SUBMIT_ANSWER",
        payload: { questionId: "q1", selectedOptionId: "a2", timeSpent: 5000 },
      });

      state = quizStateReducer(state, {
        type: "SUBMIT_ANSWER",
        payload: { questionId: "q2", selectedOptionId: "b1", timeSpent: 3000 },
      });

      expect(state.answers.size).toBe(2);
      expect(state.progress.answered).toBe(2);
      expect(state.progress.correct).toBe(1); // q1 correct, q2 incorrect
      expect(state.progress.incorrect).toBe(1);
      expect(state.progress.percentage).toBe(100); // 2 out of 2 questions
      expect(state.totalTimeSpent).toBe(8000);
    });
  });

  describe("Navigation actions", () => {
    let startedState: QuizState;

    beforeEach(() => {
      const initializedState = quizStateReducer(initialState, {
        type: "INITIALIZE",
        payload: {
          sessionId: "test",
          questions: mockQuestions,
          config: {
            mode: "tutor",
            timing: "untimed",
            showExplanations: true,
            allowReview: true,
          },
        },
      });
      startedState = quizStateReducer(initializedState, { type: "START_QUIZ" });
    });

    it("should navigate to valid question index", () => {
      const newState = quizStateReducer(startedState, {
        type: "NAVIGATE_TO_QUESTION",
        payload: { index: 1 },
      });

      expect(newState.currentQuestionIndex).toBe(1);
    });

    it("should not navigate to invalid question index", () => {
      const newState = quizStateReducer(startedState, {
        type: "NAVIGATE_TO_QUESTION",
        payload: { index: 5 },
      });

      expect(newState.currentQuestionIndex).toBe(0); // Should remain unchanged
    });
  });

  describe("QuizStateUtils", () => {
    let testState: QuizState;

    beforeEach(() => {
      testState = quizStateReducer(initialState, {
        type: "INITIALIZE",
        payload: {
          sessionId: "test",
          questions: mockQuestions,
          config: {
            mode: "tutor",
            timing: "untimed",
            showExplanations: true,
            allowReview: true,
          },
        },
      });
    });

    it("should get current question", () => {
      const currentQuestion = QuizStateUtils.getCurrentQuestion(testState);
      expect(currentQuestion).toEqual(mockQuestions[0]);
    });

    it("should check navigation capabilities", () => {
      expect(QuizStateUtils.canNavigateNext(testState)).toBe(true);
      expect(QuizStateUtils.canNavigatePrevious(testState)).toBe(false);

      const navigatedState = quizStateReducer(testState, {
        type: "NAVIGATE_TO_QUESTION",
        payload: { index: 1 },
      });

      expect(QuizStateUtils.canNavigateNext(navigatedState)).toBe(false);
      expect(QuizStateUtils.canNavigatePrevious(navigatedState)).toBe(true);
    });

    it("should check if question is answered", () => {
      expect(QuizStateUtils.isQuestionAnswered(testState, "q1")).toBe(false);

      const answeredState = quizStateReducer(testState, {
        type: "SUBMIT_ANSWER",
        payload: { questionId: "q1", selectedOptionId: "a2", timeSpent: 1000 },
      });

      expect(QuizStateUtils.isQuestionAnswered(answeredState, "q1")).toBe(true);
    });
  });
});
