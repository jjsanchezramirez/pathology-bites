'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { QuestionWithDetails, QuestionImageFormData } from '@/features/questions/types/questions';
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Dialog, DialogTrigger, DialogPortal } from "@/shared/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Plus, X, Search, Image as ImageIcon } from 'lucide-react';
import { ImageData } from '@/features/images/types/images';
import { fetchImages } from '@/features/images/services/images';

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
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [loading, setLoading] = useState(false);

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

  // Load images function
  const loadImages = async () => {
    setLoading(true);
    try {
      const result = await fetchImages({
        page: 0,
        pageSize: 20,
        searchTerm: searchTerm || undefined,
        category: categoryFilter === 'all' ? undefined : categoryFilter,
        showUnusedOnly: false
      });

      if (result.error) {
        console.error('Failed to load images:', result.error);
        throw new Error(typeof result.error === 'string' ? result.error : 'Failed to load images');
      }

      setAvailableImages(result.data);
    } catch (error) {
      console.error('Failed to load images:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load images when picker opens
  useEffect(() => {
    if (showImagePicker) {
      loadImages();
    }
  }, [showImagePicker, searchTerm, categoryFilter]);

  const handleImageToggle = (imageId: string) => {
    // Check if image is already added to this section
    const imageAlreadyExists = sectionImages.some(img => img.image_id === imageId);
    if (imageAlreadyExists) {
      return; // Don't allow selecting already added images
    }

    setSelectedImageIds(prev => {
      if (prev.includes(imageId)) {
        return prev.filter(id => id !== imageId);
      } else {
        // Check if we can add more images
        const remainingSlots = maxImages - sectionImages.length;
        if (prev.length < remainingSlots) {
          return [...prev, imageId];
        }
        return prev;
      }
    });
  };

  const handleSelectImages = () => {
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
    setSearchTerm('');
  };

  const handleCancelSelection = () => {
    setSelectedImageIds([]);
    setShowImagePicker(false);
    setSearchTerm('');
    setCategoryFilter('all');
  };

  const handleRemoveImage = (imageId: string, index: number) => {
    const newImages = sectionImages.filter((_, i) => i !== index);
    // Reorder remaining images
    const reorderedImages = newImages.map((img, idx) => ({
      ...img,
      order_index: idx + 1
    }));

    // Combine with other section's images
    const otherSectionImages = images.filter(img => img.question_section !== section);
    onImagesChange([...reorderedImages, ...otherSectionImages]);
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
      <div className="flex flex-wrap gap-4">
        {sectionImages.map((questionImage, index) => {
          const imageInfo = getImageInfo(questionImage.image_id);
          return (
            <div key={`${questionImage.image_id}-${index}`} className="relative group">
              <div className="aspect-square bg-muted rounded-lg border overflow-hidden relative w-32 h-32">
                {imageInfo ? (
                  <Image
                    src={imageInfo.url}
                    alt={imageInfo.alt_text || ''}
                    fill
                    className="object-cover"
                    sizes="128px"
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
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                onClick={() => handleRemoveImage(questionImage.image_id, index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          );
        })}

        {/* Add Image Button */}
        {canAddMore && (
          <Dialog open={showImagePicker} onOpenChange={setShowImagePicker}>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="w-32 h-32 flex-col gap-2 border-dashed border-2 hover:border-primary/50"
              >
                <Plus className="h-6 w-6" />
                <span className="text-xs">Add Image</span>
              </Button>
            </DialogTrigger>
        <DialogPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowImagePicker(false)} />
            <div className="relative bg-background border rounded-lg shadow-lg w-full max-w-5xl mx-4 max-h-[85vh] overflow-hidden">
              <div className="p-6 border-b">
                <h2 className="text-xl font-semibold">Select Images for {section === 'stem' ? 'Question Body' : 'Explanation'}</h2>
              </div>

              <div className="p-6 space-y-4">
                {/* Search Controls */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search images..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="gross">Gross</SelectItem>
                      <SelectItem value="microscopic">Microscopic</SelectItem>
                      <SelectItem value="figure">Figure</SelectItem>
                      <SelectItem value="question">Question</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={loadImages} disabled={loading}>
                    {loading ? 'Loading...' : 'Search'}
                  </Button>
                </div>

                {/* Image Grid */}
                <div className="grid grid-cols-5 gap-4 max-h-96 overflow-y-auto">
                  {availableImages.length === 0 && !loading ? (
                    <div className="col-span-5 text-center py-8 text-muted-foreground">
                      <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No images found</p>
                      {searchTerm && <p className="text-sm">Try a different search term</p>}
                    </div>
                  ) : (
                    availableImages.map((image) => {
                      const isSelected = selectedImageIds.includes(image.id);
                      const isAlreadyAdded = sectionImages.some(img => img.image_id === image.id);
                      const canSelect = !isAlreadyAdded && (selectedImageIds.length < maxImages - sectionImages.length || isSelected);

                      return (
                        <div
                          key={image.id}
                          className={`relative cursor-pointer rounded-lg border-2 transition-all ${
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
                          <div className="aspect-square overflow-hidden rounded-lg relative">
                            <Image
                              src={image.url}
                              alt={image.alt_text || ''}
                              fill
                              className="object-cover"
                              sizes="140px"
                              unoptimized
                            />
                          </div>
                          {isSelected && (
                            <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm">
                              ✓
                            </div>
                          )}
                          {isAlreadyAdded && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                              <span className="text-white text-sm font-medium">Added</span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
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
            </div>
          </div>
        </DialogPortal>
          </Dialog>
        )}
      </div>
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
