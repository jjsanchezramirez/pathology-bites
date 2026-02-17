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

export interface AudioUploadData {
  file: File;
  title?: string;
  description?: string;
  pathology_category_id?: string;
  generated_text?: string;
}

export interface AudioUploadProgress {
  status: "idle" | "converting" | "uploading" | "done" | "error";
  progress: number;
  message: string;
}

export interface AudioUploadResult {
  success: boolean;
  audio?: Audio;
  error?: string;
}

export interface AudioListFilters {
  pathology_category_id?: string;
  search?: string;
}
