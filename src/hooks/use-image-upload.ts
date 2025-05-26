import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from './use-toast';
import { FileProgress, ImageCategory } from '@/types/images';
import { compressImage, cleanFileName, formatImageName } from '@/lib/images/image-upload';

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
  const { toast } = useToast();

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
    sourceRef?: string
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

          // Generate storage path
          const timestamp = Date.now();
          const storagePath = `${timestamp}-${cleanFileName(file.name)}`;

          // Upload to storage
          const { error: uploadError } = await supabase.storage
            .from('images')
            .upload(storagePath, fileToUpload, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) throw uploadError;

          updateFileProgress(file.name, { progress: 60 });

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('images')
            .getPublicUrl(storagePath);

          updateFileProgress(file.name, { progress: 80 });

          // Insert database record
          const { error: dbError } = await supabase
            .from('images')
            .insert({
              url: publicUrl,
              storage_path: storagePath,
              description: formatImageName(fileToUpload.name),
              alt_text: formatImageName(fileToUpload.name),
              category,
              file_type: fileToUpload.type,
              // Store sourceRef if provided for any category, otherwise null
              source_ref: sourceRef?.trim() || null,
              created_by: user.id
            });

          if (dbError) {
            // Clean up storage on database error
            await supabase.storage
              .from('images')
              .remove([storagePath]);
            throw dbError;
          }

          updateFileProgress(file.name, { status: 'completed', progress: 100 });

          const reduction = file.size === fileToUpload.size
            ? "0"
            : ((file.size - fileToUpload.size) / file.size * 100).toFixed(1);

          toast({
            title: "Success",
            description: reduction === "0"
              ? `Uploaded ${file.name}`
              : `Uploaded ${file.name} (${reduction}% size reduction)`
          });

        } catch (error) {
          updateFileProgress(file.name, { status: 'error', progress: 0 });

          toast({
            variant: "destructive",
            title: "Upload Error",
            description: error instanceof Error ? error.message : `Failed to upload ${file.name}`
          });

          continue; // Continue with next file
        }
      }

      onUploadComplete?.();
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload images"
      });
    } finally {
      setIsUploading(false);
    }
  }, [maxSizeBytes, onUploadComplete, supabase, toast, updateFileProgress]);

  return {
    isUploading,
    fileProgress,
    uploadFiles,
    resetProgress
  };
}