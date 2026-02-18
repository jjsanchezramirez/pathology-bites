"use client";

import { useState, useEffect, useRef } from "react";
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
  DialogPortal,
  DialogOverlay,
} from "@/shared/components/ui/dialog";

const PAGE_SIZE = 40;
const DEBOUNCE_MS = 350;

interface LibraryImage {
  id: string;
  url: string;
  description?: string;
  alt_text?: string;
  category?: string;
  file_type: string;
  width: number;
  height: number;
  magnification?: string | null;
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedImages, setSelectedImages] = useState<LibraryImage[]>([]);

  // Debounced values used for actual fetching
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [debouncedCategory, setDebouncedCategory] = useState<string>("all");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search term changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchTerm]);

  // Category changes apply immediately (no debounce needed for a dropdown)
  useEffect(() => {
    setDebouncedCategory(categoryFilter);
  }, [categoryFilter]);

  // Fetch first page whenever dialog opens or filters change
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    async function fetchFirstPage() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
        if (debouncedSearch) params.set("search", debouncedSearch);
        if (debouncedCategory !== "all") params.set("category", debouncedCategory);

        const res = await fetch(`/api/admin/library/images?${params}`);
        const data = await res.json();
        if (!cancelled) {
          setImages(data.images ?? []);
          setHasMore(data.hasMore ?? false);
        }
      } catch (err) {
        console.error("Error loading images:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchFirstPage();
    return () => {
      cancelled = true;
    };
  }, [isOpen, debouncedSearch, debouncedCategory]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(images.length),
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (debouncedCategory !== "all") params.set("category", debouncedCategory);

      const res = await fetch(`/api/admin/library/images?${params}`);
      const data = await res.json();
      setImages((prev) => [...prev, ...(data.images ?? [])]);
      setHasMore(data.hasMore ?? false);
    } catch (err) {
      console.error("Error loading more images:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleImageClick = (image: LibraryImage) => {
    const exists = selectedImages.some((img) => img.id === image.id);
    setSelectedImages(
      exists ? selectedImages.filter((img) => img.id !== image.id) : [...selectedImages, image]
    );
  };

  const handleAdd = () => {
    if (onSelectMultiple) {
      onSelectMultiple(selectedImages);
    } else {
      selectedImages.forEach((image) => onSelect(image));
    }
    setSelectedImages([]);
    setIsOpen(false);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setSelectedImages([]);
      setSearchTerm("");
      setDebouncedSearch("");
      setCategoryFilter("all");
      setDebouncedCategory("all");
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

      <DialogPortal>
        <DialogOverlay />
        <DialogContent className="w-[90vw] max-w-none sm:max-w-none max-h-[85vh] flex flex-col gap-4 overflow-hidden">
          <DialogHeader>
            <DialogTitle>Select Images</DialogTitle>
            <DialogDescription>
              Browse your library and select images to add to the lesson sequence.
            </DialogDescription>
          </DialogHeader>

          {/* Search and filter */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search images…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                autoFocus
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

          {/* Grid */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                <Search className="h-4 w-4 animate-pulse mr-2" />
                Loading…
              </div>
            ) : images.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                No images found
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-6 gap-2">
                  {images.map((image) => {
                    const orderIndex = selectedImages.findIndex((img) => img.id === image.id);
                    const isSelected = orderIndex >= 0;

                    return (
                      <div
                        key={image.id}
                        className="relative group cursor-pointer"
                        onClick={() => handleImageClick(image)}
                      >
                        <div
                          className={`aspect-square overflow-hidden rounded border-2 transition-all relative ${
                            isSelected
                              ? "border-primary ring-2 ring-primary/20"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <Image
                            src={image.url}
                            alt={image.description || image.alt_text || ""}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                          {isSelected && (
                            <div className="absolute top-1.5 right-1.5 bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-lg ring-2 ring-white z-20 pointer-events-none">
                              {orderIndex + 1}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {hasMore && (
                  <div className="flex justify-center pb-2">
                    <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
                      {loadingMore ? "Loading…" : `Load more`}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t shrink-0">
            <span className="text-sm text-muted-foreground">
              {images.length > 0 && <span className="mr-3 text-xs">{images.length} shown</span>}
              {selectedImages.length > 0
                ? `${selectedImages.length} image${selectedImages.length !== 1 ? "s" : ""} selected`
                : "No images selected"}
            </span>
            <Button onClick={handleAdd} disabled={selectedImages.length === 0}>
              Add to Sequence
            </Button>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
