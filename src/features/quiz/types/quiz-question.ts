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
  options: QuizQuestionOption[];
  explanation?: string; // Teaching point
  category?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  metadata?: {
    images?: any[];
    tags?: string[];
    originalData?: any; // Preserve original API data
  };
}

// UI-compatible quiz question interface (for components)
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
  timeSpent: number; // milliseconds
}

// Quiz state interface
export interface QuizState {
  // Session Info
  sessionId: string;
  status: 'not_started' | 'in_progress' | 'paused' | 'completed';
  
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
    mode: 'tutor' | 'exam';
    timing: 'timed' | 'untimed';
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

// Transformation utilities
export class QuizQuestionTransformer {
  /**
   * Transform API response to hybrid system format
   */
  static apiToHybrid(apiQuestion: any): QuizQuestion {
    return {
      id: apiQuestion.id,
      text: apiQuestion.stem || apiQuestion.text,
      options: (apiQuestion.question_options || []).map((opt: any) => ({
        id: opt.id,
        text: opt.text,
        is_correct: opt.is_correct || opt.isCorrect,
        explanation: opt.explanation
      })),
      explanation: apiQuestion.teaching_point || apiQuestion.explanation,
      category: apiQuestion.category?.name || apiQuestion.category,
      difficulty: apiQuestion.difficulty,
      metadata: {
        images: apiQuestion.question_images || apiQuestion.images || [],
        tags: apiQuestion.tags || [],
        originalData: {
          ...apiQuestion,
          title: apiQuestion.title,
          question_references: apiQuestion.question_references
        }
      }
    };
  }

  /**
   * Transform hybrid system format to UI component format
   */
  static hybridToUI(hybridQuestion: QuizQuestion): UIQuizQuestion {
    return {
      id: hybridQuestion.id,
      title: hybridQuestion.metadata?.originalData?.title || '',
      stem: hybridQuestion.text,
      teaching_point: hybridQuestion.explanation,
      question_references: hybridQuestion.metadata?.originalData?.question_references || '',
      question_options: hybridQuestion.options.map(opt => ({
        id: opt.id,
        text: opt.text,
        is_correct: opt.is_correct,
        explanation: opt.explanation
      })),
      question_images: hybridQuestion.metadata?.images || []
    };
  }
}
