// src/types/images.ts

// Define allowed image categories
export const IMAGE_CATEGORIES = {
  microscopic: 'Microscopic',
  gross: 'Gross',
  figure: 'Figure',
  table: 'Table'
} as const;

export type ImageCategory = keyof typeof IMAGE_CATEGORIES;

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

// Image database record
export interface ImageData {
  id: string;
  url: string;
  storage_path: string;
  description: string;
  alt_text: string;
  category: ImageCategory;
  file_type?: string;
  source_ref?: string | null;
  created_at: string;
  created_by?: string;
  updated_at: string;
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

// Number of images to show per page
export const PAGE_SIZE = 50;

// Image size constraints
export const MAX_IMAGE_SIZE = 1048576; // 1MB
export const IMAGE_COMPRESSION_SETTINGS = {
  quality: 0.8,
  maxWidth: 2048,
  maxHeight: 2048,
  convertSize: 1048576, // Convert if > 1MB
} as const;