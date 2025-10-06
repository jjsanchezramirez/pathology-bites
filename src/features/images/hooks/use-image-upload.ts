import { useState, useCallback } from 'react';
import { createClient } from '@/shared/services/client';
import { toast } from 'sonner';
import { FileProgress, ImageCategory } from '@/features/images/types/images';
import { compressImage, cleanFileName, formatImageName, getImageDimensions } from '@/features/images/services/image-upload';

interface UseImageUploadOptions {
  onUploadComplete?: () => void;
  maxSizeBytes?: number;
}

export function useImageUpload({
  onUploadComplete,
  maxSizeBytes = 1024 * 1024 // 1MB
}: UseImageUploadOptions = {}) {
  const [isUploading, setIsUploading] = useState(false);
  const [fileProgress, setFileProgress] = useState<FileProgress[]>([]);

  const supabase = createClient();

  const updateFileProgress = useCallback((
    fileName: string,
    updates: Partial<FileProgress>
  ) => {
    setFileProgress(prev =>
      prev.map(file =>
        file.fileName === fileName
          ? { ...file, ...updates }
          : file
      )
    );
  }, []);

  const resetProgress = useCallback(() => {
    setFileProgress([]);
  }, []);

  const uploadFiles = useCallback(async (
    files: File[],
    category: ImageCategory,
    sourceRef?: string,
    description?: string
  ) => {
    if (files.length === 0) return;

    // ✅ Removed the mandatory sourceRef check for 'figure' or 'table'.

    setIsUploading(true);
    setFileProgress(files.map(file => ({
      fileName: file.name,
      originalSize: file.size,
      status: 'compressing',
      progress: 0
    })));

    try {
      // Verify user is authenticated admin
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('You must be logged in to upload images');
      }

      const { data: userData, error: roleError } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      if (roleError || !userData || userData.role !== 'admin') {
        throw new Error('Only administrators can upload images');
      }

      // Process each file
      for (const file of files) {
        try {
          if (!file.type.startsWith('image/')) {
            updateFileProgress(file.name, { status: 'error', progress: 0 });
            throw new Error(`${file.name} is not an image file`);
          }

          let fileToUpload = file;

          // Compress if needed
          updateFileProgress(file.name, { status: 'compressing', progress: 10 });
          if (file.size > maxSizeBytes) {
            updateFileProgress(file.name, { status: 'compressing', progress: 20 });
            fileToUpload = await compressImage(file, maxSizeBytes);

            if (fileToUpload.size > maxSizeBytes) {
              throw new Error(
                `${file.name} is still too large after compression. Please try a smaller image.`
              );
            }
          }

          updateFileProgress(file.name, {
            compressedSize: fileToUpload.size,
            status: 'uploading',
            progress: 40
          });

          // Upload via API endpoint
          const formData = new FormData();
          formData.append('file', fileToUpload);
          formData.append('category', category);
          if (sourceRef) formData.append('sourceRef', sourceRef);
          if (description) formData.append('description', description);

          updateFileProgress(file.name, { progress: 60 });

          const response = await fetch('/api/media/images/upload', {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Upload failed');
          }

          const result = await response.json();

          updateFileProgress(file.name, { status: 'completed', progress: 100 });

          const reduction = file.size === fileToUpload.size
            ? "0"
            : ((file.size - fileToUpload.size) / file.size * 100).toFixed(1);

          toast.success(reduction === "0"
            ? `Uploaded ${file.name}`
            : `Uploaded ${file.name} (${reduction}% size reduction)`);

        } catch (error) {
          updateFileProgress(file.name, { status: 'error', progress: 0 });

          toast.error(error instanceof Error ? error.message : `Failed to upload ${file.name}`);

          continue; // Continue with next file
        }
      }

      onUploadComplete?.();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : "Failed to upload images");
    } finally {
      setIsUploading(false);
    }
  }, [maxSizeBytes, onUploadComplete, supabase, updateFileProgress]);

  return {
    isUploading,
    fileProgress,
    uploadFiles,
    resetProgress
  };
}