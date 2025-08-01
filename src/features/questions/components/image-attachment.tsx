// src/components/questions/image-attachment.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Search, X, Plus, Image as ImageIcon, GripVertical } from 'lucide-react';
import { fetchImages } from '@/features/images/services/images';
import { ImageData } from '@/features/images/types/images';
import { ImagePreview } from '@/features/images/components/image-preview';
import { QuestionImageFormData } from '@/features/questions/types/questions';

interface ImageAttachmentProps {
  selectedImages: QuestionImageFormData[];
  onSelectionChange: (images: QuestionImageFormData[]) => void;
}

export function ImageAttachment({
  selectedImages,
  onSelectionChange
}: ImageAttachmentProps) {
  const [availableImages, setAvailableImages] = useState<ImageData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showImagePicker, setShowImagePicker] = useState(false);

  // Get all selected image IDs for easy lookup
  const selectedImageIds = selectedImages.map(img => img.image_id);

  const loadImages = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchImages({
        page: 0,
        pageSize: 50,
        searchTerm: searchTerm || undefined,
        showUnusedOnly: false
      });

      if (result.error) {
        throw new Error(result.error);
      }

      setAvailableImages(result.data);
    } catch (error) {
      console.error('Failed to load images:', error);
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    if (showImagePicker) {
      loadImages();
    }
  }, [loadImages, showImagePicker]);

  const handleAddImage = (imageId: string) => {
    if (selectedImageIds.includes(imageId)) return;

    const newImage: QuestionImageFormData = {
      image_id: imageId,
      question_section: 'stem',
      order_index: selectedImages.length
    };
    onSelectionChange([...selectedImages, newImage]);
    setShowImagePicker(false);
  };

  const handleRemoveImage = (imageId: string, section?: string) => {
    const updatedImages = selectedImages.filter(img => img.image_id !== imageId);
    // Reorder remaining images
    const reorderedImages = updatedImages.map((img, index) => ({
      ...img,
      order_index: index
    }));
    onSelectionChange(reorderedImages);
  };

  // Drag and drop functionality
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (index: number, section: string) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number, section: string) => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    const updatedImages = [...selectedImages];
    const draggedImage = updatedImages[draggedIndex];

    // Remove dragged item
    updatedImages.splice(draggedIndex, 1);

    // Insert at new position
    updatedImages.splice(dropIndex, 0, draggedImage);

    // Update order indices
    const reorderedImages = updatedImages.map((img, index) => ({
      ...img,
      order_index: index
    }));

    onSelectionChange(reorderedImages);
    setDraggedIndex(null);
  };



  // Load all images for selected images display
  const [allImages, setAllImages] = useState<ImageData[]>([]);

  const loadAllImages = useCallback(async () => {
    try {
      const result = await fetchImages({
        page: 0,
        pageSize: 1000,
        showUnusedOnly: false
      });

      if (result.error) {
        throw new Error(result.error);
      }

      setAllImages(result.data);
    } catch (error) {
      console.error('Failed to load all images:', error);
    }
  }, []);

  useEffect(() => {
    loadAllImages();
  }, [loadAllImages]);



  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Images ({selectedImages.length})</h4>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowImagePicker(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Images
        </Button>
      </div>

      {/* Selected Images */}
      {selectedImages.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {selectedImages.map((imageData) => {
            const image = allImages.find(img => img.id === imageData.image_id);
            if (!image) return null;

            return (
              <div key={imageData.image_id} className="relative group">
                <ImagePreview
                  src={image.url}
                  alt={image.alt_text || ''}
                  size="sm"
                  className="aspect-square w-full rounded-lg border"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleRemoveImage(imageData.image_id)}
                >
                  <X className="h-3 w-3" />
                </Button>
                <div className="mt-1">
                  <p className="text-xs text-muted-foreground truncate" title={image.alt_text || ''}>
                    {image.alt_text || 'No description'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Image Picker Dialog */}
      {showImagePicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 max-w-4xl max-h-[80vh] overflow-y-auto w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Select Images</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowImagePicker(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search images..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

        {/* Images Grid */}
        <div className="border rounded-lg p-4">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="text-sm text-muted-foreground">Loading images...</div>
            </div>
          ) : availableImages.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-12">
              <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No images found</p>
              <p className="text-xs">Try adjusting your search or category filter</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 md:grid-cols-6 gap-3 max-h-96 overflow-y-auto">
              {availableImages.map((image) => {
                const isSelected = selectedImageIds.includes(image.id);

                return (
                  <div
                    key={image.id}
                    className={`relative cursor-pointer rounded border-2 transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => !isSelected && handleAddImage(image.id)}
                    title={image.alt_text || ''}
                  >
                    <ImagePreview
                      src={image.url}
                      alt={image.alt_text || ''}
                      size="sm"
                      className="aspect-square w-full rounded"
                    />
                    {isSelected && (
                      <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">
                        ✓
                      </div>
                    )}
                    <div className="mt-1">
                      <p className="text-xs text-muted-foreground truncate" title={image.alt_text || ''}>
                        {image.alt_text || 'No description'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
          </div>
        </div>
      )}
    </div>
  );
}
