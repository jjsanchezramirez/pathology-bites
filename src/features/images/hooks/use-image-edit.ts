// src/hooks/use-image-edit.ts
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { deleteImage, updateImage } from '@/features/images/services/images';
import type { ImageData, ImageFormData, ImageCategory } from '@/features/images/types/images';

interface UseImageEditOptions {
  onSuccess?: () => void;
}

const initialFormState: ImageFormData = {
  description: '',
  alt_text: '',
  category: 'microscopic',
  source_ref: ''
};

export function useImageEdit({ onSuccess }: UseImageEditOptions = {}) {
  const [state, setState] = useState({
    isLoading: false,
    isDeleteDialogOpen: false,
    formData: initialFormState
  });



  const updateState = useCallback((updates: Partial<typeof state>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const handleUpdateImage = useCallback(async (imageId: string) => {
    updateState({ isLoading: true });
    try {
      await updateImage(imageId, state.formData);

      toast.success("Image updated successfully");

      onSuccess?.();
    } catch (error) {
      console.error('Error updating image:', error);
      toast.error("Failed to update image");
      throw error;
    } finally {
      updateState({ isLoading: false });
    }
  }, [state.formData, onSuccess, updateState]);

  const handleDeleteImage = useCallback(async (imageId: string, imagePath: string | null) => {
    updateState({ isLoading: true });
    try {
      await deleteImage(imagePath, imageId);

      toast.success("Image deleted successfully");

      onSuccess?.();
    } catch (error) {
      console.error('Error deleting image:', error);
      toast.error("Failed to delete image");
      throw error;
    } finally {
      updateState({
        isLoading: false,
        isDeleteDialogOpen: false
      });
    }
  }, [onSuccess, updateState]);

  const initializeForm = useCallback((image: ImageData | null) => {
    const newFormData: ImageFormData = image ? {
      description: image.description || '',
      alt_text: image.alt_text || '',
      category: image.category as ImageCategory, // Cast to proper type
      source_ref: image.source_ref || ''
    } : initialFormState;

    updateState({ formData: newFormData });
  }, [updateState]);

  const resetState = useCallback(() => {
    setState({
      isLoading: false,
      isDeleteDialogOpen: false,
      formData: initialFormState
    });
  }, []);

  return {
    ...state,
    setFormData: (formData: typeof state.formData) => updateState({ formData }),
    setIsDeleteDialogOpen: (isOpen: boolean) => updateState({ isDeleteDialogOpen: isOpen }),
    handleUpdateImage,
    handleDeleteImage,
    initializeForm,
    resetState
  };
}