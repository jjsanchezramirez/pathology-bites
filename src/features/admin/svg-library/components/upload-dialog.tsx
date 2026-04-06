"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { toast } from "@/shared/utils/ui/toast";
import { Upload, Loader2, Shapes } from "lucide-react";

interface SvgUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function SvgUploadDialog({ open, onOpenChange, onSuccess }: SvgUploadDialogProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [category, setCategory] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setFile(null);
      setName("");
      setDescription("");
      setTags("");
      setCategory("");
      setError("");
      setIsDragging(false);
    }
  }, [open]);

  const handleFilePicked = useCallback(
    (pickedFile: File) => {
      const isSvg =
        pickedFile.type === "image/svg+xml" || pickedFile.name.toLowerCase().endsWith(".svg");
      if (!isSvg) {
        toast.error("Please select an SVG file.");
        return;
      }
      setFile(pickedFile);
      if (!name) {
        setName(pickedFile.name.replace(/\.svg$/i, ""));
      }
    },
    [name]
  );

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isUploading) setIsDragging(true);
    },
    [isUploading]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (isUploading) return;
      const droppedFile = e.dataTransfer.files?.[0];
      if (droppedFile) handleFilePicked(droppedFile);
    },
    [isUploading, handleFilePicked]
  );

  const handleUpload = async () => {
    if (!file) {
      setError("Please select an SVG file");
      return;
    }
    if (!name.trim()) {
      setError("Please provide a name");
      return;
    }

    setIsUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", name.trim());
      if (description.trim()) formData.append("description", description.trim());
      if (tags.trim()) {
        const tagsArray = tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        formData.append("tags", JSON.stringify(tagsArray));
      }
      if (category.trim()) formData.append("category", category.trim());

      const response = await fetch("/api/admin/svg-assets/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Upload failed");
      }

      toast.success("SVG asset uploaded successfully!");
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload SVG Asset</DialogTitle>
          <DialogDescription>Upload an SVG file to the asset library</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop Zone */}
          <div
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => {
              if (isUploading) return;
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".svg,image/svg+xml";
              input.onchange = (e) => {
                const f = (e.target as HTMLInputElement).files?.[0];
                if (f) handleFilePicked(f);
              };
              input.click();
            }}
            className={[
              "relative flex flex-col items-center justify-center w-full h-40",
              "border-2 border-dashed rounded-lg cursor-pointer",
              "transition-colors duration-200",
              isDragging ? "border-primary bg-primary/5" : "border-muted hover:bg-muted/50",
              isUploading ? "opacity-60 cursor-not-allowed" : "",
            ].join(" ")}
          >
            <div className="flex flex-col items-center justify-center gap-2 text-center px-4">
              {file ? (
                <>
                  <Shapes className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">Click or drop to replace</p>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {isDragging ? "Drop SVG file here" : "Drag & drop or click to select"}
                  </p>
                  <p className="text-xs text-muted-foreground">SVG files only</p>
                </>
              )}
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="svg-name">Name *</Label>
            <Input
              id="svg-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Cell Membrane Diagram"
              disabled={isUploading}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="svg-description">Description (Optional)</Label>
            <Textarea
              id="svg-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the SVG asset..."
              rows={2}
              disabled={isUploading}
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="svg-tags">Tags (Optional)</Label>
            <Input
              id="svg-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g., anatomy, cell, membrane (comma-separated)"
              disabled={isUploading}
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="svg-category">Category (Optional)</Label>
            <Input
              id="svg-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g., histology, anatomy, diagram"
              disabled={isUploading}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleUpload}
              disabled={isUploading || !file || !name.trim()}
              className="flex-1"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Upload SVG"
              )}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUploading}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
