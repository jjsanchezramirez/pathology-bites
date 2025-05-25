// src/hooks/use-image-edit.ts
import { useState, useCallback } from 'react';
import { useToast } from './use-toast';
import { deleteImage, updateImage } from '@/lib/images/images';
import type { ImageData, ImageFormData, ImageCategory } from '@/types/images';

interface UseImageEditOptions {
  onSuccess?: () => void;
}

const initialFormState: ImageFormData = {
  description: '',
  alt_text: '',
  category: 'microscopic'
};

export function useImageEdit({ onSuccess }: UseImageEditOptions = {}) {
  const [state, setState] = useState({
    isLoading: false,
    isDeleteDialogOpen: false,
    formData: initialFormState
  });
  
  const { toast } = useToast();

  const updateState = useCallback((updates: Partial<typeof state>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const handleUpdateImage = useCallback(async (imageId: string) => {
    updateState({ isLoading: true });
    try {
      await updateImage(imageId, state.formData);
      
      toast({
        title: "Success",
        description: "Image updated successfully"
      });

      onSuccess?.();
    } catch (error) {
      console.error('Error updating image:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update image"
      });
      throw error;
    } finally {
      updateState({ isLoading: false });
    }
  }, [state.formData, onSuccess, toast, updateState]);

  const handleDeleteImage = useCallback(async (imageId: string, imagePath: string) => {
    updateState({ isLoading: true });
    try {
      await deleteImage(imagePath, imageId);

      toast({
        title: "Success",
        description: "Image deleted successfully"
      });

      onSuccess?.();
    } catch (error) {
      console.error('Error deleting image:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete image"
      });
      throw error;
    } finally {
      updateState({ 
        isLoading: false, 
        isDeleteDialogOpen: false 
      });
    }
  }, [onSuccess, toast, updateState]);

  const initializeForm = useCallback((image: ImageData | null) => {
    const newFormData: ImageFormData = image ? {
      description: image.description,
      alt_text: image.alt_text,
      category: image.category as ImageCategory // Cast to proper type
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