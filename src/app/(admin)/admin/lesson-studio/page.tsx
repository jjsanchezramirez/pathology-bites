"use client";

// React imports
import { useState, useRef, useEffect, useCallback } from "react";

// Shared component imports
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Download, Video, Database, FolderOpen, FileText, Plus, ChevronDown } from "lucide-react";

// Shared type imports
import type { ExplainerSequence, CaptionChunk } from "@/shared/types/explainer";

// Feature imports
import { fetchAudio } from "@/features/admin/audio/services/audio";
import type { Audio as AudioRecord } from "@/features/admin/audio/types";

// Local type imports
import type { LibraryImage, SelectedImage, Animation, TimeBasedText } from "./types";

// Utility imports
import { calculateCoverZoom, getImageTitle } from "./utils/image-helpers";
import { buildCaptionChunks } from "./utils/caption-builder";
import { generateSequence as generateSequenceUtil } from "./utils/sequence-generator";
import {
  loadFromJSON as loadFromJSONUtil,
  saveToJSON as saveToJSONUtil,
} from "./utils/sequence-loader";

// Component imports
import { DeleteConfirmDialog } from "./components/delete-confirm-dialog";
import { AudioPickerDialog } from "./components/audio-picker-dialog";
import { ExportDialog } from "./components/export-dialog";
import { SaveToDatabaseDialog } from "./components/save-to-database-dialog";
import { LoadFromDatabaseDialog } from "./components/load-from-database-dialog";
import { ImageLibraryPanel } from "./components/left-panel/image-library-panel";
import { PreviewPanel } from "./components/center-panel/preview-panel";
import { PropertiesPanel } from "./components/right-panel/properties-panel";
import { TimelinePanel } from "./components/timeline/timeline-panel";

const DEFAULT_AUDIO_URL = "";

