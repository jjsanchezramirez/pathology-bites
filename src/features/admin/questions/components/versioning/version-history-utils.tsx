"use client";

import { diffWords } from "diff";

interface QuestionOption {
  id?: string;
  text: string;
  is_correct: boolean;
  explanation?: string;
  order_index?: number;
}

interface QuestionImage {
  image_id: string;
  question_section: "stem" | "explanation";
  order_index?: number;
}

export interface QuestionSnapshot {
  title?: string;
  stem?: string;
  difficulty?: string;
  teaching_point?: string;
  question_references?: string;
  question_options?: QuestionOption[];
  question_images?: QuestionImage[];
  lesson?: string;
  topic?: string;
  question_set_id?: string;
  category_id?: string;
  tag_ids?: string[];
}

export interface QuestionVersion {
  id: string;
  question_id: string;
  version_major: number;
  version_minor: number;
  version_patch: number;
  update_type: string;
  change_summary?: string;
  question_snapshot: QuestionSnapshot;
  created_by: string;
  created_at: string;
  is_current?: boolean;
  creator?: {
    first_name: string;
    last_name: string;
  };
}

export function DiffText({ oldText, newText }: { oldText: string; newText: string }) {
  const diff = diffWords(oldText || "", newText || "");

  return (
    <div className="text-sm leading-relaxed">
      {diff.map((part, index) => {
        if (part.removed) {
          return (
            <span
              key={index}
              className="bg-red-100 dark:bg-red-950/50 text-red-900 dark:text-red-200 line-through"
            >
              {part.value}
            </span>
          );
        }
        if (part.added) {
          return (
            <span
              key={index}
              className="bg-green-100 dark:bg-green-950/50 text-green-900 dark:text-green-200 font-medium"
            >
              {part.value}
            </span>
          );
        }
        return <span key={index}>{part.value}</span>;
      })}
    </div>
  );
}

// Detect image changes
export function getImageChanges(oldImages: QuestionImage[], newImages: QuestionImage[]) {
  const oldCount = oldImages?.length || 0;
  const newCount = newImages?.length || 0;
  const diff = newCount - oldCount;

  return {
    added: diff > 0 ? diff : 0,
    removed: diff < 0 ? Math.abs(diff) : 0,
    changed: diff !== 0,
  };
}

// Format references with line breaks
export function formatReferences(references: string) {
  if (!references) return references;

  // Split on common reference separators while preserving the separator
  // Look for patterns like: ". " followed by uppercase letter, or new URLs
  const parts = references.split(/(?<=\.\s)(?=[A-Z])|(?=https?:\/\/)/);

  return parts
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join("\n\n");
}
