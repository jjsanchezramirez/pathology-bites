// src/features/user/learn/types/index.ts

// =============================================================================
// LESSON CONTENT TYPES (stored as JSONB in lessons.content)
// =============================================================================

export interface LessonContent {
  version: 1;
  sections: LessonSection[];
  quiz?: LessonQuiz;
  ankiDeckRef?: string;
}

export type LessonSection =
  | TextSection
  | ImageSection
  | ExplainerSection
  | KeyPointsSection
  | ComparisonTableSection;

export interface TextSection {
  type: "text";
  id: string;
  heading?: string;
  blocks: TextBlock[];
}

export interface TextBlock {
  type: "paragraph" | "heading" | "list";
  content: string;
  listItems?: string[];
  emphasis?: "normal" | "highlight" | "warning";
}

export interface ImageSection {
  type: "image";
  id: string;
  heading?: string;
  imageIds: string[];
  caption?: string;
}

export interface ExplainerSection {
  type: "explainer";
  id: string;
  heading?: string;
  sequenceId: string;
  description?: string;
}

export interface KeyPointsSection {
  type: "key-points";
  id: string;
  heading?: string;
  points: string[];
}

export interface ComparisonTableSection {
  type: "comparison-table";
  id: string;
  heading?: string;
  headers: string[];
  rows: string[][];
}

// =============================================================================
// LESSON QUIZ (embedded in content JSON, not stored separately)
// =============================================================================

export interface LessonQuiz {
  questions: LessonQuizQuestion[];
}

export interface LessonQuizQuestion {
  id: string;
  stem: string;
  imageIds?: string[];
  options: { id: string; text: string }[];
  correctOptionId: string;
  explanation: string;
}