export default function LessonStudioPage() {
  // Core state
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [audioUrl, setAudioUrl] = useState(DEFAULT_AUDIO_URL);
  const [previewSequence, setPreviewSequence] = useState<ExplainerSequence | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [seekTime, setSeekTime] = useState<number | undefined>(undefined);
  const [audioDuration, setAudioDuration] = useState<number>(0);

  // Loaded sequence tracking (for update vs create)
  const [loadedSequenceId, setLoadedSequenceId] = useState<string | null>(null);
  const [loadedSequenceTitle, setLoadedSequenceTitle] = useState<string>("");
  const [loadedSequenceDescription, setLoadedSequenceDescription] = useState<string>("");

  // Export state (simplified - dialog manages its own internal state)
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // Save to database dialog state
  const [saveToDatabaseDialogOpen, setSaveToDatabaseDialogOpen] = useState(false);

  // Load from database dialog state
  const [loadFromDatabaseDialogOpen, setLoadFromDatabaseDialogOpen] = useState(false);

  // Audio picker dialog state
  const [audioPickerOpen, setAudioPickerOpen] = useState(false);
  const [audioRecords, setAudioRecords] = useState<AudioRecord[]>([]);
  const [audioSearch, setAudioSearch] = useState("");
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioTitle, setAudioTitle] = useState("");
  const [audioTranscript, setAudioTranscript] = useState("");
  const [captionChunks, setCaptionChunks] = useState<CaptionChunk[]>([]);

  // UI state
  const [isDragOver, setIsDragOver] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);

  // Refs
  const timelineRef = useRef<HTMLDivElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const lastImagesHashRef = useRef<string>("");

  // ─────────────────────────────────────────────────────────────────────────────
  // Auto-preview: regenerate sequence only when data actually changes
  // Uses hash-based comparison to avoid expensive JSON.stringify on every render
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Only auto-update if we already have a preview (don't create initial preview automatically)
    if (selectedImages.length === 0 || !audioUrl || !previewSequence) return;

    // Create a hash of the current images state to detect actual changes
    const currentHash = JSON.stringify([
      selectedImages.map((img) => ({
        url: img.url,
        duration: img.duration,
        transitionDuration: img.transitionDuration,
        initialZoom: img.initialZoom,
        initialX: img.initialX,
        initialY: img.initialY,
        animations: img.animations,
        textOverlays: img.textOverlays,
      })),
      audioUrl,
      audioTranscript,
      audioDuration,
    ]);

    // Only regenerate if the hash has changed
    if (currentHash === lastImagesHashRef.current) return;

    lastImagesHashRef.current = currentHash;

    const newSequence = generateSequenceUtil(
      selectedImages,
      audioUrl,
      audioTranscript,
      audioDuration > 0 ? audioDuration : undefined
    );

    if (newSequence) {
      setPreviewSequence(newSequence);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedImages, audioUrl, audioTranscript, audioDuration]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Scroll timeline to selected segment
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (selectedImageIndex !== null && timelineRef.current && selectedImages.length > 0) {
      const totalDuration = selectedImages.reduce((sum, img) => sum + img.duration, 0);
      const segmentStartTime = selectedImages
        .slice(0, selectedImageIndex)
        .reduce((sum, img) => sum + img.duration, 0);

      // Calculate scroll position (percentage of total width)
      const scrollPercentage = segmentStartTime / totalDuration;
      const scrollLeft = timelineRef.current.scrollWidth * scrollPercentage;

      // Smooth scroll to the segment
      timelineRef.current.scrollTo({
        left: scrollLeft,
        behavior: "smooth",
      });
    }
  }, [selectedImageIndex, selectedImages]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Audio picker effects
  // ─────────────────────────────────────────────────────────────────────────────
  const loadAudioRecords = useCallback(async (search?: string) => {
    setAudioLoading(true);
    try {
      const records = await fetchAudio(search ? { search } : undefined);
      setAudioRecords(records);
    } catch (err) {
      console.error("Failed to fetch audio:", err);
    } finally {
      setAudioLoading(false);
    }
  }, []);

  useEffect(() => {
    if (audioPickerOpen) {
      loadAudioRecords(audioSearch);
    }
  }, [audioPickerOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!audioPickerOpen) return;
    const timer = setTimeout(() => loadAudioRecords(audioSearch), 300);
    return () => clearTimeout(timer);
  }, [audioSearch, loadAudioRecords, audioPickerOpen]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Image management functions
  // ─────────────────────────────────────────────────────────────────────────────
  const handleSegmentSelect = (index: number) => {
    setSelectedImageIndex(index);
    // Calculate segment start time
    const startTime = selectedImages.slice(0, index).reduce((sum, img) => sum + img.duration, 0);
    setSeekTime(startTime);
  };

  const addImage = (image: LibraryImage) => {
    console.log(
      `[lesson-studio] Adding image: ${image.description?.slice(0, 50)} — category: ${image.category}, magnification: ${image.magnification ?? "null"}`
    );

    const initialZoom = calculateCoverZoom(image);
    const duration = 10;

    // Create automatic soft pan/zoom animation
    const autoPanAnimation: Animation = {
      id: `auto-pan-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      type: "pan",
      start: 0,
      duration: duration,
      fadeTime: duration, // Smooth transition throughout entire duration
      targetScale: initialZoom * 1.2, // 20% zoom increase
      targetX: 50 + Math.random() * 10 - 5, // Random ±5% from center (45-55)
      targetY: 50 + Math.random() * 10 - 5, // Random ±5% from center (45-55)
    };

    setSelectedImages([
      ...selectedImages,
      {
        ...image,
        duration,
        transitionDuration: 1,
        initialZoom,
        initialX: 50,
        initialY: 50,
        animations: [autoPanAnimation],
        textOverlays: [],
      },
    ]);
  };

  const addImages = (images: LibraryImage[]) => {
    const newImages = images.map((image) => {
      const initialZoom = calculateCoverZoom(image);
      const duration = 10;

      // Create automatic soft pan/zoom animation
      const autoPanAnimation: Animation = {
        id: `auto-pan-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        type: "pan",
        start: 0,
        duration: duration,
        fadeTime: duration, // Smooth transition throughout entire duration
        targetScale: initialZoom * 1.2, // 20% zoom increase
        targetX: 50 + Math.random() * 10 - 5, // Random ±5% from center (45-55)
        targetY: 50 + Math.random() * 10 - 5, // Random ±5% from center (45-55)
      };

      return {
        ...image,
        duration,
        transitionDuration: 1,
        initialZoom,
        initialX: 50,
        initialY: 50,
        animations: [autoPanAnimation],
        textOverlays: [],
      };
    });
    setSelectedImages([...selectedImages, ...newImages]);
  };

  const removeImage = (index: number) => {
    setSelectedImages(selectedImages.filter((_, i) => i !== index));
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateImage = (index: number, field: keyof SelectedImage, value: any) => {
    setSelectedImages(
      selectedImages.map((img, i) => (i === index ? { ...img, [field]: value } : img))
    );
  };

  // Update multiple fields at once (avoids React state update race conditions)
  const updateImageMultiple = (index: number, updates: Partial<SelectedImage>) => {
    setSelectedImages(selectedImages.map((img, i) => (i === index ? { ...img, ...updates } : img)));
  };

  // Reorder images (for drag-and-drop)
  const handleReorderImages = (oldIndex: number, newIndex: number) => {
    const newImages = [...selectedImages];
    const [movedImage] = newImages.splice(oldIndex, 1);
    newImages.splice(newIndex, 0, movedImage);
    setSelectedImages(newImages);

    // Update selected index if needed
    if (selectedImageIndex === oldIndex) {
      setSelectedImageIndex(newIndex);
    } else if (selectedImageIndex !== null) {
      // Adjust selected index if it was affected by the move
      if (oldIndex < newIndex) {
        // Moving down: indices between old and new shift up
        if (selectedImageIndex > oldIndex && selectedImageIndex <= newIndex) {
          setSelectedImageIndex(selectedImageIndex - 1);
        }
      } else {
        // Moving up: indices between new and old shift down
        if (selectedImageIndex >= newIndex && selectedImageIndex < oldIndex) {
          setSelectedImageIndex(selectedImageIndex + 1);
        }
      }
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Animation management functions
  // ─────────────────────────────────────────────────────────────────────────────
  const addAnimation = (imageIndex: number, type: Animation["type"]) => {
    const img = selectedImages[imageIndex];
    const newId = `anim-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    let newAnimation: Animation;

    switch (type) {
      case "zoom":
        {
          const zoomDuration = Math.min(2, img.duration - 1);
          newAnimation = {
            id: newId,
            type: "zoom",
            start: 0,
            duration: zoomDuration,
            fadeTime: img.duration - zoomDuration - 0, // segmentDuration - zoomDuration - start
            targetScale: img.initialZoom * 1.5,
            targetX: 50, // Center (0-100 coordinate system)
            targetY: 50, // Center (0-100 coordinate system)
          };
        }
        break;
      case "pan":
        newAnimation = {
          id: newId,
          type: "pan",
          start: 0,
          duration: 0, // Not used for pan animations
          fadeTime: 0.5,
          targetScale: img.initialZoom + 0.1,
          targetX: img.initialX + (Math.random() * 10 - 5), // Random offset -5 to +5
          targetY: img.initialY + (Math.random() * 10 - 5), // Random offset -5 to +5
        };
        break;
      case "figure":
        {
          const duration = Math.min(2, img.duration - 0.3);
          newAnimation = {
            id: newId,
            type: "figure",
            start: 0,
            duration,
            fadeTime: img.duration - duration - 0, // segmentDuration - animationDuration - start
            figureType: "circle",
            position: { x: 50, y: 50 },
            size: { width: 30, height: 30 },
            borderColor: "#FFFFFF",
            borderWidth: 3,
            borderStyle: "solid",
          };
        }
        break;
      case "spotlight":
        {
          const duration = Math.min(2, img.duration - 0.3);
          newAnimation = {
            id: newId,
            type: "spotlight",
            start: 0,
            duration,
            fadeTime: img.duration - duration - 0, // segmentDuration - animationDuration - start
            figureType: "circle",
            position: { x: 50, y: 50 },
            size: { width: 30, height: 30 },
          };
        }
        break;
      case "arrow":
        {
          const duration = Math.min(2, img.duration - 0.3);
          newAnimation = {
            id: newId,
            type: "arrow",
            start: 0,
            duration,
            fadeTime: img.duration - duration - 0, // segmentDuration - animationDuration - start
            position: { x: 50, y: 50 },
            color: "#FFFFFF",
            direction: "down",
          };
        }
        break;
    }

    updateImage(imageIndex, "animations", [...img.animations, newAnimation]);
  };

  const removeAnimation = (imageIndex: number, animId: string) => {
    const img = selectedImages[imageIndex];
    updateImage(
      imageIndex,
      "animations",
      img.animations.filter((a) => a.id !== animId)
    );
  };

  const updateAnimation = (imageIndex: number, animId: string, updates: Partial<Animation>) => {
    const img = selectedImages[imageIndex];
    updateImage(
      imageIndex,
      "animations",
      img.animations.map((a) => (a.id === animId ? { ...a, ...updates } : a))
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Text overlay management functions
  // ─────────────────────────────────────────────────────────────────────────────
  const addText = (imageIndex: number) => {
    const img = selectedImages[imageIndex];
    const fadeTime = 0.5;
    // Duration = (segment duration - fade*2) / 2, rounded up to nearest 0.5
    const rawDuration = (img.duration - fadeTime * 2) / 2;
    const duration = Math.ceil(rawDuration * 2) / 2; // Round up to nearest 0.5
    const newText: TimeBasedText = {
      id: `text-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      start: 0,
      duration: Math.max(0.5, duration), // Ensure at least 0.5s duration
      fadeTime,
      text: getImageTitle(img),
      position: { x: 50, y: 15 },
      fontSize: 1.5,
      fontWeight: "bold",
      color: "#FFFFFF",
      backgroundColor: undefined,
    };
    updateImage(imageIndex, "textOverlays", [...img.textOverlays, newText]);
  };

  const removeText = (imageIndex: number, textId: string) => {
    const img = selectedImages[imageIndex];
    updateImage(
      imageIndex,
      "textOverlays",
      img.textOverlays.filter((t) => t.id !== textId)
    );
  };

  const updateText = (imageIndex: number, textId: string, updates: Partial<TimeBasedText>) => {
    const img = selectedImages[imageIndex];
    updateImage(
      imageIndex,
      "textOverlays",
      img.textOverlays.map((t) => (t.id === textId ? { ...t, ...updates } : t))
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Sequence generation (manual trigger for Manual Preview button)
  // ─────────────────────────────────────────────────────────────────────────────
  const generateSequence = () => {
    if (selectedImages.length === 0) return;

    const sequence = generateSequenceUtil(
      selectedImages,
      audioUrl,
      audioTranscript,
      audioDuration > 0 ? audioDuration : undefined
    );

    if (sequence) {
      setPreviewSequence(sequence);

      if (captionChunks.length === 0 && sequence.captions && sequence.captions.length > 0) {
        setCaptionChunks(sequence.captions);
      }
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // AI Generation
  // ─────────────────────────────────────────────────────────────────────────────
  const handleAIGenerate = async () => {
    if (selectedImages.length === 0 || !audioUrl) return;

    // Build caption chunks from transcript if available
    const finalAudioDuration = audioDuration > 0 ? audioDuration : 60; // fallback duration
    const captions =
      audioTranscript && finalAudioDuration > 0
        ? buildCaptionChunks(audioTranscript, finalAudioDuration)
        : [];

    if (captions.length === 0) {
      alert(
        "No transcript available for the selected audio. Please select audio with a transcript."
      );
      return;
    }

    setIsGenerating(true);
    try {
      const images = selectedImages.map((img) => ({
        url: img.url,
        title: img.description
          ? img.description
              .split(/[-–.]/)[0]
              .trim()
              .replace(/[.,;:!?"']+$/, "") // Remove trailing punctuation and quotes
              .slice(0, 80)
          : (img.url.split("/").pop() ?? ""),
        description: img.description ?? img.alt_text ?? "",
        category: img.category ?? "",
        magnification: img.magnification ?? null,
        width: img.width,
        height: img.height,
      }));

      console.log("[lesson-studio] Sending AI generation request:");
      images.forEach((img, i) => {
        console.log(`  [${i}] ${img.title}`);
        console.log(
          `      category: ${img.category}, magnification: ${img.magnification ?? "null"}`
        );
      });
      console.log(`[lesson-studio] ${captions.length} captions, ${finalAudioDuration.toFixed(1)}s`);

      const response = await fetch("/api/admin/lesson-studio/generate-sequence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images,
          captions,
          audioDuration: finalAudioDuration,
          audioUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        alert(`AI generation failed: ${data.error ?? "Unknown error"}`);
        return;
      }

      // Merge AI-generated animations into existing images (preserving dimensions)
      const aiResult = loadFromJSONUtil(data.sequence);
      const mergedImages = selectedImages.map((img, i) => {
        const aiImage = aiResult.images[i];
        if (!aiImage) return img;

        // Keep original dimensions and metadata, merge AI-generated animations
        return {
          ...img, // Preserve original image data including width, height
          animations: aiImage.animations,
          textOverlays: aiImage.textOverlays,
          duration: aiImage.duration,
          transitionDuration: aiImage.transitionDuration,
          initialZoom: aiImage.initialZoom,
          initialX: aiImage.initialX,
          initialY: aiImage.initialY,
        };
      });

      setSelectedImages(mergedImages);
      setSelectedImageIndex(null);
      setPreviewSequence(data.sequence);
      if (aiResult.captions && aiResult.captions.length > 0) {
        setCaptionChunks(aiResult.captions);
      }
    } catch (err) {
      alert(`AI generation error: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Load/Save JSON
  // ─────────────────────────────────────────────────────────────────────────────
  const loadFromJSON = (sequence: ExplainerSequence) => {
    const result = loadFromJSONUtil(sequence);
    setSelectedImages(result.images);
    setSelectedImageIndex(null);
    setPreviewSequence(sequence);
    if (result.audioUrl) setAudioUrl(result.audioUrl);
    if (result.captions && result.captions.length > 0) {
      setCaptionChunks(result.captions);
    }
  };

  const handleStageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.name.endsWith(".json")) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(ev.target?.result as string);
        // Accept both bare ExplainerSequence and the API response wrapper { success, sequence }
        const parsed: ExplainerSequence = raw?.sequence ?? raw;
        if (!parsed.segments || !Array.isArray(parsed.segments)) {
          alert("Invalid sequence JSON — missing segments array.");
          return;
        }
        loadFromJSON(parsed);
      } catch {
        alert("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
  };

  const saveToJSON = () => {
    saveToJSONUtil(
      selectedImages,
      audioUrl,
      audioTranscript,
      audioDuration > 0 ? audioDuration : undefined
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Audio selection
  // ─────────────────────────────────────────────────────────────────────────────
  const handleSelectAudio = (record: AudioRecord) => {
    setAudioUrl(record.url);
    setAudioTitle(record.title);
    setAudioTranscript(record.generated_text ?? "");
    // Seed duration immediately from the record so captions can use it before
    // the player fires onAudioLoaded
    if (record.duration_seconds) setAudioDuration(record.duration_seconds);
    setAudioPickerOpen(false);
    setAudioSearch("");
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Export
  // ─────────────────────────────────────────────────────────────────────────────
  const handleExportClick = () => {
    if (!previewSequence) generateSequence();
    setExportDialogOpen(true);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Save to Database
  // ─────────────────────────────────────────────────────────────────────────────
  const handleSaveToDatabaseClick = () => {
    if (!previewSequence) generateSequence();
    setSaveToDatabaseDialogOpen(true);
  };

  const handleSaveSuccess = (sequenceId: string) => {
    // If we were creating a new sequence, track it now for future updates
    if (!loadedSequenceId) {
      setLoadedSequenceId(sequenceId);
    }
    console.log("Sequence saved with ID:", sequenceId);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Load from Database
  // ─────────────────────────────────────────────────────────────────────────────
  const handleLoadFromDatabase = (
    sequence: ExplainerSequence,
    sequenceId: string,
    title: string,
    description: string
  ) => {
    loadFromJSON(sequence);
    setLoadedSequenceId(sequenceId);
    setLoadedSequenceTitle(title);
    setLoadedSequenceDescription(description);
  };

  // Clear loaded sequence (start new)
  const handleNewSequence = () => {
    setLoadedSequenceId(null);
    setLoadedSequenceTitle("");
    setLoadedSequenceDescription("");
    setSelectedImages([]);
    setAudioUrl(DEFAULT_AUDIO_URL);
    setPreviewSequence(null);
    setSelectedImageIndex(null);
    setAudioTitle("");
    setAudioTranscript("");
    setCaptionChunks([]);
    setAudioDuration(0);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Lesson Studio</h1>
          {loadedSequenceId && (
            <span className="text-sm text-muted-foreground">
              <FileText className="h-3.5 w-3.5 inline mr-1" />
              {loadedSequenceTitle}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* File Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <FileText className="h-4 w-4 mr-2" />
                File
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={handleNewSequence}>
                <Plus className="h-4 w-4 mr-2" />
                New Sequence
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLoadFromDatabaseDialogOpen(true)}>
                <FolderOpen className="h-4 w-4 mr-2" />
                Load from Database...
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={saveToJSON} disabled={selectedImages.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Download JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportClick} disabled={selectedImages.length === 0}>
                <Video className="h-4 w-4 mr-2" />
                Export MP4...
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Save/Update Button */}
          <Button
            variant="default"
            size="sm"
            onClick={handleSaveToDatabaseClick}
            disabled={selectedImages.length === 0}
            className="flex items-center gap-2"
          >
            <Database className="h-4 w-4" />
            {loadedSequenceId ? "Update" : "Save"}
          </Button>
        </div>
      </div>

      {/* Main Content Area - vertical flex to include timeline at bottom */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Top Section: Three-panel layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Image Library */}
          <ImageLibraryPanel
            selectedImages={selectedImages}
            selectedImageIndex={selectedImageIndex}
            onAddImage={addImage}
            onAddImages={addImages}
            onSegmentSelect={handleSegmentSelect}
            audioDuration={audioDuration}
            audioUrl={audioUrl}
            audioTitle={audioTitle}
            onAudioPickerOpen={() => setAudioPickerOpen(true)}
            onReorderImages={handleReorderImages}
          />

          {/* Center & Right Panel Container */}
          <div className="flex-1 flex overflow-hidden">
            {/* Center Panel - Preview */}
            <PreviewPanel
              ref={playerContainerRef}
              previewSequence={previewSequence}
              audioUrl={audioUrl}
              audioTranscript={audioTranscript}
              seekTime={seekTime}
              captionChunks={captionChunks}
              selectedImagesCount={selectedImages.length}
              isGenerating={isGenerating}
              isDragOver={isDragOver}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleStageDrop}
              onAudioLoaded={(duration) => setAudioDuration(duration)}
              onAIGenerate={handleAIGenerate}
              onManualPreview={generateSequence}
            />

            {/* Right Panel - Properties */}
            <PropertiesPanel
              selectedImage={
                selectedImageIndex !== null ? selectedImages[selectedImageIndex] : null
              }
              selectedImageIndex={selectedImageIndex}
              isLastImage={selectedImageIndex === selectedImages.length - 1}
              onUpdateImage={updateImage}
              onUpdateImageMultiple={updateImageMultiple}
              onCalculateCoverZoom={calculateCoverZoom}
              onAddAnimation={addAnimation}
              onRemoveAnimation={removeAnimation}
              onUpdateAnimation={updateAnimation}
              onAddText={addText}
              onRemoveText={removeText}
              onUpdateText={updateText}
              onDeleteSegment={() => {
                if (selectedImageIndex !== null) {
                  setDeleteConfirmIndex(selectedImageIndex);
                }
              }}
            />
          </div>
        </div>

        {/* Bottom Timeline */}
        <TimelinePanel
          ref={timelineRef}
          selectedImages={selectedImages}
          selectedImageIndex={selectedImageIndex}
          audioDuration={audioDuration}
          onSegmentSelect={handleSegmentSelect}
        />
      </div>

      {/* Dialogs */}
      <AudioPickerDialog
        open={audioPickerOpen}
        onOpenChange={setAudioPickerOpen}
        audioRecords={audioRecords}
        audioSearch={audioSearch}
        onSearchChange={setAudioSearch}
        audioLoading={audioLoading}
        selectedAudioUrl={audioUrl}
        onSelectAudio={handleSelectAudio}
      />

      <DeleteConfirmDialog
        open={deleteConfirmIndex !== null}
        onOpenChange={() => setDeleteConfirmIndex(null)}
        segmentIndex={deleteConfirmIndex}
        onConfirm={() => {
          if (deleteConfirmIndex !== null) {
            removeImage(deleteConfirmIndex);
            setDeleteConfirmIndex(null);
          }
        }}
      />

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        previewSequence={previewSequence}
        audioUrl={audioUrl}
      />

      <SaveToDatabaseDialog
        open={saveToDatabaseDialogOpen}
        onOpenChange={setSaveToDatabaseDialogOpen}
        sequence={previewSequence}
        existingSequenceId={loadedSequenceId}
        existingTitle={loadedSequenceTitle}
        existingDescription={loadedSequenceDescription}
        onSaveSuccess={handleSaveSuccess}
      />

      <LoadFromDatabaseDialog
        open={loadFromDatabaseDialogOpen}
        onOpenChange={setLoadFromDatabaseDialogOpen}
        onLoadSequence={handleLoadFromDatabase}
      />
    </div>
  );
}
