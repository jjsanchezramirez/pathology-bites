/**
 * Database Type Constants and Utilities
 * 
 * This file provides type-safe constants and utilities for database operations.
 * Use these instead of hardcoded strings throughout the application.
 */

import { Database } from '@/shared/types/supabase'

// =============================================================================
// TABLE NAME CONSTANTS
// =============================================================================

export const TABLE_NAMES = {
  // Core tables
  USERS: 'users',
  QUESTIONS: 'questions',
  QUIZ_SESSIONS: 'quiz_sessions',
  QUIZ_ATTEMPTS: 'quiz_attempts',
  CATEGORIES: 'categories',
  IMAGES: 'images',
  QUESTION_OPTIONS: 'question_options',
  QUESTION_IMAGES: 'question_images',
  
  // User data tables
  USER_FAVORITES: 'user_favorites',
  USER_ACHIEVEMENTS: 'user_achievements',
  PERFORMANCE_ANALYTICS: 'performance_analytics',
  
  // System tables
  QUESTION_REPORTS: 'question_reports',
  NOTIFICATION_STATES: 'notification_states',
  TAGS: 'tags',
  QUESTION_TAGS: 'question_tags',
  
  // Learning modules
  LEARNING_MODULES: 'learning_modules',
  MODULE_SESSIONS: 'module_sessions',
  MODULE_ATTEMPTS: 'module_attempts',
  
  // Question sets
  QUESTION_SETS: 'question_sets',

  // Additional tables
  INQUIRIES: 'inquiries'
} as const

// =============================================================================
// ENUM VALUE CONSTANTS
// =============================================================================

export const QUESTION_STATUSES: Database['public']['Enums']['question_status'][] = [
  'draft',
  'pending_review',
  'rejected',
  'published',
  'flagged',
  'archived'
] as const

export const USER_ROLES: Database['public']['Enums']['user_role'][] = [
  'admin',
  'creator', 
  'reviewer',
  'user'
] as const

export const USER_STATUSES: Database['public']['Enums']['user_status'][] = [
  'active',
  'inactive',
  'suspended'
] as const

export const USER_TYPES: Database['public']['Enums']['user_type'][] = [
  'student',
  'resident',
  'faculty',
  'other'
] as const

export const DIFFICULTY_LEVELS: Database['public']['Enums']['difficulty_level'][] = [
  'easy',
  'medium',
  'hard'
] as const

export const SESSION_STATUSES: Database['public']['Enums']['session_status'][] = [
  'not_started',
  'in_progress',
  'completed',
  'abandoned'
] as const

export const IMAGE_CATEGORIES: Database['public']['Enums']['image_category'][] = [
  'microscopic',
  'gross',
  'figure',
  'table',
  'external'
] as const

export const REPORT_TYPES: Database['public']['Enums']['report_type'][] = [
  'incorrect_answer',
  'unclear_explanation',
  'broken_image',
  'inappropriate_content',
  'other'
] as const

// =============================================================================
// TYPE GUARDS
// =============================================================================

export const isQuestionStatus = (value: string): value is Database['public']['Enums']['question_status'] => {
  return QUESTION_STATUSES.includes(value as Database['public']['Enums']['question_status'])
}

export const isUserRole = (value: string): value is Database['public']['Enums']['user_role'] => {
  return USER_ROLES.includes(value as Database['public']['Enums']['user_role'])
}

export const isUserStatus = (value: string): value is Database['public']['Enums']['user_status'] => {
  return USER_STATUSES.includes(value as Database['public']['Enums']['user_status'])
}

export const isUserType = (value: string): value is Database['public']['Enums']['user_type'] => {
  return USER_TYPES.includes(value as Database['public']['Enums']['user_type'])
}

export const isDifficultyLevel = (value: string): value is Database['public']['Enums']['difficulty_level'] => {
  return DIFFICULTY_LEVELS.includes(value as Database['public']['Enums']['difficulty_level'])
}

export const isSessionStatus = (value: string): value is Database['public']['Enums']['session_status'] => {
  return SESSION_STATUSES.includes(value as Database['public']['Enums']['session_status'])
}

export const isImageCategory = (value: string): value is Database['public']['Enums']['image_category'] => {
  return IMAGE_CATEGORIES.includes(value as Database['public']['Enums']['image_category'])
}

export const isReportType = (value: string): value is Database['public']['Enums']['report_type'] => {
  return REPORT_TYPES.includes(value as Database['public']['Enums']['report_type'])
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get display label for question status
 */
export const getQuestionStatusLabel = (status: Database['public']['Enums']['question_status']): string => {
  const labels: Record<Database['public']['Enums']['question_status'], string> = {
    draft: 'Draft',
    pending_review: 'Pending Review',
    rejected: 'Rejected',
    published: 'Published',
    flagged: 'Flagged',
    archived: 'Archived'
  }
  return labels[status]
}

/**
 * Get display label for user role
 */
export const getUserRoleLabel = (role: Database['public']['Enums']['user_role']): string => {
  const labels: Record<Database['public']['Enums']['user_role'], string> = {
    admin: 'Administrator',
    creator: 'Content Creator',
    reviewer: 'Reviewer',
    user: 'User'
  }
  return labels[role]
}

/**
 * Get display label for difficulty level
 */
export const getDifficultyLabel = (difficulty: Database['public']['Enums']['difficulty_level']): string => {
  const labels: Record<Database['public']['Enums']['difficulty_level'], string> = {
    easy: 'Easy',
    medium: 'Medium',
    hard: 'Hard'
  }
  return labels[difficulty]
}

/**
 * Get display label for session status
 */
export const getSessionStatusLabel = (status: Database['public']['Enums']['session_status']): string => {
  const labels: Record<Database['public']['Enums']['session_status'], string> = {
    not_started: 'Not Started',
    in_progress: 'In Progress',
    completed: 'Completed',
    abandoned: 'Abandoned'
  }
  return labels[status]
}

// =============================================================================
// TYPE ALIASES FOR CONVENIENCE
// =============================================================================

export type QuestionStatus = Database['public']['Enums']['question_status']
export type UserRole = Database['public']['Enums']['user_role']
export type UserStatus = Database['public']['Enums']['user_status']
export type UserType = Database['public']['Enums']['user_type']
export type DifficultyLevel = Database['public']['Enums']['difficulty_level']
export type SessionStatus = Database['public']['Enums']['session_status']
export type ImageCategory = Database['public']['Enums']['image_category']
export type ReportType = Database['public']['Enums']['report_type']

// Table row types
export type UserRow = Database['public']['Tables']['users']['Row']
export type QuestionRow = Database['public']['Tables']['questions']['Row']
export type QuizSessionRow = Database['public']['Tables']['quiz_sessions']['Row']
export type CategoryRow = Database['public']['Tables']['categories']['Row']
export type ImageRow = Database['public']['Tables']['images']['Row']

// Insert types
export type UserInsert = Database['public']['Tables']['users']['Insert']
export type QuestionInsert = Database['public']['Tables']['questions']['Insert']
export type QuizSessionInsert = Database['public']['Tables']['quiz_sessions']['Insert']

// Update types
export type UserUpdate = Database['public']['Tables']['users']['Update']
export type QuestionUpdate = Database['public']['Tables']['questions']['Update']
export type QuizSessionUpdate = Database['public']['Tables']['quiz_sessions']['Update']
