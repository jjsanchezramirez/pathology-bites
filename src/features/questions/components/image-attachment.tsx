// src/components/questions/image-attachment.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Search, X, Plus, GripVertical, Image as ImageIcon } from 'lucide-react';
import { fetchImages } from '@/features/images/services/images';
import { ImageData } from '@/features/images/types/images';
import { ImagePreview } from '@/features/images/components/image-preview';
import { SimpleImagePreview } from '@/features/images/components/simple-image-preview';
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
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [totalImages, setTotalImages] = useState(0);
  const [activeTab, setActiveTab] = useState('stem');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Filter images by section
  const questionImages = selectedImages.filter(img => img.question_section === 'stem');
  const explanationImages = selectedImages.filter(img => img.question_section === 'explanation');

  const loadImages = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchImages({
        page,
        pageSize: 20,
        searchTerm: searchTerm || undefined,
        category: categoryFilter === 'all' ? undefined : categoryFilter,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      setAvailableImages(result.data);
      setTotalImages(result.total);
    } catch (error) {
      console.error('Failed to load images:', error);
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, categoryFilter]);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  const handleImageToggle = (imageId: string, section: 'stem' | 'explanation') => {
    const sectionImages = selectedImages.filter(img => img.question_section === section);
    const isSelected = sectionImages.some(img => img.image_id === imageId);
    const maxImages = section === 'stem' ? 5 : 3;

    if (isSelected) {
      // Remove image
      const updatedImages = selectedImages.filter(
        img => !(img.image_id === imageId && img.question_section === section)
      );
      // Reorder remaining images in this section
      const reorderedImages = updatedImages.map(img => {
        if (img.question_section === section) {
          const sectionIndex = updatedImages
            .filter(i => i.question_section === section)
            .indexOf(img);
          return { ...img, order_index: sectionIndex };
        }
        return img;
      });
      onSelectionChange(reorderedImages);
    } else if (sectionImages.length < maxImages) {
      // Add image
      const newImage: QuestionImageFormData = {
        image_id: imageId,
        question_section: section,
        order_index: sectionImages.length
      };
      onSelectionChange([...selectedImages, newImage]);
    }
  };

  const handleRemoveImage = (imageId: string, section: 'stem' | 'explanation') => {
    const updatedImages = selectedImages.filter(
      img => !(img.image_id === imageId && img.question_section === section)
    );
    // Reorder remaining images in this section
    const reorderedImages = updatedImages.map(img => {
      if (img.question_section === section) {
        const sectionIndex = updatedImages
          .filter(i => i.question_section === section)
          .indexOf(img);
        return { ...img, order_index: sectionIndex };
      }
      return img;
    });
    onSelectionChange(reorderedImages);
  };

  const handleDragStart = (index: number, section: 'stem' | 'explanation') => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number, section: 'stem' | 'explanation') => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    const sectionImages = selectedImages.filter(img => img.question_section === section);
    const otherImages = selectedImages.filter(img => img.question_section !== section);

    const updatedSectionImages = [...sectionImages];
    const draggedImage = updatedSectionImages[draggedIndex];

    // Remove dragged item and insert at new position
    updatedSectionImages.splice(draggedIndex, 1);
    updatedSectionImages.splice(dropIndex, 0, draggedImage);

    // Update order indices
    const reorderedSectionImages = updatedSectionImages.map((img, i) => ({
      ...img,
      order_index: i
    }));

    onSelectionChange([...otherImages, ...reorderedSectionImages]);
    setDraggedIndex(null);
  };

  // Load all images for selected images display (not filtered by search)
  const [allImages, setAllImages] = useState<ImageData[]>([]);

  const loadAllImages = useCallback(async () => {
    try {
      const result = await fetchImages({
        page: 0,
        pageSize: 1000, // Get all images for selected display
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

  const renderSelectedImages = (images: QuestionImageFormData[], section: 'stem' | 'explanation') => {
    const maxImages = section === 'stem' ? 5 : 3;

    if (images.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No images selected</p>
          <p className="text-xs">Select images from the gallery below</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {images
          .sort((a, b) => a.order_index - b.order_index)
          .map((imageData, index) => {
            // Use allImages instead of availableImages to show selected images regardless of search
            const image = allImages.find(img => img.id === imageData.image_id);
            if (!image) return null;

            return (
              <div
                key={imageData.image_id}
                className="relative group cursor-move"
                draggable
                onDragStart={() => handleDragStart(index, section)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index, section)}
              >
                <ImagePreview
                  src={image.url}
                  alt={image.alt_text}
                  size="md"
                  className="aspect-square w-full h-full rounded-lg border-2 border-border overflow-hidden"
                />
                <Badge
                  variant="default"
                  className="absolute -top-2 -left-2 h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs font-bold"
                >
                  {imageData.order_index + 1}
                </Badge>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleRemoveImage(imageData.image_id, section)}
                >
                  <X className="h-3 w-3" />
                </Button>
                <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <GripVertical className="h-4 w-4 text-white drop-shadow-lg" />
                </div>
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground truncate" title={image.alt_text}>
                    {image.alt_text}
                  </p>
                </div>
              </div>
            );
          })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ImageIcon className="h-5 w-5" />
        <h3 className="text-lg font-medium">Question Images</h3>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="stem" className="flex items-center gap-2">
            Question Images
            {questionImages.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {questionImages.length}/5
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="explanation" className="flex items-center gap-2">
            Explanation Images
            {explanationImages.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {explanationImages.length}/3
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stem" className="space-y-4">
          <div className="bg-muted/30 rounded-lg p-4 min-h-[200px]">
            {renderSelectedImages(questionImages, 'stem')}
          </div>
        </TabsContent>

        <TabsContent value="explanation" className="space-y-4">
          <div className="bg-muted/30 rounded-lg p-4 min-h-[200px]">
            {renderSelectedImages(explanationImages, 'explanation')}
          </div>
        </TabsContent>
      </Tabs>

      {/* Image Gallery */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-md font-medium">Image Gallery</h4>
          <div className="text-xs text-muted-foreground">
            Click images to add them to the selected tab
          </div>
        </div>

        {/* Search Controls */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search images..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(0);
              }}
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={(value) => {
            setCategoryFilter(value);
            setPage(0);
          }}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="gross">Gross</SelectItem>
              <SelectItem value="microscopic">Microscopic</SelectItem>
              <SelectItem value="figure">Figure</SelectItem>
              <SelectItem value="table">Table</SelectItem>
            </SelectContent>
          </Select>
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
            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
              {availableImages.map((image) => {
                const isSelectedInQuestion = questionImages.some(img => img.image_id === image.id);
                const isSelectedInExplanation = explanationImages.some(img => img.image_id === image.id);
                const isSelected = isSelectedInQuestion || isSelectedInExplanation;
                const canSelectInActiveTab = activeTab === 'stem'
                  ? !isSelectedInQuestion && questionImages.length < 5
                  : !isSelectedInExplanation && explanationImages.length < 3;

                return (
                  <div
                    key={image.id}
                    className={`relative cursor-pointer rounded border-2 transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/10'
                        : canSelectInActiveTab
                          ? 'border-border hover:border-primary/50'
                          : 'border-border opacity-50 cursor-not-allowed'
                    }`}
                    onClick={() => (canSelectInActiveTab || isSelected) ? handleImageToggle(image.id, activeTab as 'stem' | 'explanation') : undefined}
                    title={image.alt_text}
                  >
                    <SimpleImagePreview
                      src={image.url}
                      alt={image.alt_text}
                      className="aspect-square w-full h-full"
                    />
                    {isSelected && (
                      <div className="absolute top-0 right-0 bg-primary text-primary-foreground rounded-full w-4 h-4 text-xs flex items-center justify-center">
                        ✓
                      </div>
                    )}
                    {isSelectedInQuestion && isSelectedInExplanation && (
                      <div className="absolute top-0 left-0 bg-orange-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center">
                        2
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalImages > 20 && (
            <div className="flex justify-center gap-2 mt-6 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground self-center px-3">
                Page {page + 1} of {Math.ceil(totalImages / 20)}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage(p => p + 1)}
                disabled={(page + 1) * 20 >= totalImages}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
