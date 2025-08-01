'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { QuestionWithDetails, QuestionImageFormData } from '@/features/questions/types/questions';
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogPortal, DialogOverlay } from "@/shared/components/ui/dialog";
import { Plus, X, Search } from 'lucide-react';
import { ImageData } from '@/features/images/types/images';

interface MediaTabProps {
  question?: QuestionWithDetails;
  onUnsavedChanges: () => void;
  questionImages: QuestionImageFormData[];
  onQuestionImagesChange: (images: QuestionImageFormData[]) => void;
  mode?: 'create' | 'edit';
}

interface MediaSectionProps {
  images: QuestionImageFormData[];
  section: 'stem' | 'explanation';
  maxImages: number;
  onImagesChange: (images: QuestionImageFormData[]) => void;
}

interface MediaSectionPropsWithQuestion extends MediaSectionProps {
  question?: QuestionWithDetails;
}

function MediaSection({ images, section, maxImages, onImagesChange, question }: MediaSectionPropsWithQuestion) {
  const [availableImages, setAvailableImages] = useState<ImageData[]>([]);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Get image data from question object for existing images
  const getImageInfo = useCallback((imageId: string) => {
    // First try to find the image in the question's image data
    const questionImage = question?.question_images?.find(qi => qi.image_id === imageId);
    if (questionImage?.image) {
      return questionImage.image;
    }

    // Fallback to availableImages if not found in question data
    return availableImages.find(img => img.id === imageId);
  }, [question?.question_images, availableImages]);

  // Load images for the picker dialog
  const loadPickerImages = useCallback(async () => {
    try {
      const { fetchImages } = await import('@/features/images/services/images');
      const result = await fetchImages({
        page: 0,
        pageSize: 10, // Load exactly 10 images (2 rows of 5)
        searchTerm: debouncedSearchTerm || undefined,
        showUnusedOnly: false
      });

      if (result.error) {
        throw new Error(result.error);
      }

      setAvailableImages(result.data);
    } catch (error) {
      console.error('Failed to load images:', error);
    }
  }, [debouncedSearchTerm]);

  // Load picker images when dialog opens
  useEffect(() => {
    if (showImagePicker) {
      loadPickerImages();
    }
  }, [showImagePicker, loadPickerImages]);

  const handleRemoveImage = (imageId: string, index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);
  };

  const handleImageToggle = (imageId: string) => {
    // Check if image is already added to this section
    const imageAlreadyExists = images.some(img => img.image_id === imageId);
    if (imageAlreadyExists) {
      return; // Don't allow selecting already added images
    }

    setSelectedImageIds(prev => {
      if (prev.includes(imageId)) {
        return prev.filter(id => id !== imageId);
      } else {
        // Check if we would exceed the limit
        const remainingSlots = maxImages - images.length;
        if (prev.length >= remainingSlots) {
          return prev; // Don't add more if it would exceed limit
        }
        return [...prev, imageId];
      }
    });
  };

  const handleSelectImages = () => {
    const newImages = selectedImageIds.map((imageId, index) => ({
      image_id: imageId,
      question_section: section,
      order_index: images.length + index + 1,
    }));

    onImagesChange([...images, ...newImages]);
    setSelectedImageIds([]);
    setShowImagePicker(false);
  };

  const handleCancelSelection = () => {
    setSelectedImageIds([]);
    setShowImagePicker(false);
    setSearchTerm('');
  };

  return (
    <div>
      <div className="grid grid-cols-5 gap-4">
        {/* Existing Images */}
        {images.map((imageItem, index) => {
          const uniqueKey = `${imageItem.image_id}-${index}`;
          const imageInfo = getImageInfo(imageItem.image_id);

          return (
            <div key={uniqueKey} className="relative group">
              <div className="aspect-square bg-muted rounded border overflow-hidden relative">
                {imageInfo ? (
                  <Image
                    src={imageInfo.url}
                    alt={imageInfo.alt_text || ''}
                    fill
                    className="object-cover"
                    sizes="150px"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-sm text-muted-foreground">Loading...</span>
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleRemoveImage(imageItem.image_id, index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          );
        })}

        {/* Add Image Button */}
        {images.length < maxImages && (
          <div className="relative group">
            <div
              className="aspect-square bg-muted rounded border-2 border-dashed border-border hover:border-primary/50 overflow-hidden cursor-pointer flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowImagePicker(true)}
            >
              <Plus className="h-6 w-6" />
              <span className="text-xs">Add Image</span>
            </div>
          </div>
        )}
      </div>

      {/* Image Picker Dialog */}
      <Dialog open={showImagePicker} onOpenChange={handleCancelSelection}>
        <DialogPortal>
          <DialogOverlay className="backdrop-blur-md bg-black/30" />
          <DialogContent className="!max-w-[1090px] !w-[1090px] max-h-[85vh] overflow-hidden border-0">
            <DialogHeader>
              <DialogTitle>Select Images for {section === 'stem' ? 'Question Body' : 'Explanation'}</DialogTitle>
              <DialogDescription>
                Choose up to {maxImages - images.length} more image{maxImages - images.length !== 1 ? 's' : ''} for this section.
                {selectedImageIds.length > 0 && ` ${selectedImageIds.length} image${selectedImageIds.length !== 1 ? 's' : ''} selected.`}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search images..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Images Grid */}
              <div className="max-h-[50vh] overflow-y-auto">
                <div className="grid grid-cols-5 gap-4 p-1">
                  {availableImages.map((image) => {
                    const isSelected = selectedImageIds.includes(image.id);
                    const isAlreadyAdded = images.some(img => img.image_id === image.id);
                    const canSelect = !isAlreadyAdded && (selectedImageIds.length < (maxImages - images.length) || isSelected);

                    return (
                      <div
                        key={image.id}
                        className={`relative cursor-pointer rounded border-2 transition-all ${
                          isAlreadyAdded
                            ? 'border-muted bg-muted/50 opacity-50 cursor-not-allowed'
                            : isSelected
                              ? 'border-primary bg-primary/10'
                              : canSelect
                                ? 'border-border hover:border-primary/50'
                                : 'border-muted opacity-50 cursor-not-allowed'
                        }`}
                        onClick={() => canSelect && handleImageToggle(image.id)}
                        title={isAlreadyAdded ? 'Already added to this section' : image.alt_text || ''}
                      >
                        <div className="aspect-square overflow-hidden rounded relative">
                          <Image
                            src={image.url}
                            alt={image.alt_text || ''}
                            fill
                            className="object-cover"
                            sizes="120px"
                            unoptimized
                          />
                        </div>
                        {isSelected && (
                          <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">
                            ✓
                          </div>
                        )}
                        {isAlreadyAdded && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded">
                            <span className="text-white text-xs font-medium">Already Added</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={handleCancelSelection}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSelectImages}
                  disabled={selectedImageIds.length === 0}
                >
                  Add {selectedImageIds.length} Image{selectedImageIds.length !== 1 ? 's' : ''}
                </Button>
              </div>
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </div>
  );
}

export function MediaTab({ question, onUnsavedChanges, questionImages, onQuestionImagesChange, mode = 'edit' }: MediaTabProps) {
  const handleImagesChange = (newImages: QuestionImageFormData[]) => {
    onQuestionImagesChange(newImages);
    onUnsavedChanges();
  };

  const stemImages = questionImages.filter(img => img.question_section === 'stem');
  const explanationImages = questionImages.filter(img => img.question_section === 'explanation');

  return (
    <div className="space-y-8">
      {/* Question Body Images */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">Question Body Images</h3>
          <span className="text-sm text-muted-foreground">
            {stemImages.length}/3 images
          </span>
        </div>
        <MediaSection
          images={stemImages}
          section="stem"
          maxImages={3}
          question={question}
          onImagesChange={(newImages) => {
            const explanationImages = questionImages.filter(img => img.question_section === 'explanation');
            handleImagesChange([...newImages, ...explanationImages]);
          }}
        />
      </div>

      {/* Explanation Images */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">Explanation Images</h3>
          <span className="text-sm text-muted-foreground">
            {explanationImages.length}/1 images
          </span>
        </div>
        <MediaSection
          images={explanationImages}
          section="explanation"
          maxImages={1}
          question={question}
          onImagesChange={(newImages) => {
            const stemImages = questionImages.filter(img => img.question_section === 'stem');
            handleImagesChange([...stemImages, ...newImages]);
          }}
        />
      </div>
    </div>
  );
}
