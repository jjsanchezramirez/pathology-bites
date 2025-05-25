// src/hooks/use-images.ts
import { useState, useCallback } from 'react';
import { fetchImages, deleteImage, updateImage, uploadImage, getImageById } from '@/lib/images/images';
import { ImageData } from '@/types/images';

export interface UseImagesParams {
  page?: number;
  pageSize?: number;
  searchTerm?: string;
  category?: string;
}

export interface UseImagesReturn {
  images: ImageData[];
  total: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  deleteImageById: (imagePath: string, imageId: string) => Promise<void>;
  updateImageById: (imageId: string, data: { description: string; alt_text: string; category: string }) => Promise<void>;
  uploadNewImage: (file: File, metadata: {
    description: string;
    alt_text: string;
    category: string;
    file_type: string;
    created_by: string;
    source_ref?: string;
  }) => Promise<ImageData>;
  getImage: (imageId: string) => Promise<ImageData | null>;
}

export function useImages(params: UseImagesParams = {}): UseImagesReturn {
  const {
    page = 0,
    pageSize = 10,
    searchTerm = '',
    category = 'all'
  } = params;

  const [images, setImages] = useState<ImageData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchImages({
        page,
        pageSize,
        searchTerm,
        category
      });

      if (result.error) {
        setError(result.error);
        setImages([]);
        setTotal(0);
      } else {
        setImages(result.data);
        setTotal(result.total);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch images';
      setError(errorMessage);
      setImages([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchTerm, category]);

  const deleteImageById = useCallback(async (imagePath: string, imageId: string) => {
    try {
      await deleteImage(imagePath, imageId);
      // Remove the deleted image from local state
      setImages(prev => prev.filter(img => img.id !== imageId));
      setTotal(prev => prev - 1);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete image';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const updateImageById = useCallback(async (
    imageId: string, 
    data: { description: string; alt_text: string; category: string }
  ) => {
    try {
      await updateImage(imageId, data);
      // Update the image in local state
      setImages(prev => prev.map(img => 
        img.id === imageId 
          ? { ...img, ...data }
          : img
      ));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update image';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const uploadNewImage = useCallback(async (file: File, metadata: {
    description: string;
    alt_text: string;
    category: string;
    file_type: string;
    created_by: string;
    source_ref?: string;
  }) => {
    try {
      const newImage = await uploadImage(file, metadata);
      // Add the new image to local state
      setImages(prev => [newImage, ...prev]);
      setTotal(prev => prev + 1);
      return newImage;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload image';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const getImage = useCallback(async (imageId: string) => {
    try {
      return await getImageById(imageId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get image';
      setError(errorMessage);
      throw err;
    }
  }, []);

  return {
    images,
    total,
    loading,
    error,
    refetch,
    deleteImageById,
    updateImageById,
    uploadNewImage,
    getImage
  };
}