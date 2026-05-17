import type { QuizConfig } from "@/features/user/quiz/types/quiz";
import type { QuizState, QuizQuestion } from "@/features/user/quiz/types/quiz-question";

export function createMockConfig(overrides: Partial<QuizConfig> = {}): QuizConfig {
  return {
    mode: "exam",
    timing: "untimed",
    questionCount: 10,
    questionType: "multiple_choice",
    categorySelection: "all",
    selectedCategories: [],
    shuffleQuestions: false,
    shuffleAnswers: false,
    showProgress: true,
    showExplanations: false,
    ...overrides,
  };
}

export function createMockQuestion(overrides: Partial<QuizQuestion> = {}): QuizQuestion {
  return {
    id: "mock-q",
    stem: "Mock question",
    question_options: [
      { id: "opt-1", text: "Option A", is_correct: true },
      { id: "opt-2", text: "Option B", is_correct: false },
    ],
    explanation: "Mock explanation",
    category: "Mock Category",
    difficulty: "medium",
    question_images: [],
    ...overrides,
  };
}

export function createMockQuizState(overrides: Partial<QuizState> = {}): QuizState {
  return {
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
    ...overrides,
  };
}
