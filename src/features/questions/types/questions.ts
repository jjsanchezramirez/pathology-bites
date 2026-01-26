// src/types/questions.ts
import { Database } from "@/shared/types/supabase";
import { SetData } from "./question-sets";
import { ImageData } from "@/features/images/types/images";

// Database types
export type QuestionData = Database["public"]["Tables"]["questions"]["Row"];
export type QuestionInsert = Database["public"]["Tables"]["questions"]["Insert"];
export type QuestionUpdate = Database["public"]["Tables"]["questions"]["Update"];

// Question Options types (formerly Answer Options)
export type QuestionOptionData = Database["public"]["Tables"]["question_options"]["Row"];
export type QuestionOptionInsert = Database["public"]["Tables"]["question_options"]["Insert"];
export type QuestionOptionUpdate = Database["public"]["Tables"]["question_options"]["Update"];

// Question Images types
export type QuestionImageData = Database["public"]["Tables"]["question_images"]["Row"];
export type QuestionImageInsert = Database["public"]["Tables"]["question_images"]["Insert"];
export type QuestionImageUpdate = Database["public"]["Tables"]["question_images"]["Update"];

// Question Analytics types
export type QuestionAnalyticsData = Database["public"]["Tables"]["question_analytics"]["Row"];
export type QuestionAnalyticsInsert = Database["public"]["Tables"]["question_analytics"]["Insert"];
export type QuestionAnalyticsUpdate = Database["public"]["Tables"]["question_analytics"]["Update"];

// Additional types for tags and categories (not in current supabase.ts)
export interface TagData {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  created_at: string;
}

export interface CategoryData {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
  level: number;
  color?: string | null;
  short_form?: string | null;
  created_at: string;
}

export interface QuestionTagData {
  question_id: string;
  tag_id: string;
}

// Type definitions
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

export type QuestionDifficulty = "EASY" | "MEDIUM" | "HARD";
export type QuestionYield = "HIGH_YIELD" | "MEDIUM_YIELD" | "LOW_YIELD";

export interface Question {
  id: string;
  body: string;
  difficulty: QuestionDifficulty;
  rank: QuestionYield;
  categories: Category[];
  explanation: string;
  reference_text: string | null;
  images: Image[];
  created_at: string;
  updated_at: string;
}

// Enhanced question interfaces - using Omit to make optional fields work correctly
export interface QuestionWithDetails extends Omit<
  QuestionData,
  "version_major" | "version_minor" | "version_patch"
> {
  set?: SetData; // Renamed from question_set to match actual Supabase join alias
  category?: CategoryData; // Single category object (from API join)
  question_options?: QuestionOptionData[];
  question_images?: (QuestionImageData & {
    images?: ImageData; // Actual Supabase response format
  })[];
  tags?: TagData[];
  analytics?: QuestionAnalyticsData;
  created_by_name?: string;
  updated_by_name?: string;
  image_count?: number;
  flag_count?: number;
  latest_flag_date?: string;
  version_major?: number;
  version_minor?: number;
  version_patch?: number;
}

export interface QuestionWithSet extends QuestionData {
  set?: SetData;
}

// Form data interfaces
export interface QuestionOptionFormData {
  id?: string;
  text: string;
  is_correct: boolean;
  explanation?: string;
  order_index: number;
}

export interface QuestionImageFormData {
  id?: string;
  image_id: string;
  question_section: "stem" | "explanation";
  order_index: number;
}

export interface QuestionFormData {
  title: string;
  stem: string;
  difficulty: Database["public"]["Enums"]["difficulty_level"];
  teaching_point: string;
  question_references?: string;
  status: Database["public"]["Enums"]["question_status"];
  question_set_id?: string;
  category_id?: string; // Single category ID since each question has only one category
  lesson?: string; // Lesson or subject area (e.g., "Bone Tumors")
  topic?: string; // Specific topic within the lesson (e.g., "Osteosarcoma")
  anki_card_id?: number | null;
  anki_deck_name?: string | null;
  question_options: QuestionOptionFormData[];
  question_images: QuestionImageFormData[];
  tag_ids: string[];
}

