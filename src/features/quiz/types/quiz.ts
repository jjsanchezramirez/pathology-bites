// src/features/quiz/types/quiz.ts
import { Database } from '@/shared/types/supabase'
import { QuestionWithDetails } from '@/features/questions/types/questions'

// Database types for quiz sessions
export type QuizSessionData = Database['public']['Tables']['quiz_sessions']['Row']
export type QuizSessionInsert = Database['public']['Tables']['quiz_sessions']['Insert']
export type QuizSessionUpdate = Database['public']['Tables']['quiz_sessions']['Update']

// Database types for quiz attempts
export type QuizAttemptData = Database['public']['Tables']['quiz_attempts']['Row']
export type QuizAttemptInsert = Database['public']['Tables']['quiz_attempts']['Insert']
export type QuizAttemptUpdate = Database['public']['Tables']['quiz_attempts']['Update']

// Quiz modes
export type QuizMode = 'tutor' | 'timed' | 'untimed' | 'practice' | 'review'

// Quiz difficulty settings
export type QuizDifficulty = 'easy' | 'medium' | 'hard' | 'mixed'

// Quiz status
export type QuizStatus = 'not_started' | 'in_progress' | 'completed' | 'paused' | 'abandoned'

// Quiz configuration interface
export interface QuizConfig {
  mode: QuizMode
  questionCount: number
  timeLimit?: number // in minutes, null for untimed
  timePerQuestion?: number // in seconds, for timed mode
  difficulty?: QuizDifficulty
  categories?: string[] // category IDs
  tags?: string[] // tag IDs
  questionSets?: string[] // question set IDs
  shuffleQuestions?: boolean
  shuffleAnswers?: boolean
  showExplanations?: boolean // for tutor mode
  allowReview?: boolean
  showProgress?: boolean
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
  attempts: QuizAttempt[]
  completedAt: string
}

// Quiz creation form data
export interface QuizCreationForm {
  title: string
  mode: QuizMode
  questionCount: number
  timeLimit?: number
  timePerQuestion?: number
  difficulty: QuizDifficulty
  selectedCategories: string[]
  selectedTags: string[]
  selectedQuestionSets: string[]
  shuffleQuestions: boolean
  shuffleAnswers: boolean
  showExplanations: boolean
  allowReview: boolean
  showProgress: boolean
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

// Quiz mode configurations
export const QUIZ_MODE_CONFIG = {
  tutor: {
    label: 'Tutor Mode',
    description: 'Get immediate feedback after each question',
    icon: '🎓',
    features: ['Immediate feedback', 'Explanations shown', 'No time pressure'],
    defaultConfig: {
      showExplanations: true,
      allowReview: true,
      showProgress: true,
      shuffleQuestions: true,
      shuffleAnswers: true
    }
  },
  timed: {
    label: 'Timed Mode',
    description: 'Test your knowledge under time pressure',
    icon: '⏱️',
    features: ['Time limits', 'Exam simulation', 'Performance tracking'],
    defaultConfig: {
      showExplanations: false,
      allowReview: false,
      showProgress: true,
      shuffleQuestions: true,
      shuffleAnswers: true,
      timePerQuestion: 90 // 90 seconds per question
    }
  },
  untimed: {
    label: 'Untimed Mode',
    description: 'Take your time to think through each question',
    icon: '🧠',
    features: ['No time pressure', 'Thorough review', 'Deep learning'],
    defaultConfig: {
      showExplanations: false,
      allowReview: true,
      showProgress: true,
      shuffleQuestions: true,
      shuffleAnswers: true
    }
  },
  practice: {
    label: 'Practice Mode',
    description: 'Focus on specific topics or weak areas',
    icon: '💪',
    features: ['Targeted practice', 'Adaptive difficulty', 'Progress tracking'],
    defaultConfig: {
      showExplanations: true,
      allowReview: true,
      showProgress: true,
      shuffleQuestions: false,
      shuffleAnswers: true
    }
  },
  review: {
    label: 'Review Mode',
    description: 'Review previous quiz attempts and explanations',
    icon: '📚',
    features: ['Previous attempts', 'Detailed explanations', 'Performance analysis'],
    defaultConfig: {
      showExplanations: true,
      allowReview: true,
      showProgress: true,
      shuffleQuestions: false,
      shuffleAnswers: false
    }
  }
} as const

// Quiz difficulty configurations
export const QUIZ_DIFFICULTY_CONFIG = {
  easy: {
    label: 'Easy',
    description: 'Fundamental concepts and basic knowledge',
    color: 'text-green-600 bg-green-100',
    icon: '🟢'
  },
  medium: {
    label: 'Medium',
    description: 'Intermediate concepts and clinical applications',
    color: 'text-yellow-600 bg-yellow-100',
    icon: '🟡'
  },
  hard: {
    label: 'Hard',
    description: 'Advanced concepts and complex cases',
    color: 'text-red-600 bg-red-100',
    icon: '🔴'
  },
  mixed: {
    label: 'Mixed',
    description: 'Combination of all difficulty levels',
    color: 'text-purple-600 bg-purple-100',
    icon: '🎯'
  }
} as const

// Default quiz configurations
export const DEFAULT_QUIZ_CONFIGS = {
  quickPractice: {
    mode: 'tutor' as QuizMode,
    questionCount: 10,
    difficulty: 'mixed' as QuizDifficulty,
    shuffleQuestions: true,
    shuffleAnswers: true,
    showExplanations: true,
    allowReview: true,
    showProgress: true
  },
  examSimulation: {
    mode: 'timed' as QuizMode,
    questionCount: 50,
    timeLimit: 75, // 75 minutes
    difficulty: 'mixed' as QuizDifficulty,
    shuffleQuestions: true,
    shuffleAnswers: true,
    showExplanations: false,
    allowReview: false,
    showProgress: true
  },
  focusedStudy: {
    mode: 'practice' as QuizMode,
    questionCount: 25,
    difficulty: 'medium' as QuizDifficulty,
    shuffleQuestions: false,
    shuffleAnswers: true,
    showExplanations: true,
    allowReview: true,
    showProgress: true
  }
}
