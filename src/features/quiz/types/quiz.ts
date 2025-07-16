// src/features/quiz/types/quiz.ts
import { Database } from '@/shared/types/supabase'
import { QuestionWithDetails } from '@/features/questions/types/questions'
import { QUIZ_LIMITS } from '@/shared/config/quiz-limits'

// Database types for quiz sessions
export type QuizSessionData = Database['public']['Tables']['quiz_sessions']['Row']
export type QuizSessionInsert = Database['public']['Tables']['quiz_sessions']['Insert']
export type QuizSessionUpdate = Database['public']['Tables']['quiz_sessions']['Update']

// Database types for quiz attempts
export type QuizAttemptData = Database['public']['Tables']['quiz_attempts']['Row']
export type QuizAttemptInsert = Database['public']['Tables']['quiz_attempts']['Insert']
export type QuizAttemptUpdate = Database['public']['Tables']['quiz_attempts']['Update']

// Quiz modes - simplified to binary options
export type QuizMode = 'tutor' | 'practice'
export type QuizTiming = 'timed' | 'untimed'

// Question types for filtering - using meaningful categories
export type QuestionType = 'all' | 'unused' | 'needsReview' | 'marked' | 'mastered'

// Category selection types
export type CategorySelection = 'all' | 'ap_only' | 'cp_only' | 'custom'

// Quiz status
export type QuizStatus = 'not_started' | 'in_progress' | 'completed' | 'paused' | 'abandoned'

// Quiz configuration interface - simplified
export interface QuizConfig {
  mode: QuizMode
  timing: QuizTiming
  questionCount: number
  questionType: QuestionType
  categorySelection: CategorySelection
  selectedCategories: string[] // category IDs when categorySelection is 'custom'
  shuffleQuestions: boolean
  shuffleAnswers: boolean
  showProgress: boolean
  // Derived from mode and timing
  showExplanations: boolean // true for tutor mode
  timePerQuestion?: number // set for timed mode (kept for backward compatibility)
  totalTimeLimit?: number // total time for entire quiz in seconds (for global timer)
}

// Quiz session interface
export interface QuizSession {
  id: string
  userId: string
  title: string
  config: QuizConfig
  questions: QuestionWithDetails[]
  currentQuestionIndex: number
  status: QuizStatus
  startedAt?: string
  completedAt?: string
  totalTimeSpent?: number // in seconds
  score?: number
  correctAnswers?: number
  totalQuestions: number
  // Global timer fields
  totalTimeLimit?: number // total time allowed for entire quiz in seconds
  timeRemaining?: number // time remaining for entire quiz in seconds
  quizStartedAt?: string // when the quiz timer actually started (for pause/resume)
  createdAt: string
  updatedAt: string
}

// Quiz attempt interface (for individual question attempts)
export interface QuizAttempt {
  id: string
  quizSessionId: string
  questionId: string
  selectedAnswerId?: string
  isCorrect?: boolean
  timeSpent?: number // in seconds
  attemptedAt: string
  reviewedAt?: string
}

// Quiz result interface
export interface QuizResult {
  sessionId: string
  score: number
  correctAnswers: number
  totalQuestions: number
  totalTimeSpent: number
  averageTimePerQuestion: number
  difficultyBreakdown: {
    easy: { correct: number; total: number }
    medium: { correct: number; total: number }
    hard: { correct: number; total: number }
  }
  categoryBreakdown: Array<{
    categoryId: string
    categoryName: string
    correct: number
    total: number
  }>
  questionDetails: Array<{
    id: string
    title: string
    stem: string
    difficulty: string
    category: string
    isCorrect: boolean
    selectedAnswerId: string | null
    timeSpent: number
    successRate: number
  }>
  attempts: QuizAttempt[]
  completedAt: string
}

// Quiz creation form data - simplified
export interface QuizCreationForm {
  title?: string // Optional - will be auto-generated if not provided
  mode: QuizMode
  timing: QuizTiming
  questionCount: number
  questionType: QuestionType
  categorySelection: CategorySelection
  selectedCategories: string[] // only used when categorySelection is 'custom'
  shuffleQuestions: boolean
  shuffleAnswers: boolean
  showProgress: boolean
}

// Question type statistics - using meaningful categories
export interface QuestionTypeStats {
  all: number
  unused: number
  needsReview: number  // Questions with any incorrect attempts
  marked: number
  mastered: number     // Questions with only correct attempts
}

// Category with question counts by type
export interface CategoryWithStats {
  id: string
  name: string
  shortName: string
  questionStats: QuestionTypeStats
}



// Quiz statistics interface
export interface QuizStats {
  totalQuizzes: number
  completedQuizzes: number
  averageScore: number
  totalTimeSpent: number
  currentStreak: number
  longestStreak: number
  favoriteCategories: Array<{
    categoryId: string
    categoryName: string
    quizCount: number
    averageScore: number
  }>
  recentPerformance: Array<{
    date: string
    score: number
    quizCount: number
  }>
  difficultyStats: {
    easy: { attempted: number; correct: number; averageScore: number }
    medium: { attempted: number; correct: number; averageScore: number }
    hard: { attempted: number; correct: number; averageScore: number }
  }
}

// Quiz mode configurations - simplified binary options
export const QUIZ_MODE_CONFIG = {
  tutor: {
    label: 'Tutor',
    description: 'Get immediate feedback and explanations after each question',
    showExplanations: true
  },
  practice: {
    label: 'Practice',
    description: 'Test yourself without immediate feedback',
    showExplanations: false
  }
} as const

export const QUIZ_TIMING_CONFIG = {
  timed: {
    label: 'Timed',
    description: `Test your knowledge under global time pressure (${QUIZ_LIMITS.secondsPerQuestion} seconds per question total)`,
    timePerQuestion: QUIZ_LIMITS.secondsPerQuestion,
    calculateTotalTime: (questionCount: number) => questionCount * QUIZ_LIMITS.secondsPerQuestion
  },
  untimed: {
    label: 'Untimed',
    description: 'Take your time to think through each question',
    timePerQuestion: undefined,
    calculateTotalTime: () => undefined
  }
} as const

export const QUESTION_TYPE_CONFIG = {
  all: {
    label: 'All Questions',
    description: 'Include all available questions'
  },
  unused: {
    label: 'Unused Questions',
    description: 'Questions you haven\'t attempted yet'
  },
  needsReview: {
    label: 'Needs Review',
    description: 'Questions you got wrong at least once'
  },
  marked: {
    label: 'Marked Questions',
    description: 'Questions you marked for review'
  },
  mastered: {
    label: 'Mastered Questions',
    description: 'Questions you consistently answer correctly'
  }
} as const

export const CATEGORY_SELECTION_CONFIG = {
  all: {
    label: 'All Categories',
    description: 'Include questions from all AP and CP categories'
  },
  ap_only: {
    label: 'AP Only',
    description: 'Include only Anatomic Pathology questions'
  },
  cp_only: {
    label: 'CP Only',
    description: 'Include only Clinical Pathology questions'
  },
  custom: {
    label: 'Custom',
    description: 'Choose specific categories'
  }
} as const

// Default quiz configuration
export const DEFAULT_QUIZ_CONFIG: QuizCreationForm = {
  mode: 'practice',
  timing: 'untimed',
  questionCount: 10,
  questionType: 'unused',  // Start with unused questions by default
  categorySelection: 'all',
  selectedCategories: [],
  shuffleQuestions: true,
  shuffleAnswers: true,
  showProgress: true
}
