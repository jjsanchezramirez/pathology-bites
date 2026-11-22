// Interactive Sequence types and interfaces

import type { Lesson } from "@/shared/lesson/types";
import type { ScriptLesson } from "@/shared/lesson/script/types";

/** What sequence_data can hold: a canvas Lesson or a script-first lesson. */
export type StoredSequenceData = Lesson | ScriptLesson;

export interface InteractiveSequence {
  id: string;
  title: string;
  description: string | null;
  sequence_data: StoredSequenceData; // Lesson or ScriptLesson JSON (older rows: ExplainerSequence — normalize on read)
  category_id: string | null;
  status: "draft" | "published" | "archived";
  published_at: string | null;
  version: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InteractiveSequenceListFilters {
  category_id?: string;
  status?: "draft" | "published" | "archived";
  search?: string;
  created_by?: string;
}

export interface CreateInteractiveSequenceParams {
  title: string;
  description?: string;
  sequence_data: StoredSequenceData;
  category_id?: string;
  status?: "draft" | "published" | "archived";
}

export interface UpdateInteractiveSequenceParams {
  id: string;
  title?: string;
  description?: string;
  sequence_data?: StoredSequenceData;
  category_id?: string;
  status?: "draft" | "published" | "archived";
}
