export interface SubjectEntry {
  name: string;
  category_id?: string;
  content_amount: number;
  activity_prefix: string;
  active: boolean;
  start_page?: number;
  end_page?: number;
}

export type ContentType = "qbank" | "book" | "video" | "flashcards";

export interface PhaseResourceAssignment {
  resource_id: string;
  mode: "study" | "review";
  review_pct?: number; // 0-100, only used when mode='review' (default 50)
}

export interface StudyResource {
  id: string;
  name: string;
  short_name: string;
  activity_verb: string;
  type: ContentType;
  color: string;
  subjects: SubjectEntry[];
  pace: number;
  // Legacy fields (kept for backward compat, not used by new code)
  priority?: string;
  phases?: number[];
  phase_assignments?: unknown[];
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
  catchup_first_day?: number; // legacy: day count
  catchup_first?: number | string; // legacy union — read-only, migrate to above
  cp_share: number;
  content_type_order?: ContentType[];
  cp_subject_order: string[];
  ap_subject_order: string[];
  resources?: PhaseResourceAssignment[];
  // Legacy
  focus?: string;
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
  resource_name: string;
  subject: string;
  activity: string;
  minutes: number;
  task_type: "task" | "rest" | "exam" | "gone" | "half_off";
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
  type: "missing_resource" | "fraction_mismatch" | "overloaded_day" | "empty_phase";
  message: string;
}
