// src/features/learning-modules/types/learning-modules.ts

// ============================================================================
// DATABASE TYPES
// ============================================================================

export interface LearningModuleData {
  id: string
  parent_module_id?: string
  category_id: string
  title: string
  slug: string
  description?: string
  content?: string
  learning_objectives?: string[]
  difficulty_level: 'beginner' | 'intermediate' | 'advanced'
  estimated_duration_minutes: number
  sort_order: number
  content_type: 'text' | 'video' | 'interactive' | 'mixed'
  external_content_url?: string
  quiz_id?: string
  icon_key?: string
  status: 'draft' | 'review' | 'published' | 'archived'
  is_featured: boolean
  published_at?: string
  created_by?: string
  reviewed_by?: string
  view_count: number
  average_completion_time_minutes?: number
  average_rating?: number
  rating_count: number
  created_at: string
  updated_at: string
}

export interface LearningPathData {
  id: number
  title: string
  slug: string
  description?: string
  difficulty_level?: 'beginner' | 'intermediate' | 'advanced'
  estimated_total_duration_minutes?: number
  learning_objectives?: string[]
  prerequisites?: string[]
  target_audience?: string
  thumbnail_image_id?: string
  category_id?: string
  icon_key?: string
  tags?: string[]
  status: 'draft' | 'published' | 'archived'
  is_featured: boolean
  published_at?: string
  enrollment_count: number
  completion_count: number
  average_rating?: number
  rating_count: number
  created_by?: string
  created_at: string
  updated_at: string
}

export interface LearningPathModuleData {
  id: string
  learning_path_id: number
  module_id: string
  sort_order: number
  is_required: boolean
  unlock_criteria?: {
    prerequisite_modules?: string[]
    minimum_score?: number
    time_delay_days?: number
  }
  custom_description?: string
  estimated_duration_override?: number
  created_at: string
}

export interface UserLearningPathEnrollmentData {
  id: string
  user_id: string
  learning_path_id: number
  status: 'active' | 'completed' | 'paused' | 'dropped'
  enrolled_at: string
  started_at?: string
  completed_at?: string
  last_accessed_at?: string
  current_module_id?: string
  modules_completed: number
  total_modules?: number
  progress_percentage: number
  total_time_minutes: number
  average_score?: number
  created_at: string
  updated_at: string
}

export interface ModuleSessionData {
  id: string
  user_id: string
  module_id: string
  started_at: string
  ended_at?: string
  duration_minutes?: number
  sections_viewed?: string[]
  completion_percentage: number
  accessed_via: 'learning_path' | 'direct' | 'search' | 'recommendation'
  learning_path_id?: number
  user_agent?: string
  ip_address?: string
  created_at: string
}

export interface ModuleAttemptData {
  id: string
  user_id: string
  module_id: string
  attempt_number: number
  started_at: string
  completed_at?: string
  time_spent_minutes?: number
  completion_status: 'in_progress' | 'completed' | 'failed' | 'abandoned'
  assessment_score?: number
  quiz_attempt_id?: string
  self_rating?: number
  confidence_level?: number
  feedback?: string
  found_helpful?: boolean
  learning_path_id?: number
  prerequisite_check_passed: boolean
  created_at: string
  updated_at: string
}

export interface ModuleImageData {
  id: string
  module_id: string
  image_id: string
  usage_type: 'header' | 'content' | 'diagram' | 'example' | 'thumbnail'
  sort_order: number
  caption?: string
  alt_text?: string
  content_section?: string
  created_at: string
}

export interface ModulePrerequisiteData {
  id: string
  module_id: string
  prerequisite_module_id: string
  requirement_type: 'required' | 'recommended' | 'optional'
  minimum_score?: number
  created_at: string
}

// ============================================================================
// ENHANCED TYPES WITH RELATIONS
// ============================================================================

export interface LearningModule extends LearningModuleData {
  // Relations
  category?: {
    id: string
    name: string
    color?: string
  }
  parent_module?: LearningModuleData
  child_modules?: LearningModuleData[]
  images?: (ModuleImageData & {
    image?: {
      id: string
      url: string
      alt_text?: string
      description?: string
    }
  })[]
  prerequisites?: (ModulePrerequisiteData & {
    prerequisite_module?: LearningModuleData
  })[]
  quiz?: {
    id: string
    title?: string
    question_count?: number
  }
  
