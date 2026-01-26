/**
 * Standardized Quiz Question Types for the Hybrid Quiz System
 *
 * This file defines the authoritative interfaces for quiz questions
 * to ensure consistency across the entire quiz system.
 */

// Core quiz question option interface
export interface QuizQuestionOption {
  id: string;
  text: string;
  is_correct: boolean;
  explanation?: string;
}

// Core quiz question interface for the hybrid system
export interface QuizQuestion {
  id: string;
  text: string; // Question stem
  question_options: QuizQuestionOption[];
  explanation?: string; // Teaching point
  category?: string;
  difficulty?: "easy" | "medium" | "hard";
  metadata?: {
    images?: unknown[];
    tags?: string[];
    originalData?: unknown; // Preserve original API data
  };
}

// UI quiz question interface (for components)
export interface UIQuizQuestion {
  id: string;
  title?: string;
  stem: string;
  teaching_point?: string;
  question_references?: string;
  question_options: Array<{
    id: string;
    text: string;
    is_correct: boolean;
    explanation?: string;
  }>;
  question_images?: Array<{
    question_section: string;
    image?: {
      id: string;
      url: string;
      alt_text?: string;
      description?: string;
    };
  }>;
}

// Answer interface
export interface QuizAnswer {
  questionId: string;
  selectedOptionId: string;
  isCorrect: boolean;
  timestamp: number;
  timeSpent: number; // seconds
}

// Quiz state interface
export interface QuizState {
  // Session Info
  sessionId: string;
  status: "not_started" | "in_progress" | "completed";

  // Questions & Navigation
  questions: QuizQuestion[];
  currentQuestionIndex: number;
  totalQuestions: number;

  // Answers & Progress
  answers: Map<string, QuizAnswer>;
  progress: {
    answered: number;
    correct: number;
    incorrect: number;
    percentage: number;
  };

  // Timing
  startTime?: number;
  endTime?: number;
  totalTimeSpent: number;

  // Configuration
  config: {
    mode: "tutor" | "exam";
    timing: "timed" | "untimed";
    showExplanations: boolean;
    allowReview: boolean;
  };

  // Sync Status
  syncStatus: {
    lastSyncTime?: number;
    pendingChanges: boolean;
    isOnline: boolean;
  };
}

// Type for API question response (flexible structure from API)
export interface ApiQuestionResponse {
  id: string;
  stem?: string;
  text?: string;
  teaching_point?: string;
  explanation?: string;
  difficulty?: "easy" | "medium" | "hard";
  title?: string;
  question_references?: string;
  question_options?: Array<{
    id: string;
    text: string;
    is_correct?: boolean;
    isCorrect?: boolean;
    explanation?: string;
  }>;
  question_images?: unknown[];
  images?: unknown[];
  tags?: string[];
  category?: { name?: string } | string;
}

// Transformation utilities
export class QuizQuestionTransformer {
  /**
   * Transform API response to hybrid system format
   */
  static apiToHybrid(apiQuestion: ApiQuestionResponse): QuizQuestion {
    const options = apiQuestion.question_options || [];

    return {
      id: apiQuestion.id,
      text: apiQuestion.stem || apiQuestion.text || "",
      question_options: options.map((opt) => ({
        id: opt.id,
        text: opt.text,
        is_correct: opt.is_correct || opt.isCorrect || false,
        explanation: opt.explanation,
      })),
      explanation: apiQuestion.teaching_point || apiQuestion.explanation,
      category:
        typeof apiQuestion.category === "object"
          ? apiQuestion.category?.name || ""
          : apiQuestion.category,
      difficulty: apiQuestion.difficulty,
      metadata: {
        images: apiQuestion.question_images || apiQuestion.images || [],
        tags: apiQuestion.tags || [],
        originalData: apiQuestion,
      },
    };
  }

  /**
   * Transform hybrid system format to UI component format
   */
  static hybridToUI(hybridQuestion: QuizQuestion): UIQuizQuestion {
    const originalData = hybridQuestion.metadata?.originalData as ApiQuestionResponse | undefined;

    return {
      id: hybridQuestion.id,
      title: originalData?.title || "",
      stem: hybridQuestion.text,
      teaching_point: hybridQuestion.explanation,
      question_references: originalData?.question_references || "",
      question_options: hybridQuestion.question_options.map((opt) => ({
        id: opt.id,
        text: opt.text,
        is_correct: opt.is_correct,
        explanation: opt.explanation,
      })),
      question_images: (hybridQuestion.metadata?.images as UIQuizQuestion["question_images"]) || [],
    };
  }
}
