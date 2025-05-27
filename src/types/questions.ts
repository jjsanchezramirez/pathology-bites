// src/types/questions.ts
import { Database } from './supabase';
import { QuestionSetData } from './question-sets';

// Database types
export type QuestionData = Database['public']['Tables']['questions']['Row'];
export type QuestionInsert = Database['public']['Tables']['questions']['Insert'];
export type QuestionUpdate = Database['public']['Tables']['questions']['Update'];

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

// Enhanced question interface with question set data
export interface QuestionWithSet extends QuestionData {
  question_set?: QuestionSetData;
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