// Interface for question filters including question set
export interface QuestionFiltersData {
  search?: string;
  difficulty?: string;
  status?: string;
  question_set_id?: string;
  created_by?: string;
  page?: number;
  pageSize?: number;
}

// Styling configurations
export const DIFFICULTY_CONFIG = {
  EASY: {
    color: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
    short: "E",
  },
  MEDIUM: {
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300",
    short: "M",
  },
  HARD: {
    color: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
    short: "H",
  },
} as const;

// Review and workflow types - ALIGNED WITH DATABASE
export type ReviewAction = "approve" | "request_changes" | "reject" | "flagged";
export type QuestionStatus = Database["public"]["Enums"]["question_status"];
export type FlagType =
  | "incorrect_answer"
  | "unclear_question"
  | "outdated_content"
  | "incorrect_explanations"
  | "other";
export type FlagStatus = "open" | "closed";
export type FlagResolutionType = "fixed" | "dismissed";

// Versioning types
export type UpdateType = "patch" | "minor" | "major";

export interface QuestionVersionInfo {
  version_major: number;
  version_minor: number;
  version_patch: number;
}

export interface QuestionVersionHistory {
  id: string;
  question_id: string;
  version_major: number;
  version_minor: number;
  version_patch: number;
  question_data: unknown; // JSONB data
  update_type: UpdateType;
  change_summary?: string;
  changed_by: string;
  created_at: string;
  changer?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

// Database types for new tables
export type QuestionReviewData = Database["public"]["Tables"]["question_reviews"]["Row"];
export type QuestionReviewInsert = Database["public"]["Tables"]["question_reviews"]["Insert"];
export type QuestionReviewUpdate = Database["public"]["Tables"]["question_reviews"]["Update"];

export type QuestionVersionData = Database["public"]["Tables"]["question_versions"]["Row"];
export type QuestionVersionInsert = Database["public"]["Tables"]["question_versions"]["Insert"];
export type QuestionVersionUpdate = Database["public"]["Tables"]["question_versions"]["Update"];

export type QuestionFlagData = Database["public"]["Tables"]["question_flags"]["Row"];
export type QuestionFlagInsert = Database["public"]["Tables"]["question_flags"]["Insert"];
export type QuestionFlagUpdate = Database["public"]["Tables"]["question_flags"]["Update"];

// Enhanced interfaces with review data
export interface QuestionWithReviewDetails extends QuestionWithDetails {
  reviews?: QuestionReviewData[];
  versions?: QuestionVersionData[];
  flags?: QuestionFlagData[];
  reviewer_name?: string;
  flagger_name?: string;
}

// Review form data
export interface ReviewFormData {
  action: ReviewAction;
  feedback?: string;
  changes_made?: Record<string, unknown>;
}

// Flag form data
export interface FlagFormData {
  flag_type: FlagType;
  description: string;
}

// Status configuration for UI
export const STATUS_CONFIG = {
  draft: {
    label: "Draft",
    color: "border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100",
    description: "Question is being created or edited",
  },
  pending_review: {
    label: "Pending review",
    color: "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100",
    description: "Question is submitted and awaiting review",
  },
  published: {
    label: "Published",
    color: "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    description: "Question is published and live for users",
  },
  rejected: {
    label: "Rejected",
    color: "border-red-300 bg-red-50 text-red-700 hover:bg-red-100",
    description: "Question was rejected during review",
  },
  flagged: {
    label: "Flagged",
    color: "border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100",
    description: "Published question with user-reported issues",
  },
  archived: {
    label: "Archived",
    color: "border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100",
    description: "Question is archived and no longer active",
  },
} as const;

// Flag type configuration
export const FLAG_TYPE_CONFIG = {
  incorrect_answer: {
    label: "Incorrect Answer",
    description: "The correct answer is wrong",
  },
  unclear_question: {
    label: "Unclear Question",
    description: "The question is confusing or ambiguous",
  },
  outdated_content: {
    label: "Outdated Content",
    description: "The information is no longer current",
  },
  incorrect_explanations: {
    label: "Incorrect Explanations",
    description: "The explanations for wrong answers are incorrect",
  },
  other: {
    label: "Other",
    description: "Other issues not covered above",
  },
} as const;
