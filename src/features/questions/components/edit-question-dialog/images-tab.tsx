'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { QuestionWithDetails, QuestionImageFormData } from '@/features/questions/types/questions';
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogPortal, DialogOverlay } from "@/shared/components/ui/dialog";
import { Plus, X, Search } from 'lucide-react';
import { ImageData } from '@/features/images/types/images';

interface ImagesTabProps {
  question?: QuestionWithDetails;
  onUnsavedChanges: () => void;
  questionImages: QuestionImageFormData[];
  onQuestionImagesChange: (images: QuestionImageFormData[]) => void;
  mode?: 'create' | 'edit';
}

interface ImageSectionProps {
  images: QuestionImageFormData[];
  section: 'stem' | 'explanation';
  maxImages: number;
  onImagesChange: (images: QuestionImageFormData[]) => void;
}

interface ImageSectionPropsWithQuestion extends ImageSectionProps {
  question?: QuestionWithDetails;
}

function ImageSection({ images, section, maxImages, onImagesChange, question }: ImageSectionPropsWithQuestion) {
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
    
    // Fallback to available images
    return availableImages.find(img => img.id === imageId);
  }, [question, availableImages]);

  // Filter images for this section
  const sectionImages = images.filter(img => img.question_section === section);

  // Fetch available images when picker opens
  useEffect(() => {
    if (showImagePicker) {
      fetchImages();
    }
  }, [showImagePicker, debouncedSearchTerm]);

  const fetchImages = async () => {
    try {
      const params = new URLSearchParams();
      if (debouncedSearchTerm) {
        params.append('search', debouncedSearchTerm);
      }
      params.append('limit', '50');

      const response = await fetch(`/api/content/questions/images?${params}`);
      if (response.ok) {
        const data = await response.json();
        setAvailableImages(data.images || []);
      }
    } catch (error) {
      console.error('Failed to fetch images:', error);
    }
  };

  const handleAddImages = () => {
    if (selectedImageIds.length === 0) return;

    const newImages = selectedImageIds.map((imageId, index) => ({
      image_id: imageId,
      question_section: section,
      order_index: sectionImages.length + index,
    }));

    const updatedImages = [...images, ...newImages];
    onImagesChange(updatedImages);
    setSelectedImageIds([]);
    setShowImagePicker(false);
  };

  const handleRemoveImage = (imageId: string) => {
    const updatedImages = images.filter(img => img.image_id !== imageId);
    // Reorder remaining images in this section
    const reorderedImages = updatedImages.map((img, index) => {
      if (img.question_section === section) {
        return { ...img, order_index: index };
      }
      return img;
    });
    onImagesChange(reorderedImages);
  };

  const canAddMore = sectionImages.length < maxImages;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium capitalize">{section} Images</h3>
        <span className="text-sm text-muted-foreground">
          {sectionImages.length}/{maxImages} images
        </span>
      </div>

      {/* Current Images */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {sectionImages.map((questionImage) => {
          const imageInfo = getImageInfo(questionImage.image_id);
          return (
            <div key={questionImage.image_id} className="relative group">
              <div className="aspect-square rounded-lg overflow-hidden border bg-muted">
                {imageInfo ? (
                  <Image
                    src={imageInfo.url}
                    alt={imageInfo.alt_text || 'Question image'}
                    width={200}
                    height={200}
                    className="w-full h-full object-cover"
                    unoptimized={true}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    Loading...
                  </div>
                )}
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleRemoveImage(questionImage.image_id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          );
        })}

        {/* Add Image Button */}
        {canAddMore && (
          <Button
            variant="outline"
            className="aspect-square rounded-lg border-dashed"
            onClick={() => setShowImagePicker(true)}
          >
            <div className="flex flex-col items-center gap-2">
              <Plus className="h-6 w-6" />
              <span className="text-xs">Add Image</span>
            </div>
          </Button>
        )}
      </div>

      {/* Image Picker Dialog */}
      <Dialog open={showImagePicker} onOpenChange={setShowImagePicker}>
        <DialogPortal>
          <DialogOverlay className="backdrop-blur-md bg-black/20" />
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Select Images for {section}</DialogTitle>
              <DialogDescription>
                Choose up to {maxImages - sectionImages.length} more images for the {section} section
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search images..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Image Grid */}
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-96 overflow-y-auto">
                {availableImages.map((image) => {
                  const isSelected = selectedImageIds.includes(image.id);
                  const isAlreadyUsed = images.some(qi => qi.image_id === image.id);
                  
                  return (
                    <div
                      key={image.id}
                      className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                        isSelected ? 'border-primary' : 'border-transparent'
                      } ${isAlreadyUsed ? 'opacity-50' : ''}`}
                      onClick={() => {
                        if (isAlreadyUsed) return;
                        
                        if (isSelected) {
                          setSelectedImageIds(prev => prev.filter(id => id !== image.id));
                        } else {
                          const remainingSlots = maxImages - sectionImages.length;
                          if (selectedImageIds.length < remainingSlots) {
                            setSelectedImageIds(prev => [...prev, image.id]);
                          }
                        }
                      }}
                    >
                      <div className="aspect-square">
                        <Image
                          src={image.url}
                          alt={image.alt_text || 'Available image'}
                          width={150}
                          height={150}
                          className="w-full h-full object-cover"
                          unoptimized={true}
                        />
                      </div>
                      {isSelected && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium">
                            ✓
                          </div>
                        </div>
                      )}
                      {isAlreadyUsed && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <span className="text-white text-xs font-medium">Used</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="flex justify-between items-center pt-4 border-t">
                <span className="text-sm text-muted-foreground">
                  {selectedImageIds.length} selected
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowImagePicker(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleAddImages}
                    disabled={selectedImageIds.length === 0}
                  >
                    Add {selectedImageIds.length} Image{selectedImageIds.length !== 1 ? 's' : ''}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </div>
  );
}

export function ImagesTab({
  question,
  onUnsavedChanges,
  questionImages,
  onQuestionImagesChange,
  mode = 'edit'
}: ImagesTabProps) {
  const handleImagesChange = (images: QuestionImageFormData[]) => {
    onQuestionImagesChange(images);
    onUnsavedChanges();
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Question Images</h2>
        <p className="text-muted-foreground">
          Add images to enhance your question. You can add up to 3 images in the question stem and 1 image in the explanation.
        </p>
      </div>

      <ImageSection
        images={questionImages}
        section="stem"
        maxImages={3}
        onImagesChange={handleImagesChange}
        question={question}
      />

      <ImageSection
        images={questionImages}
        section="explanation"
        maxImages={1}
        onImagesChange={handleImagesChange}
        question={question}
      />
    </div>
  );
}