  // User-specific data (when authenticated)
  user_progress?: {
    sessions: ModuleSessionData[]
    attempts: ModuleAttemptData[]
    latest_attempt?: ModuleAttemptData
    is_completed: boolean
    best_score?: number
    total_time_spent: number
  }
}

export interface LearningPath extends LearningPathData {
  // Relations
  modules?: (LearningPathModuleData & {
    module?: LearningModule
  })[]
  category?: {
    id: string
    name: string
    color?: string
  }
  thumbnail_image?: {
    id: string
    url: string
    alt_text?: string
  }
  
  // User-specific data (when authenticated)
  user_enrollment?: UserLearningPathEnrollmentData
}

// ============================================================================
// FORM TYPES
// ============================================================================

export interface LearningModuleFormData {
  title: string
  slug?: string
  description?: string
  content?: string
  learning_objectives?: string[]
  difficulty_level: 'beginner' | 'intermediate' | 'advanced'
  estimated_duration_minutes: number
  content_type: 'text' | 'video' | 'interactive' | 'mixed'
  external_content_url?: string
  category_id: string
  parent_module_id?: string
  quiz_id?: string
  icon_key?: string
  is_featured?: boolean
  image_ids?: string[]
  prerequisite_module_ids?: string[]
}

export interface LearningPathFormData {
  title: string
  slug?: string
  description?: string
  difficulty_level?: 'beginner' | 'intermediate' | 'advanced'
  learning_objectives?: string[]
  prerequisites?: string[]
  target_audience?: string
  category_id?: string
  thumbnail_image_id?: string
  icon_key?: string
  tags?: string[]
  is_featured?: boolean
  modules?: {
    module_id: string
    sort_order: number
    is_required: boolean
    unlock_criteria?: LearningPathModuleData['unlock_criteria']
    custom_description?: string
  }[]
}

// ============================================================================
// API TYPES
// ============================================================================

export interface LearningModuleFilters {
  category_id?: string
  difficulty_level?: 'beginner' | 'intermediate' | 'advanced'
  content_type?: 'text' | 'video' | 'interactive' | 'mixed'
  status?: 'draft' | 'review' | 'published' | 'archived'
  is_featured?: boolean
  parent_module_id?: string | null
  search?: string
  page?: number
  limit?: number
}

export interface LearningPathFilters {
  category_id?: string
  difficulty_level?: 'beginner' | 'intermediate' | 'advanced'
  status?: 'draft' | 'published' | 'archived'
  is_featured?: boolean
  search?: string
  page?: number
  limit?: number
}

export interface ModuleProgressUpdate {
  sections_viewed?: string[]
  completion_percentage?: number
  self_rating?: number
  confidence_level?: number
  feedback?: string
  found_helpful?: boolean
}

// ============================================================================
// ANALYTICS TYPES
// ============================================================================

export interface ModuleAnalytics {
  module_id: string
  total_sessions: number
  unique_users: number
  average_completion_time: number
  completion_rate: number
  average_rating: number
  rating_count: number
  bounce_rate: number
  popular_sections: string[]
  common_feedback_themes: string[]
}

export interface LearningPathAnalytics {
  path_id: number
  enrollment_count: number
  completion_count: number
  completion_rate: number
  average_completion_time: number
  dropout_points: {
    module_id: string
    module_title: string
    dropout_rate: number
  }[]
  user_satisfaction: number
  most_difficult_modules: {
    module_id: string
    module_title: string
    average_attempts: number
    average_score: number
  }[]
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type ModuleStatus = LearningModuleData['status']
export type PathStatus = LearningPathData['status']
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced'
export type ContentType = 'text' | 'video' | 'interactive' | 'mixed'
export type EnrollmentStatus = 'active' | 'completed' | 'paused' | 'dropped'
export type CompletionStatus = 'in_progress' | 'completed' | 'failed' | 'abandoned'

// ============================================================================
// CONSTANTS
// ============================================================================

export const DIFFICULTY_LEVELS: Record<DifficultyLevel, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced'
}

export const CONTENT_TYPES: Record<ContentType, string> = {
  text: 'Text Content',
  video: 'Video Content',
  interactive: 'Interactive Content',
  mixed: 'Mixed Content'
}

export const MODULE_STATUSES: Record<ModuleStatus, string> = {
  draft: 'Draft',
  review: 'Under Review',
  published: 'Published',
  archived: 'Archived'
}

export const PATH_STATUSES: Record<PathStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived'
}
