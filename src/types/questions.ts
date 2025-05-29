// src/types/questions.ts
import { Database } from './supabase';
import { QuestionSetData } from './question-sets';
import { ImageData } from './images';

// Database types
export type QuestionData = Database['public']['Tables']['questions']['Row'];
export type QuestionInsert = Database['public']['Tables']['questions']['Insert'];
export type QuestionUpdate = Database['public']['Tables']['questions']['Update'];

// Answer Options types
export type AnswerOptionData = Database['public']['Tables']['answer_options']['Row'];
export type AnswerOptionInsert = Database['public']['Tables']['answer_options']['Insert'];
export type AnswerOptionUpdate = Database['public']['Tables']['answer_options']['Update'];

// Question Images types
export type QuestionImageData = Database['public']['Tables']['question_images']['Row'];
export type QuestionImageInsert = Database['public']['Tables']['question_images']['Insert'];
export type QuestionImageUpdate = Database['public']['Tables']['question_images']['Update'];

// Additional types for tags and categories (not in current supabase.ts)
export interface TagData {
  id: string;
  name: string;
  created_at: string;
}

export interface CategoryData {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
  level: number;
  created_at: string;
}

export interface QuestionTagData {
  question_id: string;
  tag_id: string;
}

export interface QuestionCategoryData {
  question_id: string;
  category_id: string;
}

// Type definitions
export interface Category {
  id: number
  name: string
  level: number
  parent_id: number | null
  path: string
}

export interface Image {
  id: string
  url: string
  description: string
  alt_text: string
}

export type QuestionDifficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type QuestionYield = 'HIGH_YIELD' | 'MEDIUM_YIELD' | 'LOW_YIELD';

export interface Question {
  id: string
  body: string
  difficulty: QuestionDifficulty
  rank: QuestionYield
  categories: Category[]
  explanation: string
  reference_text: string | null
  images: Image[]
  created_at: string
  updated_at: string
}

// Enhanced question interfaces
export interface QuestionWithDetails extends QuestionData {
  question_set?: QuestionSetData;
  answer_options?: AnswerOptionData[];
  question_images?: (QuestionImageData & { image?: ImageData })[];
  tags?: TagData[];
  categories?: CategoryData[];
  created_by_name?: string;
}

export interface QuestionWithSet extends QuestionData {
  question_set?: QuestionSetData;
}

// Form data interfaces
export interface AnswerOptionFormData {
  id?: string;
  text: string;
  is_correct: boolean;
  explanation?: string;
  order_index: number;
}

export interface QuestionImageFormData {
  id?: string;
  image_id: string;
  question_section: 'question' | 'explanation';
  order_index: number;
}

export interface QuestionFormData {
  title: string;
  stem: string;
  difficulty: 'easy' | 'medium' | 'hard';
  teaching_point: string;
  question_references?: string;
  status: 'draft' | 'published' | 'archived';
  question_set_id?: string;
  answer_options: AnswerOptionFormData[];
  question_images: QuestionImageFormData[];
  tag_ids: string[];
  category_ids: string[];
}

// Interface for question filters including question set
export interface QuestionFilters {
  search?: string;
  difficulty?: string;
  status?: string;
  question_set_id?: string;
  created_by?: string;
  page?: number;
  pageSize?: number;
}

// Constants for UI display
export const DIFFICULTY_LABELS: Record<QuestionDifficulty, string> = {
  'EASY': 'Easy',
  'MEDIUM': 'Medium',
  'HARD': 'Hard'
};

export const YIELD_LABELS: Record<QuestionYield, string> = {
  'HIGH_YIELD': 'High Yield',
  'MEDIUM_YIELD': 'Medium Yield',
  'LOW_YIELD': 'Low Yield'
};

// Styling configurations
export const DIFFICULTY_CONFIG = {
  EASY: {
    color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
    short: 'E'
  },
  MEDIUM: {
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
    short: 'M'
  },
  HARD: {
    color: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
    short: 'H'
  }
} as const;

export const YIELD_CONFIG = {
  HIGH_YIELD: {
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
    short: 'HY'
  },
  MEDIUM_YIELD: {
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    short: 'MY'
  },
  LOW_YIELD: {
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300',
    short: 'LY'
  }
} as const;