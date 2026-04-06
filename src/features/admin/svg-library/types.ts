export interface SvgAsset {
  id: string;
  url: string;
  storage_path: string;
  name: string;
  description: string | null;
  tags: string[] | null;
  category: string | null;
  width: number | null;
  height: number | null;
  file_size_bytes: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SvgListFilters {
  search?: string;
  category?: string;
  page?: number;
  pageSize?: number;
}
