// src/types/images.ts
import { Database } from './supabase';

export type ImageData = Database['public']['Tables']['images']['Row'];
export type ImageInsert = Database['public']['Tables']['images']['Insert'];
export type ImageUpdate = Database['public']['Tables']['images']['Update'];

// Updated to match actual database categories
export const IMAGE_CATEGORIES = {
  microscopic: 'Microscopic',
  figure: 'Figure', 
  table: 'Table',
  gross: 'Gross'
} as const;

export type ImageCategory = keyof typeof IMAGE_CATEGORIES;

export const PAGE_SIZE = 10;

export interface ImageFilters {
  searchTerm?: string;
  category?: ImageCategory | 'all';
  page?: number;
  pageSize?: number;
}

// Props for the upload dialog
export interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: () => void;
}

// Track progress for each file being uploaded
export interface FileProgress {
  fileName: string;
  originalSize: number;
  compressedSize?: number;
  status: 'compressing' | 'uploading' | 'completed' | 'error';
  progress: number;
}

// Form data for image uploads and edits
export interface ImageFormData {
  description: string;
  alt_text: string;
  category: ImageCategory;
}

// Props for the images table
export interface ImageActionsProps {
  image: ImageData;
  onEdit: (image: ImageData) => void;
  onDelete: (image: ImageData) => void;
}