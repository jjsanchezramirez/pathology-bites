// Audio file types and interfaces

export interface Audio {
  id: string;
  url: string;
  storage_path: string;
  title: string;
  description: string | null;
  pathology_category_id: string | null;
  file_type: string;
  file_size_bytes: number;
  duration_seconds: number | null;
  generated_text: string | null;
  /** Forced-alignment word timestamps (seconds). Null until aligned. */
  word_timings?: { text: string; start: number; end: number }[] | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AudioListFilters {
  pathology_category_id?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  /**
   * Skip the secondary count-exact query when the caller doesn't need `total`.
   * Defaults to true to preserve existing behavior.
   */
  withCount?: boolean;
  /**
   * Column projection. Defaults to "*". When narrowed, the returned `data`
   * is cast to `Audio[]` but only the selected columns will be populated —
   * the caller is responsible for not accessing omitted fields.
   */
  columns?: string;
}
