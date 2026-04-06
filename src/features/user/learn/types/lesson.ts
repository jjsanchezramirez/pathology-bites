// src/features/user/learn/types/lesson.ts

import { LessonContent, LessonQuiz } from "./index";

// =============================================================================
// DATABASE ROW TYPES
// =============================================================================

export interface LearningSubject {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  category_id: string;
  cover_image_url: string | null;
  sort_order: number;
  status: "draft" | "published" | "archived";
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Lesson {
  id: string;
  subject_id: string;
  title: string;
  slug: string;
  description: string | null;
  content: LessonContent;
  content_markdown: string | null;
  quiz: LessonQuiz | null;
  anki_deck_ref: string | null;
  cover_image_url: string | null;
  sort_order: number;
  estimated_minutes: number | null;
  status: "draft" | "published" | "archived";
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserLessonProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  completed_at: string | null;
  quiz_score: number | null;
  last_accessed_at: string;
  created_at: string;
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface LearningSubjectWithCategory extends LearningSubject {
  category: {
    id: string;
    name: string;
    color: string | null;
    short_form: string | null;
  };
  lesson_count: number;
  completed_count?: number;
}

export interface LessonSummary {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  estimated_minutes: number | null;
  sort_order: number;
  is_completed?: boolean;
  quiz_score?: number | null;
}

export interface LessonWithProgress extends Lesson {
  progress: UserLessonProgress | null;
  subject: {
    id: string;
    title: string;
    slug: string;
    category_id: string;
  };
  prev_lesson: { slug: string; title: string } | null;
  next_lesson: { slug: string; title: string } | null;
}
