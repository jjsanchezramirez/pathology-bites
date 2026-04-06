"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogOverlay,
  DialogPortal,
} from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Button } from "@/shared/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "@/shared/utils/ui/toast";
import type { SvgAsset } from "../types";

interface EditSvgDialogProps {
  asset: SvgAsset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

export function EditSvgDialog({ asset, open, onOpenChange, onSave }: EditSvgDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [category, setCategory] = useState("");

  // Initialize state when asset changes or dialog opens
  useEffect(() => {
    if (asset && open) {
      setName(asset.name || "");
      setDescription(asset.description || "");
      setTags(asset.tags?.join(", ") || "");
      setCategory(asset.category || "");
    }
  }, [asset, open]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setName("");
      setDescription("");
      setTags("");
      setCategory("");
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asset || !name.trim()) return;

    setIsSubmitting(true);
    try {
      const tagsArray = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const response = await fetch(`/api/admin/svg-assets/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          tags: tagsArray.length > 0 ? tagsArray : null,
          category: category.trim() || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Update failed");
      }

      toast.success("SVG asset updated successfully");
      onOpenChange(false);

      setTimeout(() => {
        onSave();
      }, 100);
    } catch (error) {
      console.error("Failed to update SVG asset:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update SVG asset");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!asset) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="backdrop-blur-md bg-black/20" />
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit SVG Asset</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4">
            {/* SVG Preview */}
            <div className="flex justify-center rounded-lg border bg-muted/10 p-4">
              <img
                src={asset.url}
                alt={asset.name}
                className="max-h-32 max-w-full object-contain"
              />
            </div>

            {/* Details */}
            <div className="text-xs text-muted-foreground space-y-1 bg-muted/20 rounded-lg p-3 border">
              <p>
                <span className="font-medium text-foreground">Size:</span>{" "}
                {asset.file_size_bytes < 1024
                  ? `${asset.file_size_bytes} B`
                  : asset.file_size_bytes < 1024 * 1024
                    ? `${(asset.file_size_bytes / 1024).toFixed(1)} KB`
                    : `${(asset.file_size_bytes / (1024 * 1024)).toFixed(2)} MB`}
              </p>
              {asset.width && asset.height && (
                <p>
                  <span className="font-medium text-foreground">Dimensions:</span> {asset.width} x{" "}
                  {asset.height}
                </p>
              )}
              <p>
                <span className="font-medium text-foreground">Uploaded:</span>{" "}
                {new Date(asset.created_at).toLocaleDateString()}
              </p>
            </div>

            {/* Edit Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name" className="text-sm font-medium">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="SVG asset name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description" className="text-sm font-medium">
                  Description
                </Label>
                <Textarea
                  id="edit-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-tags" className="text-sm font-medium">
                  Tags
                </Label>
                <Input
                  id="edit-tags"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="Comma-separated tags"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-category" className="text-sm font-medium">
                  Category
                </Label>
                <Input
                  id="edit-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g., histology, anatomy"
                />
              </div>

              <div className="flex items-center gap-3 pt-2 border-t">
                <Button type="submit" disabled={isSubmitting || !name.trim()} className="flex-1">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
