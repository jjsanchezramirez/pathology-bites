// src/components/images/edit-dialog.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { updateImage } from "@/features/images/services/images";
import { ImageData, IMAGE_CATEGORIES, ImageCategory } from "@/features/images/types/images";
import { useImageReupload } from "@/features/images/hooks/use-image-reupload";
import { toast } from "@/shared/utils/toast";
import { CATEGORIES } from "@/shared/constants/categories";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogOverlay,
  DialogPortal,
} from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Button } from "@/shared/components/ui/button";

import { Loader2, Upload, X, ExternalLink } from "lucide-react";

interface EditImageDialogProps {
  image: ImageData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

const MAGNIFICATIONS = ["2x", "5x", "10x", "20x", "40x", "50x", "60x"] as const;

export function EditImageDialog({ image, open, onOpenChange, onSave }: EditImageDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [description, setDescription] = useState("");
  const [altText, setAltText] = useState("");
  const [imageType, setImageType] = useState<ImageCategory>("microscopic");
  const [pathologyCategory, setPathologyCategory] = useState<string>("");
  const [magnification, setMagnification] = useState<string>("");
  const [sourceRef, setSourceRef] = useState("");
  const [, setSelectedFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { reuploadImage, isUploading } = useImageReupload({
    onSuccess: () => {
      setSelectedFile(null);
      onOpenChange(false);
      setTimeout(() => {
        onSave();
      }, 100);
    },
  });

  // Initialize state when image changes or dialog opens
  useEffect(() => {
    if (image && open) {
      setDescription(image.description || "");
      setAltText(image.alt_text || "");
      const imgType = image.category as ImageCategory;
      setImageType(imgType);
      setPathologyCategory(image.pathology_category_id || "");
      // Clear magnification if image type is figure or table
      if (imgType === "figure" || imgType === "table") {
        setMagnification("");
      } else {
        setMagnification(image.magnification || "");
      }
      setSourceRef(image.source_ref || "");
    }
  }, [image, open]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setDescription("");
      setAltText("");
      setImageType("microscopic");
      setPathologyCategory("");
      setMagnification("");
      setSourceRef("");
      setSelectedFile(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!image || !altText.trim()) return;

    setIsSubmitting(true);
    try {
      const data = {
        description: description.trim(),
        alt_text: altText.trim(),
        category: imageType,
        pathology_category_id: pathologyCategory || null,
        // Don't save magnification for figures or tables
        magnification:
          imageType === "figure" || imageType === "table" ? null : magnification || null,
        source_ref: sourceRef.trim() || undefined,
      };

      await updateImage(image.id, data);
      toast.success("Image updated successfully");

      // Close dialog first
      onOpenChange(false);

      // Then trigger refresh after a short delay
      setTimeout(() => {
        onSave();
      }, 100);
    } catch (error) {
      console.error("Failed to update image:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update image");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && image) {
      setSelectedFile(file);
      // Automatically trigger upload
      reuploadImage(image.id, file, false); // false = don't update metadata
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  if (!image) return null;

  // Sort categories by name for better UX
  const sortedCategories = [...CATEGORIES].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="backdrop-blur-md bg-black/20" />
        <DialogContent
          className="!max-w-[1100px] !w-[90vw] max-h-[90vh] overflow-y-auto"
          style={{ maxWidth: "1100px", width: "90vw" }}
          showCloseButton={true}
        >
          <DialogHeader>
            <DialogTitle>Edit Image</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Image Preview & Details */}
            <div className="space-y-4">
              {/* Image Preview */}
              <div className="rounded-lg overflow-hidden relative h-64 border bg-muted/10">
                <Image
                  src={image.url}
                  alt={image.alt_text || ""}
                  className="object-contain"
                  fill
                  unoptimized
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              </div>

              {/* Replace Image Button */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*"
                className="hidden"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1"
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Replace Image
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(image.url, "_blank")}
                  className="px-3"
                  title="Open full size in new tab"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>

              {/* Image Details Card */}
              <div className="text-xs text-muted-foreground space-y-2 bg-muted/20 rounded-lg p-4 border">
                <h4 className="font-medium text-foreground text-sm mb-2">Image Details</h4>
                <div className="space-y-1">
                  <p>
                    <span className="font-medium text-foreground">File Type:</span>{" "}
                    {image.file_type || "Unknown"}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Size:</span>{" "}
                    {formatFileSize(image.file_size_bytes || 0)}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Dimensions:</span> {image.width}×
                    {image.height}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Uploaded:</span>{" "}
                    {new Date(image.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Edit Form */}
            <div className="lg:col-span-2">
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Name Field */}
                <div className="space-y-2">
                  <Label htmlFor="alt_text" className="text-sm font-medium">
                    Image Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="alt_text"
                    value={altText}
                    onChange={(e) => setAltText(e.target.value)}
                    placeholder="e.g., Osteoid osteoma"
                    required
                    className="h-10"
                  />
                </div>

                {/* Description Field */}
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-sm font-medium">
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Detailed description of the image"
                    className="min-h-24 resize-none"
                  />
                </div>

                {/* Two Column Layout for Categories */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Image Type */}
                  <div className="space-y-2">
                    <Label htmlFor="imageType" className="text-sm font-medium">
                      Image Type <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={imageType}
                      onValueChange={(value) => setImageType(value as ImageCategory)}
                    >
                      <SelectTrigger id="imageType" className="h-10">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(IMAGE_CATEGORIES).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Microscopic, Gross, Figure, or Table
                    </p>
                  </div>

                  {/* Pathology Category */}
                  <div className="space-y-2">
                    <Label htmlFor="pathologyCategory" className="text-sm font-medium">
                      Pathology Category
                    </Label>
                    <div className="flex gap-2">
                      <Select value={pathologyCategory} onValueChange={setPathologyCategory}>
                        <SelectTrigger id="pathologyCategory" className="h-10">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {sortedCategories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.shortForm} - {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {pathologyCategory && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setPathologyCategory("")}
                          className="h-10 w-10 shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">BST, GI, Heme, etc.</p>
                  </div>
                </div>

                {/* Two Column Layout for Magnification and Source */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Magnification */}
                  <div className="space-y-2">
                    <Label htmlFor="magnification" className="text-sm font-medium">
                      Magnification
                    </Label>
                    <div className="flex gap-2">
                      <Select
                        value={magnification}
                        onValueChange={setMagnification}
                        disabled={imageType === "figure" || imageType === "table"}
                      >
                        <SelectTrigger id="magnification" className="h-10">
                          <SelectValue placeholder="Select magnification" />
                        </SelectTrigger>
                        <SelectContent>
                          {MAGNIFICATIONS.map((mag) => (
                            <SelectItem key={mag} value={mag}>
                              {mag}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {magnification && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setMagnification("")}
                          className="h-10 w-10 shrink-0"
                          title="Remove magnification"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {imageType === "figure" || imageType === "table"
                        ? "Not applicable to figures or tables"
                        : "Microscope magnification level"}
                    </p>
                  </div>

                  {/* Source Reference */}
                  <div className="space-y-2">
                    <Label htmlFor="source_ref" className="text-sm font-medium">
                      Source Reference
                    </Label>
                    <Input
                      id="source_ref"
                      value={sourceRef}
                      onChange={(e) => setSourceRef(e.target.value)}
                      placeholder="e.g., Case #12345"
                      className="h-10"
                    />
                    <p className="text-xs text-muted-foreground">Optional source or attribution</p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
