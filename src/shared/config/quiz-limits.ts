// src/shared/config/quiz-limits.ts
// Configuration for quiz limits and constraints

export interface QuizLimits {
  maxQuestionsPerQuiz: number
  minQuestionsPerQuiz: number
  maxQuizzesPerDay: number
  maxQuestionsPerDay: number
  secondsPerQuestion: number
}

// Default values (fallbacks if env vars are not set)
const DEFAULT_LIMITS: QuizLimits = {
  maxQuestionsPerQuiz: 50,
  minQuestionsPerQuiz: 5,
  maxQuizzesPerDay: 50,
  maxQuestionsPerDay: 100,
  secondsPerQuestion: 60
}

// Parse environment variables with fallbacks
function parseEnvNumber(envVar: string | undefined, defaultValue: number): number {
  if (!envVar) return defaultValue
  const parsed = parseInt(envVar, 10)
  return isNaN(parsed) ? defaultValue : parsed
}

// Get quiz limits from environment variables
export function getQuizLimits(): QuizLimits {
  return {
    maxQuestionsPerQuiz: parseEnvNumber(
      process.env.NEXT_PUBLIC_MAX_QUESTIONS_PER_QUIZ,
      DEFAULT_LIMITS.maxQuestionsPerQuiz
    ),
    minQuestionsPerQuiz: parseEnvNumber(
      process.env.NEXT_PUBLIC_MIN_QUESTIONS_PER_QUIZ,
      DEFAULT_LIMITS.minQuestionsPerQuiz
    ),
    maxQuizzesPerDay: parseEnvNumber(
      process.env.NEXT_PUBLIC_MAX_QUIZZES_PER_DAY,
      DEFAULT_LIMITS.maxQuizzesPerDay
    ),
    maxQuestionsPerDay: parseEnvNumber(
      process.env.NEXT_PUBLIC_MAX_QUESTIONS_PER_DAY,
      DEFAULT_LIMITS.maxQuestionsPerDay
    ),
    secondsPerQuestion: parseEnvNumber(
      process.env.NEXT_PUBLIC_SECONDS_PER_QUESTION,
      DEFAULT_LIMITS.secondsPerQuestion
    )
  }
}

// Export singleton instance
export const QUIZ_LIMITS = getQuizLimits()

// Helper functions for common validations
export function isValidQuestionCount(count: number): boolean {
  return count >= QUIZ_LIMITS.minQuestionsPerQuiz && count <= QUIZ_LIMITS.maxQuestionsPerQuiz
}

export function getValidQuestionCount(count: number): number {
  return Math.max(
    QUIZ_LIMITS.minQuestionsPerQuiz,
    Math.min(count, QUIZ_LIMITS.maxQuestionsPerQuiz)
  )
}

export function getQuestionCountOptions(): number[] {
  const limits = getQuizLimits()
  const options = [5, 10, 25, 50]
  
  // Filter options to only include valid counts within limits
  return options.filter(option => 
    option >= limits.minQuestionsPerQuiz && option <= limits.maxQuestionsPerQuiz
  )
}

// Calculate quiz time based on question count and timing
export function calculateQuizTime(questionCount: number, isTimed: boolean): number {
  if (!isTimed) return 0
  return questionCount * QUIZ_LIMITS.secondsPerQuestion
}

// Format time in minutes and seconds
export function formatQuizTime(seconds: number): string {
  if (seconds === 0) return 'Untimed'
  
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  
  if (minutes === 0) {
    return `${remainingSeconds}s`
  } else if (remainingSeconds === 0) {
    return `${minutes}m`
  } else {
    return `${minutes}m ${remainingSeconds}s`
  }
}

export default QUIZ_LIMITS
