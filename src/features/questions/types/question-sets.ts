// src/types/question-sets.ts
import { Database } from '@/shared/types/supabase';

// New types using the renamed 'sets' table
export type SetData = Database['public']['Tables']['question_sets']['Row'];
export type SetInsert = Database['public']['Tables']['question_sets']['Insert'];
export type SetUpdate = Database['public']['Tables']['question_sets']['Update'];

// Legacy type aliases for backward compatibility (to be removed after full migration)
export type QuestionSetData = SetData;
export type QuestionSetInsert = SetInsert;
export type QuestionSetUpdate = SetUpdate;

// Source details type definitions for different source types
export interface PathologyOutlinesSourceDetails {
  website: string;
  collection_type: string;
  coverage: string[];
}

export interface TextbookSourceDetails {
  book_title: string;
  edition?: string;
  authors?: string[];
  publisher?: string;
  isbn?: string;
}

export interface AIGeneratedSourceDetails {
  primary_model: string;
  generation_method: string;
  quality_control: string;
  topics: string[];
  difficulty_range: string[];
}

export interface ExpertGeneratedSourceDetails {
  review_process: string;
  expertise_level: string;
  quality_standards: string;
  target_audience: string[];
  validation: string;
}

export interface UserGeneratedSourceDetails {
  user_id?: string;
  creation_method?: string;
  review_status?: string;
}

export interface OtherSourceDetails {
  source_name?: string;
  description?: string;
  [key: string]: unknown;
}

// Union type for all possible source details
export type QuestionSetSourceDetails =
  | PathologyOutlinesSourceDetails
  | TextbookSourceDetails
  | AIGeneratedSourceDetails
  | ExpertGeneratedSourceDetails
  | UserGeneratedSourceDetails
  | OtherSourceDetails;

// Source type constants
export const QUESTION_SET_SOURCE_TYPES = {
  pathology_outlines: 'PathologyOutlines.com',
  textbook: 'Textbook',
  user_generated: 'User Generated',
  ai_generated: 'AI Generated',
  expert_generated: 'Expert Generated',
  other: 'Other'
} as const;

export type QuestionSetSourceType = keyof typeof QUESTION_SET_SOURCE_TYPES;

// Default question sets that should be created
export const DEFAULT_QUESTION_SETS = [
  {
    name: 'PathOutlines General Collection',
    description: 'Questions sourced from PathologyOutlines.com covering general pathology topics',
    source_type: 'pathology_outlines' as QuestionSetSourceType,
    source_details: {
      website: 'pathologyoutlines.com',
      collection_type: 'general',
      coverage: ['general_pathology', 'systemic_pathology', 'subspecialty_topics']
    }
  },
  {
    name: 'AI Generated Questions',
    description: 'Questions generated using artificial intelligence models for educational purposes',
    source_type: 'ai_generated' as QuestionSetSourceType,
    source_details: {
      primary_model: 'GPT-4',
      generation_method: 'structured_prompts',
      quality_control: 'expert_review',
      topics: ['histopathology', 'clinical_correlation', 'differential_diagnosis'],
      difficulty_range: ['easy', 'medium', 'hard']
    }
  },
  {
    name: 'Expert Generated Questions',
    description: 'High-quality questions written and reviewed by pathology experts and educators',
    source_type: 'expert_generated' as QuestionSetSourceType,
    source_details: {
      review_process: 'peer_reviewed',
      expertise_level: 'board_certified_pathologists',
      quality_standards: 'medical_education_guidelines',
      target_audience: ['residents', 'fellows', 'practicing_pathologists'],
      validation: 'clinical_correlation_verified'
    }
  }
] as const;

// Source type configurations for UI
export const SOURCE_TYPE_CONFIG = {
  'pathology_outlines': {
    label: 'PathologyOutlines.com',
    color: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800',
    description: 'Questions sourced from PathologyOutlines.com'
  },
  'textbook': {
    label: 'Textbook',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800',
    description: 'Questions from medical textbooks and publications'
  },
  'user_generated': {
    label: 'User Generated',
    color: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800',
    description: 'Questions created by platform users'
  },
  'ai_generated': {
    label: 'AI Generated',
    color: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800',
    description: 'Questions generated using artificial intelligence'
  },
  'expert_generated': {
    label: 'Expert Generated',
    color: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800',
    description: 'Questions created and reviewed by pathology experts'
  },
  'other': {
    label: 'Other',
    color: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300 dark:border-gray-800',
    description: 'Questions from other sources'
  },
  // Legacy support for existing data
  'AI-Generated': {
    label: 'AI Generated',
    color: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800',
    description: 'Questions generated using artificial intelligence'
  },
  'Web Resource': {
    label: 'Web Resource',
    color: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800',
    description: 'Questions sourced from web resources'
  },
  'Textbook': {
    label: 'Textbook',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800',
    description: 'Questions from medical textbooks and publications'
  },
  'Expert-Authored': {
    label: 'Expert Authored',
    color: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800',
    description: 'Questions authored by subject matter experts'
  },
  'User-Generated': {
    label: 'User Generated',
    color: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800',
    description: 'Questions created by platform users'
  },
  'Other': {
    label: 'Other',
    color: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/20 dark:text-gray-300 dark:border-gray-800',
    description: 'Questions from other sources'
  }
} as const;

// Interface for question set with related data
export interface QuestionSetWithStats extends QuestionSetData {
  question_count?: number;
  created_by_name?: string;
}

// Interface for question set filters
export interface QuestionSetFilters {
  source_type?: QuestionSetSourceType | 'all';
  is_active?: boolean;
  search?: string;
}

// Interface for question set form data
export interface QuestionSetFormData {
  name: string;
  description: string;
  source_type: QuestionSetSourceType;
  source_details: QuestionSetSourceDetails;
  is_active: boolean;
}

// Helper function to get source type configuration
export function getSourceTypeConfig(sourceType: QuestionSetSourceType) {
  return SOURCE_TYPE_CONFIG[sourceType] || SOURCE_TYPE_CONFIG.other;
}

// Helper function to format source details for display
export function formatSourceDetails(sourceType: QuestionSetSourceType, details: QuestionSetSourceDetails): string {
  if (!details || typeof details !== 'object') return '';

  switch (sourceType) {
    case 'textbook':
      const textbookDetails = details as TextbookSourceDetails;
      return textbookDetails.book_title ? `${textbookDetails.book_title}${textbookDetails.edition ? ` (${textbookDetails.edition})` : ''}` : '';
    case 'pathology_outlines':
      const pathologyDetails = details as PathologyOutlinesSourceDetails;
      return pathologyDetails.collection_type ? `Collection: ${pathologyDetails.collection_type}` : '';
    case 'ai_generated':
      const aiDetails = details as AIGeneratedSourceDetails;
      return aiDetails.primary_model ? `Model: ${aiDetails.primary_model}` : '';
    case 'expert_generated':
      const expertDetails = details as ExpertGeneratedSourceDetails;
      return expertDetails.expertise_level ? `Level: ${expertDetails.expertise_level}` : '';
    default:
      return '';
  }
}
