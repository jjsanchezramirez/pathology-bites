// Mock data generators for testing quiz functionality
import type { QuizSession, QuizResult } from "@/features/user/quiz/types/quiz";
import type { QuestionWithDetails } from "@/shared/types/questions";

/**
 * Create a mock quiz session
 */
export function createMockSession(overrides?: Partial<QuizSession>): QuizSession {
  return {
    id: `session-${Date.now()}`,
    userId: "test-user-id",
    title: "Test Quiz",
    config: {
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
    },
    questions: [],
    currentQuestionIndex: 0,
    status: "not_started",
    totalQuestions: 10,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a mock question with full details
 */
export function createMockQuestionWithDetails(
  overrides?: Partial<QuestionWithDetails>
): QuestionWithDetails {
  return {
    id: `q-${Math.random().toString(36).substr(2, 9)}`,
    title: "Test Question",
    stem: "What is the most likely diagnosis?",
    question_images: [],
    answer_options: [
      {
        id: `opt-${Math.random().toString(36).substr(2, 9)}`,
        question_id: "",
        option_text: "Option A",
        is_correct: true,
        display_order: 1,
      },
      {
        id: `opt-${Math.random().toString(36).substr(2, 9)}`,
        question_id: "",
        option_text: "Option B",
        is_correct: false,
        display_order: 2,
      },
      {
        id: `opt-${Math.random().toString(36).substr(2, 9)}`,
        question_id: "",
        option_text: "Option C",
        is_correct: false,
        display_order: 3,
      },
      {
        id: `opt-${Math.random().toString(36).substr(2, 9)}`,
        question_id: "",
        option_text: "Option D",
        is_correct: false,
        display_order: 4,
      },
    ],
    category: {
      id: "cat-1",
      name: "Test Category",
      short_form: "TC",
      parent_category_id: null,
      display_order: 1,
    },
    difficulty: "medium",
    explanation: "This is the explanation for the correct answer.",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  } as QuestionWithDetails;
}

/**
 * Create mock quiz result
 */
export function createMockQuizResult(overrides?: Partial<QuizResult>): QuizResult {
  return {
    sessionId: `session-${Date.now()}`,
    score: 80,
    correctAnswers: 8,
    totalQuestions: 10,
    totalTimeSpent: 600,
    averageTimePerQuestion: 60,
    difficultyBreakdown: {
      easy: { correct: 3, total: 4 },
      medium: { correct: 4, total: 5 },
      hard: { correct: 1, total: 1 },
    },
    categoryBreakdown: [
      {
        categoryId: "cat-1",
        categoryName: "Test Category",
        correct: 8,
        total: 10,
        totalTime: 600,
        averageTime: 60,
      },
    ],
    questionDetails: [],
    attempts: [],
    completedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create mock user stats for achievement testing
 */
export function createMockUserStats(overrides?: any) {
  return {
    totalQuizzes: 0,
    perfectScores: 0,
    currentStreak: 0,
    longestStreak: 0,
    accuracyOver3: 0,
    accuracyOver5: 0,
    accuracyOver8: 0,
    accuracyOver10: 0,
    accuracyOver12: 0,
    accuracyOver15: 0,
    subjectsWith10Questions: 0,
    subjectsWith25Questions: 0,
    subjectsWith50Questions: 0,
    subjectsWith100Questions: 0,
    totalCategories: 0,
    ...overrides,
  };
}

/**
 * Create a complete mock quiz session with questions
 */
export function createMockQuizWithQuestions(questionCount = 5): QuizSession {
  const questions = Array.from({ length: questionCount }, (_, i) =>
    createMockQuestionWithDetails({
      id: `q-${i + 1}`,
      title: `Question ${i + 1}`,
      stem: `What is the answer to question ${i + 1}?`,
    })
  );

  return createMockSession({
    questions,
    totalQuestions: questionCount,
  });
}

/**
 * Create mock answers for a quiz session
 */
export function createMockAnswers(questionIds: string[], allCorrect = false) {
  return questionIds.map((questionId, index) => ({
    questionId,
    selectedOptionId: allCorrect ? `opt-correct-${index}` : `opt-${index}`,
    isCorrect: allCorrect || Math.random() > 0.5,
    timeSpent: Math.floor(Math.random() * 120) + 30, // 30-150 seconds
    timestamp: Date.now() + index * 1000,
  }));
}
