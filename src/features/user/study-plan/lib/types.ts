export interface SubjectEntry {
  id: string; // stable per-subject UUID; pre-migration rows may be empty
  name: string;
  category_id?: string;
  content_amount: number;
  active: boolean;
  start_page?: number;
}

export type ContentType = "qbank" | "book" | "video" | "flashcards";

/**
 * Distribution shape for fixed-daily items (qbank, flashcards).
 * Total scheduled always equals available content; the shape only controls
 * how work is weighted across days of the phase.
 */
export type FixedDistribution = "flat" | "front" | "middle" | "end";

export interface PhaseResourceAssignment {
  resource_id: string;
  mode: "study" | "review";
  review_pct?: number; // 0-100, only used when mode='review' (default 50)
  distribution?: FixedDistribution; // fixed-daily shape, default 'flat'
}

export interface StudyResource {
  id: string;
  name: string;
  short_name: string;
  type: ContentType;
  color: string;
  subjects: SubjectEntry[];
  pace: number;
  active?: boolean;
}

export interface ExamDate {
  name: string;
  date: string;
}

export interface PhaseConfig {
  name: string;
  start_date: string;
  end_date: string;
  daily_minutes_weekday: number;
  daily_minutes_weekend: number;
  catchup_every: number;
  catchup_first_date?: string; // ISO date string for first catch-up
  catchup_first_day?: number; // day count (1-indexed within phase)
  subject_order: string[];
  resources?: PhaseResourceAssignment[];
}

export interface StudyConfig {
  id: string;
  exam_dates: ExamDate[];
  days_off: Record<string, "full" | "half">;
  recurring_off: number[];
  phases: PhaseConfig[];
}

export interface ScheduleTask {
  task_id: string;
  date: string;
  idx: number;
  resource_id: string; // stable across resource renames; '' for synthesized special-day stubs
  resource_name: string; // snapshot at scheduling time, used for display fallback
  resource_type: ContentType | ""; // canonical type for the row; '' for special-day stubs
  subject_id: string; // stable across subject renames; '' for special-day stubs
  subject: string; // display name snapshot
  activity: string;
  minutes: number;
  task_type: "task" | "rest" | "exam" | "gone"; // 'rest'|'exam'|'gone' only appear on synthesized special-day stubs in the UI, never in the DB.
  is_review: boolean;
  content_units: number;
  content_label: string;
}

export interface ResourceTimeEstimate {
  resource_name: string;
  total_hours: number;
  hours_per_day: number;
}

export interface PhaseTimeEstimate {
  phase_index: number;
  phase_name: string;
  total_available_hours: number;
  total_needed_hours: number;
  study_day_count: number;
  effective_day_count: number;
  resource_hours: ResourceTimeEstimate[];
  surplus_hours: number;
}

/** Warnings generated during schedule creation */
export interface ScheduleWarning {
  type: "missing_resource" | "overloaded_day" | "empty_phase";
  message: string;
}
