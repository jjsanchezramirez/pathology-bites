"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";

import { Input } from "@/shared/components/ui/input";
import { Dialog, DialogTrigger, DialogPortal } from "@/shared/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

import { Search, X, Plus, Image as ImageIcon } from "lucide-react";
import { fetchImages } from "@/features/images/services/images";
import { ImageData } from "@/features/images/types/images";
import { ImagePreview } from "@/features/images/components/image-preview";
import Image from "next/image";

interface ImageAttachment {
  image_id: string;
  question_section: "stem" | "explanation";
  order_index: number;
}

interface ImageAttachmentsTabProps {
  attachedImages: ImageAttachment[];
  onAttachedImagesChange: (images: ImageAttachment[]) => void;
  isClinicalPathology?: boolean;
}

interface MediaSectionProps {
  images: ImageAttachment[];
  section: "stem" | "explanation";
  maxImages: number;
  onImagesChange: (images: ImageAttachment[]) => void;
}

function MediaSection({ images, section, maxImages, onImagesChange }: MediaSectionProps) {
  const [availableImages, setAvailableImages] = useState<ImageData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [imageCache, setImageCache] = useState<Map<string, ImageData>>(new Map());

  const loadImages = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchImages({
        page: 0,
        pageSize: 100, // Fetch more images to ensure we have 20 available
        searchTerm: searchTerm || undefined,
        category: categoryFilter === "all" ? undefined : categoryFilter,
        showUnusedOnly: false,
      });

      if (result.error) {
        console.error("Failed to load images:", result.error);
        throw new Error(typeof result.error === "string" ? result.error : "Failed to load images");
      }

      setAvailableImages(result.data);
      // Cache images by ID for quick lookup
      setImageCache((prevCache) => {
        const newCache = new Map(prevCache);
        result.data.forEach((img) => newCache.set(img.id, img));
        return newCache;
      });
    } catch (error) {
      console.error("Failed to load images:", error);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, categoryFilter]);

  useEffect(() => {
    if (showImagePicker) {
      loadImages();
      // Pre-populate selectedImageIds with already attached images
      setSelectedImageIds(images.map((img) => img.image_id));
    }
  }, [showImagePicker, searchTerm, categoryFilter, images, loadImages]);

  // Load metadata for already attached images on mount and when images change
  useEffect(() => {
    const loadAttachedImagesMetadata = async () => {
      if (images.length === 0) return;

      setImageCache((currentCache) => {
        // Get image IDs that aren't already in cache
        const uncachedImageIds = images
          .map((img) => img.image_id)
          .filter((id) => !currentCache.has(id));

        if (uncachedImageIds.length === 0) return currentCache;

        // Fetch images asynchronously and update cache
        fetchImages({
          page: 0,
          pageSize: 100,
          showUnusedOnly: false,
        })
          .then((result) => {
            if (!result.error && result.data) {
              setImageCache((prevCache) => {
                const newCache = new Map(prevCache);
                result.data.forEach((img) => {
                  if (uncachedImageIds.includes(img.id)) {
                    newCache.set(img.id, img);
                  }
                });
                return newCache;
              });
            }
          })
          .catch((error) => {
            console.error("Failed to load attached images metadata:", error);
          });

        return currentCache;
      });
    };

    loadAttachedImagesMetadata();
  }, [images]);

  const getImageInfo = (imageId: string): ImageData | null => {
    // First check cache, then check availableImages
    return imageCache.get(imageId) || availableImages.find((img) => img.id === imageId) || null;
  };

  const handleRemoveImage = (imageId: string, index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    // Reorder remaining images
    const reorderedImages = newImages.map((img, idx) => ({
      ...img,
      order_index: idx + 1,
    }));
    onImagesChange(reorderedImages);
  };

  const handleImageToggle = (imageId: string) => {
    setSelectedImageIds((prev) => {
      if (prev.includes(imageId)) {
        // Allow deselection
        return prev.filter((id) => id !== imageId);
      } else {
        // Check if we would exceed the limit
        if (prev.length >= maxImages) {
          return prev; // Don't add more if it would exceed limit
        }
        return [...prev, imageId];
      }
    });
  };

  const handleSelectImages = () => {
    // Replace images with current selection
    const newImages = selectedImageIds.map((imageId, index) => ({
      image_id: imageId,
      question_section: section,
      order_index: index + 1,
    }));

    onImagesChange(newImages);
    setSelectedImageIds([]);
    setShowImagePicker(false);
  };

  const handleCancelSelection = () => {
    setSelectedImageIds([]);
    setShowImagePicker(false);
    setSearchTerm("");
  };

  return (
    <div>
      <div className="flex flex-wrap gap-4">
        {/* Existing Images - Stacked to Left with Space for 5 */}
        {images.map((imageItem, index) => {
          const uniqueKey = `${imageItem.image_id}-${index}`;
          const imageInfo = getImageInfo(imageItem.image_id);

          return (
            <div key={uniqueKey} className="relative group">
              <div className="aspect-square bg-muted rounded-lg border overflow-hidden relative w-32 h-32">
                {imageInfo ? (
                  <Image
                    src={imageInfo.url}
                    alt={imageInfo.alt_text || ""}
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
                onClick={() => handleRemoveImage(imageItem.image_id, index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          );
        })}

        {/* Add Image Button */}
        {images.length < maxImages && (
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
                <div
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                  onClick={() => setShowImagePicker(false)}
                />
                <div className="relative bg-background border rounded-lg shadow-lg w-[1200px] max-w-[95vw] h-[75vh] flex flex-col overflow-hidden">
                  <div className="p-6 border-b flex-shrink-0">
                    <h2 className="text-xl font-semibold">
                      Select Images for {section === "stem" ? "Question Body" : "Explanation"}
                    </h2>
                  </div>

                  <div className="p-6 space-y-4 flex flex-col flex-1 overflow-hidden">
                    {/* Search Controls */}
                    <div className="flex gap-2 flex-shrink-0">
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
                        {loading ? "Loading..." : "Search"}
                      </Button>
                    </div>

                    {/* Image Grid - 6 columns with smaller thumbnails */}
                    <div
                      className="grid grid-cols-6 gap-2 overflow-y-auto flex-1"
                      style={{ minHeight: 0 }}
                    >
                      {availableImages.length === 0 && !loading ? (
                        <div className="col-span-6 flex flex-col items-center justify-center h-full text-muted-foreground">
                          <ImageIcon className="h-12 w-12 mb-2 opacity-50" />
                          <p>No images found</p>
                          {searchTerm && <p className="text-sm">Try a different search term</p>}
                        </div>
                      ) : (
                        availableImages.map((image) => {
                          const isSelected = selectedImageIds.includes(image.id);
                          const canSelect = selectedImageIds.length < maxImages || isSelected;
                          const orderNumber = isSelected
                            ? selectedImageIds.indexOf(image.id) + 1
                            : null;

                          return (
                            <div key={image.id} className="relative group">
                              <div
                                className={`aspect-square overflow-hidden rounded border-2 transition-all relative ${
                                  isSelected
                                    ? "border-primary ring-2 ring-primary/20"
                                    : canSelect
                                      ? "border-border hover:border-primary/50 cursor-pointer"
                                      : "border-muted opacity-50 cursor-not-allowed"
                                }`}
                                onClick={() => canSelect && handleImageToggle(image.id)}
                                title={image.alt_text || ""}
                              >
                                <ImagePreview
                                  src={image.url}
                                  alt={image.alt_text || ""}
                                  size="sm"
                                  className="w-full h-full !rounded-none"
                                  disableFullscreen={true}
                                />
                                {isSelected && orderNumber !== null && (
                                  <div className="absolute top-1.5 right-1.5 bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold shadow-lg ring-2 ring-white z-20 pointer-events-none">
                                    {orderNumber}
                                  </div>
                                )}
                              </div>
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
                        Save {selectedImageIds.length} Image
                        {selectedImageIds.length !== 1 ? "s" : ""}
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

export function ImageAttachmentsTab({
  attachedImages,
  onAttachedImagesChange,
  isClinicalPathology = false,
}: ImageAttachmentsTabProps) {
  const handleImagesChange = (newImages: ImageAttachment[]) => {
    onAttachedImagesChange(newImages);
  };

  const stemImages = attachedImages.filter((img) => img.question_section === "stem");
  const explanationImages = attachedImages.filter((img) => img.question_section === "explanation");

  return (
    <div className="space-y-8">
      {/* Question Body Images */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Question Body Images {isClinicalPathology && <span className="text-sm font-normal text-muted-foreground">(Optional)</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!isClinicalPathology && (
            <p className="text-sm text-muted-foreground mb-4">
              Add histological images, gross pathology images, or other visual content to the question stem.
            </p>
          )}
          {isClinicalPathology && (
            <p className="text-sm text-muted-foreground mb-4">
              Add laboratory data, graphs, flow cytometry plots, or other relevant visual aids (optional for Clinical Pathology).
            </p>
          )}
          <MediaSection
            images={stemImages}
            section="stem"
            maxImages={5}
            onImagesChange={(newImages) => {
              const explanationImages = attachedImages.filter(
                (img) => img.question_section === "explanation"
              );
              handleImagesChange([...newImages, ...explanationImages]);
            }}
          />
        </CardContent>
      </Card>

      {/* Explanation Images */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Explanation Images {isClinicalPathology && <span className="text-sm font-normal text-muted-foreground">(Optional)</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!isClinicalPathology && (
            <p className="text-sm text-muted-foreground mb-4">
              Add images to support the teaching point or explanation of correct/incorrect answers.
            </p>
          )}
          {isClinicalPathology && (
            <p className="text-sm text-muted-foreground mb-4">
              Add visual aids to support the teaching point (optional for Clinical Pathology).
            </p>
          )}
          <MediaSection
            images={explanationImages}
            section="explanation"
            maxImages={5}
            onImagesChange={(newImages) => {
              const stemImages = attachedImages.filter((img) => img.question_section === "stem");
              handleImagesChange([...stemImages, ...newImages]);
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
