// src/lib/types/questions.ts
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
    difficulty: 'EASY' | 'MEDIUM' | 'HARD';
    rank: 'HIGH_YIELD' | 'MEDIUM_YIELD' | 'LOW_YIELD';
    categories: Category[];
    explanation: string;
    reference_text: string | null;
    images: Image[];
    created_at: string;
    updated_at: string;
  }