export type Difficulty = 'easy' | 'medium' | 'hard';
export type Yield = 'low' | 'medium' | 'high';

export interface Category {
  id: number;
  name: string;
  level: number;
  parent_id: number | null;
  path: string;
}

export interface Image {
  id: string;
  url: string;
  description: string;
  alt_text: string;
}

export interface Question {
  id: string;
  body: string;
  difficulty: Difficulty;
  yield: Yield;
  categories: Category[];
  explanation: string;
  reference_text: string | null;
  images: Image[];
  created_at: string;
  updated_at: string;
}

export interface QuestionFormData {
  body: string;
  difficulty: Difficulty;
  yield: Yield;
  categories: string[];
  explanation: string;
  reference_text?: string;
}

export const DIFFICULTY_LABELS = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard'
} as const;

export const YIELD_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High'
} as const;