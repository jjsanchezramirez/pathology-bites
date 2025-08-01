// src/components/questions/image-search.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Search, X, Check, Plus } from 'lucide-react';
import { fetchImages } from '@/features/images/services/images';
import { ImageData } from '@/features/images/types/images';
import { ImagePreview } from '@/features/images/components/image-preview';
import { QuestionImageFormData } from '@/features/questions/types/questions';

interface ImageSearchProps {
  selectedImages: QuestionImageFormData[];
  onSelectionChange: (images: QuestionImageFormData[]) => void;
  section: 'stem' | 'explanation';
  maxImages?: number;
  title: string;
}

export function ImageSearch({
  selectedImages,
  onSelectionChange,
  section,
  maxImages = 10,
  title
}: ImageSearchProps) {
  const [availableImages, setAvailableImages] = useState<ImageData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [totalImages, setTotalImages] = useState(0);
  const [showSearch, setShowSearch] = useState(false);

  // Filter selected images for this section
  const sectionImages = selectedImages.filter(img => img.question_section === section);

  const loadImages = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchImages({
        page,
        pageSize: 12,
        searchTerm: searchTerm || undefined,
        category: categoryFilter === 'all' ? undefined : categoryFilter,
        showUnusedOnly: false
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
    if (showSearch) {
      loadImages();
    }
  }, [showSearch, loadImages]);

  const handleImageToggle = (imageId: string) => {
    const isSelected = sectionImages.some(img => img.image_id === imageId);

    if (isSelected) {
      // Remove image
      const updatedImages = selectedImages.filter(
        img => !(img.image_id === imageId && img.question_section === section)
      );
      onSelectionChange(updatedImages);
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

  const handleRemoveImage = (imageId: string) => {
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

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setPage(0);
  };

  const handleCategoryChange = (category: string) => {
    setCategoryFilter(category);
    setPage(0);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{title}</label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowSearch(!showSearch)}
        >
          <Plus className="h-4 w-4 mr-1" />
          {showSearch ? 'Hide Search' : 'Add Images'}
        </Button>
      </div>

      {/* Selected Images Display */}
      {sectionImages.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Selected Images ({sectionImages.length}/{maxImages})
          </p>
          <div className="flex flex-wrap gap-2">
            {sectionImages
              .sort((a, b) => a.order_index - b.order_index)
              .map((imageData) => {
                const image = availableImages.find(img => img.id === imageData.image_id);
                if (!image) return null;
                return (
                  <div key={imageData.image_id} className="relative group">
                    <div className="w-16 h-16 rounded border overflow-hidden">
                      <ImagePreview
                        src={image.url}
                        alt={image.alt_text || ''}
                        size="sm"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <Badge
                      variant="secondary"
                      className="absolute -top-2 -left-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                    >
                      {imageData.order_index + 1}
                    </Badge>
                    <button
                      type="button"
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleRemoveImage(imageData.image_id)}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Image Search Interface */}
      {showSearch && (
        <div className="border rounded-lg p-4 space-y-4">
          {/* Search Controls */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search images..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={categoryFilter} onValueChange={handleCategoryChange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="gross">Gross</SelectItem>
                <SelectItem value="microscopic">Microscopic</SelectItem>
                <SelectItem value="figure">Figure</SelectItem>
                <SelectItem value="table">Table</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Images Grid */}
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center items-center h-32">
                <div className="text-sm text-muted-foreground">Loading images...</div>
              </div>
            ) : availableImages.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">
                No images found
              </div>
            ) : (
              <div className="grid grid-cols-6 gap-2">
                {availableImages.map((image) => {
                  const isSelected = sectionImages.some(img => img.image_id === image.id);
                  const canSelect = !isSelected && sectionImages.length < maxImages;

                  return (
                    <div
                      key={image.id}
                      className={`relative cursor-pointer rounded border-2 transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/10'
                          : canSelect
                            ? 'border-border hover:border-primary/50'
                            : 'border-border opacity-50 cursor-not-allowed'
                      }`}
                      onClick={() => (canSelect || isSelected) ? handleImageToggle(image.id) : undefined}
                      title={image.alt_text || ''}
                    >
                      <div className="aspect-square rounded overflow-hidden">
                        <ImagePreview
                          src={image.url}
                          alt={image.alt_text || ''}
                          size="sm"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      {isSelected && (
                        <div className="absolute top-0 right-0 bg-primary text-primary-foreground rounded-full w-4 h-4 text-xs flex items-center justify-center">
                          ✓
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {totalImages > 12 && (
              <div className="flex justify-center gap-2 mt-4 pt-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground self-center">
                  Page {page + 1} of {Math.ceil(totalImages / 12)}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={(page + 1) * 12 >= totalImages}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
