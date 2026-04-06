"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Dialog, DialogPortal } from "@/shared/components/ui/dialog";
import { Search, Image as ImageIcon } from "lucide-react";
import { fetchImages } from "@/features/admin/images/services/images";
import { ImageData } from "@/shared/types/images";
import { ImagePreview } from "@/features/admin/images/components/image-preview";

interface ImagePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (imageIds: string[]) => void;
  maxImages?: number;
}

export function ImagePickerDialog({
  open,
  onOpenChange,
  onSelect,
  maxImages = 5,
}: ImagePickerDialogProps) {
  const [availableImages, setAvailableImages] = useState<ImageData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const loadImages = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchImages({
        page: 0,
        pageSize: 100,
        searchTerm: searchTerm || undefined,
        category: categoryFilter === "all" ? undefined : categoryFilter,
        showUnusedOnly: false,
      });
      if (!result.error) {
        setAvailableImages(result.data);
      }
    } catch (error) {
      console.error("Failed to load images:", error);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, categoryFilter]);

  useEffect(() => {
    if (open) {
      loadImages();
      setSelectedIds([]);
    }
  }, [open, loadImages]);

  const handleToggle = (imageId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(imageId)) return prev.filter((id) => id !== imageId);
      if (prev.length >= maxImages) return prev;
      return [...prev, imageId];
    });
  };

  const handleConfirm = () => {
    onSelect(selectedIds);
    onOpenChange(false);
    setSelectedIds([]);
    setSearchTerm("");
  };

  const handleCancel = () => {
    onOpenChange(false);
    setSelectedIds([]);
    setSearchTerm("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleCancel}
          />
          <div className="relative bg-background border rounded-lg shadow-lg w-[1200px] max-w-[95vw] h-[75vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b flex-shrink-0">
              <h2 className="text-xl font-semibold">Select Images</h2>
            </div>

            <div className="p-6 space-y-4 flex flex-col flex-1 overflow-hidden">
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

              <div
                className="grid grid-cols-6 gap-2 overflow-y-auto flex-1"
                style={{ minHeight: 0 }}
              >
                {availableImages.length === 0 && !loading ? (
                  <div className="col-span-6 flex flex-col items-center justify-center h-full text-muted-foreground">
                    <ImageIcon className="h-12 w-12 mb-2 opacity-50" />
                    <p>No images found</p>
                    {searchTerm && (
                      <p className="text-sm">Try a different search term</p>
                    )}
                  </div>
                ) : (
                  availableImages.map((image) => {
                    const isSelected = selectedIds.includes(image.id);
                    const canSelect = selectedIds.length < maxImages || isSelected;
                    const orderNumber = isSelected
                      ? selectedIds.indexOf(image.id) + 1
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
                          onClick={() => canSelect && handleToggle(image.id)}
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

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={selectedIds.length === 0}
                >
                  Insert {selectedIds.length} Image
                  {selectedIds.length !== 1 ? "s" : ""}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogPortal>
    </Dialog>
  );
}
