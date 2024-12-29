// src/types/questions.ts
export enum QuestionDifficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard'
}

export enum QuestionRank {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert'
}

export interface QuestionOption {
  id: string
  question_id: string
  option_text: string
  is_correct: boolean
  order: number
}

export interface Question {
  id: string
  body: string
  explanation: string | null
  reference_text: string | null
  difficulty: QuestionDifficulty
  rank: QuestionRank | null
  created_at: string
  updated_at: string
  options?: QuestionOption[]
  categories?: Category[]
  tags?: Tag[]
}

export interface Category {
  id: number
  parent_id: number | null
  name: string
  level: number
  path: string
  created_at: string
}

export interface Tag {
  id: string
  name: string
  created_at: string
}

export interface QuestionFilters {
  categories?: number[]
  tags?: string[]
  difficulty?: QuestionDifficulty
  rank?: QuestionRank
  search?: string
}

export interface QuestionFormData {
  body: string
  explanation?: string
  reference_text?: string
  difficulty: QuestionDifficulty
  rank?: QuestionRank
  options: {
    option_text: string
    is_correct: boolean
    order: number
  }[]
  category_ids: number[]
  tag_ids: string[]
}