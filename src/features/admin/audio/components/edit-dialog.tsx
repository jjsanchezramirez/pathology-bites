"use client";

import { useState, useEffect } from "react";
import { updateAudio } from "@/features/admin/audio/services/audio";
import type { Audio } from "@/features/admin/audio/types";
import { toast } from "@/shared/utils/ui/toast";
import { CATEGORIES } from "@/shared/config/categories";
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
import { Loader2, ExternalLink } from "lucide-react";

interface EditAudioDialogProps {
  audio: Audio | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

export function EditAudioDialog({ audio, open, onOpenChange, onSave }: EditAudioDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [transcript, setTranscript] = useState("");
  const [pathologyCategory, setPathologyCategory] = useState<string>("");

  // Initialize state when audio changes or dialog opens
  useEffect(() => {
    if (audio && open) {
      setTitle(audio.title || "");
      setDescription(audio.description || "");
      setTranscript(audio.generated_text || "");
      setPathologyCategory(audio.pathology_category_id || "");
    }
  }, [audio, open]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setTitle("");
      setDescription("");
      setTranscript("");
      setPathologyCategory("");
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!audio || !title.trim()) return;

    setIsSubmitting(true);
    try {
      const data = {
        title: title.trim(),
        description: description.trim() || null,
        generated_text: transcript.trim() || null,
        pathology_category_id:
          pathologyCategory && pathologyCategory !== "none" ? pathologyCategory : null,
      };

      await updateAudio(audio.id, data);
      toast.success("Audio updated successfully");

      // Close dialog first
      onOpenChange(false);

      // Then trigger refresh after a short delay
      setTimeout(() => {
        onSave();
      }, 100);
    } catch (error) {
      console.error("Failed to update audio:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update audio");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatDuration = (seconds: number | null): string => {
    if (!seconds || seconds === 0) return "Unknown";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!audio) return null;

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
            <DialogTitle>Edit Audio</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Audio Player & Details */}
            <div className="space-y-4">
              {/* Audio Player */}
              <div className="rounded-lg border bg-muted/10 p-4">
                <audio
                  controls
                  src={audio.url}
                  className="w-full"
                  crossOrigin="anonymous"
                  preload="metadata"
                />
              </div>

              {/* Open in New Tab Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(audio.url, "_blank")}
                className="w-full"
                title="Open audio in new tab"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Full Audio
              </Button>

              {/* Audio Details Card */}
              <div className="text-xs text-muted-foreground space-y-2 bg-muted/20 rounded-lg p-4 border">
                <h4 className="font-medium text-foreground text-sm mb-2">Audio Details</h4>
                <div className="space-y-1">
                  <p>
                    <span className="font-medium text-foreground">File Type:</span>{" "}
                    {audio.file_type || "Unknown"}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Size:</span>{" "}
                    {formatFileSize(audio.file_size_bytes || 0)}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Duration:</span>{" "}
                    {formatDuration(audio.duration_seconds)}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Uploaded:</span>{" "}
                    {new Date(audio.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Edit Form */}
            <div className="lg:col-span-2">
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Title Field */}
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-sm font-medium">
                    Title <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Breast Pathology - Invasive Ductal Carcinoma"
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
                    placeholder="Brief description of the audio content..."
                    className="min-h-24 resize-none"
                  />
                </div>

                {/* Pathology Category */}
                <div className="space-y-2">
                  <Label htmlFor="pathologyCategory" className="text-sm font-medium">
                    Pathology Category
                  </Label>
                  <Select
                    value={pathologyCategory || "none"}
                    onValueChange={(value) => setPathologyCategory(value === "none" ? "" : value)}
                  >
                    <SelectTrigger id="pathologyCategory" className="h-10">
                      <SelectValue placeholder="Select category (optional)" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <SelectItem value="none">None</SelectItem>
                      {sortedCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.shortForm} - {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Associate this audio with a specific pathology topic
                  </p>
                </div>

                {/* Transcript Field */}
                <div className="space-y-2">
                  <Label htmlFor="transcript" className="text-sm font-medium">
                    Transcript / Script
                  </Label>
                  <Textarea
                    id="transcript"
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    placeholder="Audio transcript for searchability and accessibility..."
                    className="min-h-48 resize-y"
                  />
                  {transcript && (
                    <p className="text-xs text-muted-foreground">
                      Words: {transcript.split(/\s+/).filter((w) => w).length}
                    </p>
                  )}
                </div>

                {/* Form Actions */}
                <div className="flex items-center gap-3 pt-4 border-t">
                  <Button type="submit" disabled={isSubmitting || !title.trim()} className="flex-1">
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
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
