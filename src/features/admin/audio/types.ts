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
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AudioListFilters {
  pathology_category_id?: string;
  search?: string;
}
