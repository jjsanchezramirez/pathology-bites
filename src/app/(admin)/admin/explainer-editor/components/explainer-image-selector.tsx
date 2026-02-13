"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Search } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui/dialog";

interface LibraryImage {
  id: string;
  url: string;
  description?: string;
  alt_text?: string;
  category?: string;
  file_type: string;
  width: number;
  height: number;
  created_at: string;
}

interface ExplainerImageSelectorProps {
  onSelect: (image: LibraryImage) => void;
  onSelectMultiple?: (images: LibraryImage[]) => void;
  trigger?: React.ReactNode;
}

export function ExplainerImageSelector({
  onSelect,
  onSelectMultiple,
  trigger,
}: ExplainerImageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [images, setImages] = useState<LibraryImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedImages, setSelectedImages] = useState<LibraryImage[]>([]);

  const loadImages = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append("search", searchTerm);
      if (categoryFilter && categoryFilter !== "all") params.append("category", categoryFilter);
      params.append("limit", "100");

      const response = await fetch(`/api/admin/library/images?${params}`);
      const data = await response.json();

      if (data.images) {
        setImages(data.images);
      }
    } catch (error) {
      console.error("Error loading images:", error);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, categoryFilter]);

  useEffect(() => {
    if (isOpen) {
      loadImages();
    }
  }, [isOpen, loadImages]);

  const handleImageClick = (image: LibraryImage) => {
    const existingIndex = selectedImages.findIndex((img) => img.id === image.id);

    if (existingIndex >= 0) {
      // Remove from selection
      setSelectedImages(selectedImages.filter((_, i) => i !== existingIndex));
    } else {
      // Add to selection
      setSelectedImages([...selectedImages, image]);
    }
  };

  const handleAddSelected = () => {
    // Add images in sequential order
    if (onSelectMultiple) {
      onSelectMultiple(selectedImages);
    } else {
      selectedImages.forEach((image) => onSelect(image));
    }
    setSelectedImages([]);
    setIsOpen(false);
  };

  const getSelectionOrder = (imageId: string): number | null => {
    const index = selectedImages.findIndex((img) => img.id === imageId);
    return index >= 0 ? index + 1 : null;
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Reset selection when dialog closes
      setSelectedImages([]);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="w-full">
            Select from Library
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Image from Library</DialogTitle>
          <DialogDescription>
            Browse and select images from your library to add to the explainer sequence
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Search and Filters */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search images..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="microscopic">Microscopic</SelectItem>
                <SelectItem value="gross">Gross</SelectItem>
                <SelectItem value="figure">Figure</SelectItem>
                <SelectItem value="table">Table</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Selected Count and Add Button */}
          {selectedImages.length > 0 && (
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
              <span className="text-sm font-medium text-blue-900">
                {selectedImages.length} image{selectedImages.length !== 1 ? "s" : ""} selected
              </span>
              <Button onClick={handleAddSelected}>Add {selectedImages.length} to Sequence</Button>
            </div>
          )}

          {/* Images Grid/List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 mt-4">Loading images...</p>
              </div>
            ) : images.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No images found</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {images.map((image) => {
                  const selectionOrder = getSelectionOrder(image.id);
                  const isSelected = selectionOrder !== null;

                  return (
                    <div
                      key={image.id}
                      className={`relative cursor-pointer rounded-lg border-2 transition-all ${
                        isSelected
                          ? "border-blue-500 shadow-lg ring-2 ring-blue-200"
                          : "border-gray-200 hover:border-blue-300 hover:shadow-md"
                      }`}
                      onClick={() => handleImageClick(image)}
                    >
                      <div className="aspect-[4/3] relative bg-gray-100 rounded-t-lg overflow-hidden">
                        <Image
                          src={image.url}
                          alt={image.description || ""}
                          fill
                          className="object-cover"
                          unoptimized={true}
                        />
                        {/* Selection Order Badge */}
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold shadow-lg">
                            {selectionOrder}
                          </div>
                        )}
                      </div>
                      <div className="p-3 bg-white rounded-b-lg">
                        <p className="text-sm font-medium text-gray-900 line-clamp-2 min-h-[2.5rem]">
                          {image.description || "Untitled Image"}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-gray-500">
                            {image.width} × {image.height}
                          </p>
                          {image.category && (
                            <>
                              <span className="text-xs text-gray-300">•</span>
                              <p className="text-xs text-gray-500 capitalize">{image.category}</p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
