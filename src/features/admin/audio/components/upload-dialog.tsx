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
import { Upload, Sparkles, FileText, Music, Loader2 } from "lucide-react";
import {
  ContentSelector,
  EducationalContent,
} from "@/features/admin/questions/components/create/content-selector";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { ACTIVE_AI_MODELS } from "@/shared/config/ai-models";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { CATEGORIES } from "@/shared/config/categories";

export interface AudioFileReadyState {
  /** The file to upload */
  file: File;
  /** File size (kept for backwards compatibility) */
  originalSize: number;
  /** Duration in seconds extracted from the audio using native HTML5 Audio API */
  duration: number | null;
}

interface AudioUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  /** File with duration extracted using native HTML5 Audio API */
  fileReady?: AudioFileReadyState | null;
  /** Called when user wants to pick/replace the file — page owns the picker */
  onRequestFilePick?: () => void;
}

export function AudioUploadDialog({
  open,
  onOpenChange,
  onSuccess,
  fileReady,
  onRequestFilePick,
}: AudioUploadDialogProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [transcript, setTranscript] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");

  // AI text generation state
  const [selectedContent, setSelectedContent] = useState<EducationalContent | null>(null);
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const isWorking = isUploading;

  // Auto-fill title when a new file arrives
  useEffect(() => {
    if (fileReady && !title) {
      setTitle(fileReady.file.name.replace(/\.[^.]+$/, ""));
    }
  }, [fileReady, title]);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setTitle("");
      setDescription("");
      setCategory("");
      setTranscript("");
      setError("");
      setSelectedContent(null);
      setAdditionalInstructions("");
      setIsGenerating(false);
      setIsDragging(false);
    }
  }, [open]);

  // Drag handlers — dropping a file delegates to the page's file picker
  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isWorking) setIsDragging(true);
    },
    [isWorking]
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
      if (isWorking) return;
      // The page owns the actual file processing — signal it via a custom event
      // carrying the dropped file so the page can run FFmpeg on it.
      const file = e.dataTransfer.files?.[0];
      if (file) {
        const event = new CustomEvent("audio-drop", { detail: { file }, bubbles: true });
        e.currentTarget.dispatchEvent(event);
      }
    },
    [isWorking]
  );

  const handleGenerateText = async () => {
    if (!selectedContent) {
      setError("Please select educational content (category, subject, lesson, and topic)");
      return;
    }

    setIsGenerating(true);
    setError("");

    try {
      const response = await fetch("/test/ai-studio/generate-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: selectedContent,
          additionalInstructions,
          model: selectedModel,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate text");
      }

      setTranscript(data.text);

      if (!title) {
        setTitle(`${selectedContent.subject} - ${selectedContent.topic}`);
      }
      if (!description) {
        setDescription(
          `Educational audio covering ${selectedContent.topic} from ${selectedContent.lesson}`
        );
      }

      toast.success(`Generated ${data.metadata.word_count} words`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate text";
      setError(message);
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpload = async () => {
    if (!fileReady) {
      setError("Please select an audio file");
      return;
    }
    if (!title.trim()) {
      setError("Please provide a title");
      return;
    }

    setIsUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", fileReady.file);
      formData.append("title", title.trim());
      if (description.trim()) formData.append("description", description.trim());
      if (category) formData.append("pathology_category_id", category);
      if (transcript.trim()) formData.append("generated_text", transcript.trim());
      if (fileReady.duration) formData.append("duration_seconds", fileReady.duration.toString());

      const response = await fetch("/api/admin/audio/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Upload failed");
      }

      toast.success("Audio uploaded successfully!");
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Audio File</DialogTitle>
          <DialogDescription>
            Upload an audio file or generate a script for TTS conversion
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">
              <Upload className="h-4 w-4 mr-2" />
              Upload File
            </TabsTrigger>
            <TabsTrigger value="generate">
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Script
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-4">
            <div
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !isWorking && onRequestFilePick?.()}
              className={[
                "relative flex flex-col items-center justify-center w-full h-40",
                "border-2 border-dashed rounded-lg cursor-pointer",
                "transition-colors duration-200",
                isDragging ? "border-primary bg-primary/5" : "border-muted hover:bg-muted/50",
                isWorking ? "opacity-60 cursor-not-allowed" : "",
              ].join(" ")}
            >
              <div className="flex flex-col items-center justify-center gap-2 text-center px-4">
                {fileReady ? (
                  <>
                    <Music className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{fileReady.file.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {(fileReady.file.size / 1024 / 1024).toFixed(2)} MB
                        {fileReady.duration
                          ? ` • ${Math.floor(fileReady.duration / 60)}:${String(Math.floor(fileReady.duration % 60)).padStart(2, "0")}`
                          : ""}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">Click or drop to replace</p>
                  </>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {isDragging ? "Drop audio file here" : "Drag & drop or click to select"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      MP3, WAV, M4A, OGG, WebM, and other browser-supported formats
                    </p>
                  </>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="generate" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="model">AI Model</Label>
              <Select
                value={selectedModel}
                onValueChange={setSelectedModel}
                disabled={isGenerating}
              >
                <SelectTrigger id="model">
                  <SelectValue placeholder="Select AI model" />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVE_AI_MODELS.filter((m) => m.available).map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Educational Content *</Label>
              <ContentSelector
                onContentSelect={setSelectedContent}
                selectedContent={selectedContent}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="instructions">Additional Instructions (Optional)</Label>
              <Textarea
                id="instructions"
                value={additionalInstructions}
                onChange={(e) => setAdditionalInstructions(e.target.value)}
                placeholder="e.g., Target duration: 2 minutes, Focus on differential diagnosis..."
                rows={3}
                disabled={isGenerating}
              />
            </div>

            <Button
              onClick={handleGenerateText}
              disabled={isGenerating || !selectedContent}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Sparkles className="mr-2 h-4 w-4 animate-spin" />
                  Generating Script...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Generate Script
                </>
              )}
            </Button>
          </TabsContent>
        </Tabs>

        {/* Common fields */}
        <div className="space-y-4 border-t pt-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Breast Pathology - Invasive Ductal Carcinoma"
              disabled={isWorking}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the audio content..."
              rows={2}
              disabled={isWorking}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Pathology Category (Optional)</Label>
            <Select
              value={category || "none"}
              onValueChange={(value) => setCategory(value === "none" ? "" : value)}
              disabled={isWorking}
            >
              <SelectTrigger id="category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="none">None</SelectItem>
                {[...CATEGORIES]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.shortForm} — {cat.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="transcript">Transcript / Script</Label>
            <Textarea
              id="transcript"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste the audio transcript here for searchability and accessibility..."
              rows={8}
              disabled={isWorking}
            />
            {transcript && (
              <p className="text-sm text-muted-foreground">
                Words: {transcript.split(/\s+/).filter((w) => w).length}
              </p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleUpload}
              disabled={isWorking || !fileReady || !title.trim()}
              className="flex-1"
            >
              {isUploading ? "Uploading..." : "Upload Audio"}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isWorking}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
