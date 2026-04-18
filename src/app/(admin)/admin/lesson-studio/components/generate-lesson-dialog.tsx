"use client";

import { useState, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Wand2, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useEditorStore } from "../model/store";
import type { Lesson, ImageElement, SvgElement } from "../model/types";

interface GenerateLessonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Phase = "confirm" | "generating" | "success" | "error";

/**
 * Collect all unique images and SVGs from the current lesson slides.
 * Images are deduplicated by URL; SVGs by asset ID or URL.
 */
function collectAssets(lesson: Lesson) {
  const imageMap = new Map<string, ImageElement>();
  const svgMap = new Map<string, SvgElement>();

  for (const slide of lesson.slides) {
    for (const el of slide.elements) {
      if (el.kind === "image") {
        const img = el as ImageElement;
        if (!imageMap.has(img.imageUrl)) {
          imageMap.set(img.imageUrl, img);
        }
      } else if (el.kind === "svg") {
        const svg = el as SvgElement;
        const key = svg.svgAssetId || svg.svgUrl;
        if (!svgMap.has(key)) {
          svgMap.set(key, svg);
        }
      }
    }
  }

  return {
    images: [...imageMap.values()],
    svgs: [...svgMap.values()],
  };
}

export function GenerateLessonDialog({ open, onOpenChange }: GenerateLessonDialogProps) {
  const [phase, setPhase] = useState<Phase>("confirm");
  const [error, setError] = useState("");

  const lesson = useEditorStore((s) => s.lesson);
  const setLesson = useEditorStore((s) => s.setLesson);

  const hasAudio = !!(lesson.audio?.url && lesson.audio?.transcript);
  const audioDuration = lesson.audio?.duration ?? 0;

  const { images, svgs } = useMemo(() => collectAssets(lesson), [lesson]);

  const handleGenerate = useCallback(async () => {
    setPhase("generating");
    setError("");

    try {
      // Build image inputs from collected image elements + slide metadata
      const imageInputs = images.map((img) => {
        // Try to find the slide this image belongs to for category/dimensions
        const slide = lesson.slides.find((s) => s.elements.some((el) => el.id === img.id));
        return {
          url: img.imageUrl,
          title: slide?.imageCategory ?? "",
          description: "",
          category: slide?.imageCategory ?? "microscopic",
          magnification: null,
          width: (slide?.imageWidth ?? Math.round(img.rect.w * 19.2)) || 1920,
          height: (slide?.imageHeight ?? Math.round(img.rect.h * 10.8)) || 1080,
        };
      });

      if (imageInputs.length === 0) {
        throw new Error("No images found on slides. Add images to your slides first.");
      }

      const res = await fetch("/api/admin/lesson-studio/generate-lesson", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": "admin",
          "x-user-role": "admin",
        },
        body: JSON.stringify({
          images: imageInputs,
          svgs: svgs.map((s) => ({
            url: s.svgUrl,
            name: s.svgName ?? "",
            assetId: s.svgAssetId,
          })),
          transcript: lesson.audio!.transcript,
          audioDuration,
          audioUrl: lesson.audio!.url,
          audioTitle: lesson.audio?.title,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(data.error || `Server error: ${res.status}`);
      }

      const data = await res.json();
      if (!data.success || !data.lesson) {
        throw new Error("Invalid response from server");
      }

      const generatedLesson: Lesson = {
        ...data.lesson,
        id: lesson.id,
        title: lesson.title || data.lesson.title || "",
        description: lesson.description || data.lesson.description || "",
      };

      setLesson(generatedLesson);
      setPhase("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  }, [images, svgs, lesson, audioDuration, setLesson]);

  const handleClose = useCallback(() => {
    setPhase("confirm");
    setError("");
    onOpenChange(false);
  }, [onOpenChange]);

  const canGenerate = hasAudio && images.length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            Generate Lesson
          </DialogTitle>
          <DialogDescription>
            Use AI to create animations, annotations, and timing from your slides and audio.
          </DialogDescription>
        </DialogHeader>

        {phase === "confirm" && (
          <div className="space-y-4">
            {!hasAudio && (
              <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Audio with transcript is required. Select audio first (File &gt; Choose audio).
              </div>
            )}

            <div className="rounded-md bg-muted p-3 text-sm space-y-1">
              <p>
                Found <strong>{images.length}</strong> image{images.length !== 1 ? "s" : ""}
                {svgs.length > 0 && (
                  <>
                    {" "}
                    and <strong>{svgs.length}</strong> SVG{svgs.length !== 1 ? "s" : ""}
                  </>
                )}{" "}
                across {lesson.slides.length} slide{lesson.slides.length !== 1 ? "s" : ""}.
              </p>
              {hasAudio && (
                <p>
                  Audio: <strong>{lesson.audio?.title ?? "untitled"}</strong> (
                  {Math.round(audioDuration)}s)
                </p>
              )}
              {images.length === 0 && (
                <p className="text-amber-600 mt-2">
                  No images found. Add images to your slides first.
                </p>
              )}
            </div>

            {/* Thumbnail preview of collected images */}
            {images.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {images.map((img, i) => (
                  <div
                    key={img.id}
                    className="relative h-12 w-12 rounded border overflow-hidden flex-shrink-0"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.imageUrl} alt="" className="h-full w-full object-cover" />
                    <span className="absolute top-0 left-0 bg-blue-500 text-white text-[9px] px-1 leading-4 font-medium">
                      {i + 1}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              This will replace all current slides with an AI-generated lesson — camera movements,
              annotations, text overlays, and timing synced to the audio.
            </p>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleGenerate} disabled={!canGenerate}>
                <Wand2 className="mr-1 h-4 w-4" />
                Generate
              </Button>
            </div>
          </div>
        )}

        {phase === "generating" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm text-muted-foreground text-center">
              Analysing {images.length} images and transcript, planning lesson structure...
            </p>
            <p className="text-xs text-muted-foreground">This typically takes 15-45 seconds.</p>
          </div>
        )}

        {phase === "success" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <p className="text-sm font-medium">Lesson generated successfully!</p>
            <p className="text-xs text-muted-foreground text-center">
              Review the slides and use Preview to check the animation. You can manually adjust any
              element.
            </p>
            <Button onClick={handleClose}>Done</Button>
          </div>
        )}

        {phase === "error" && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-md bg-red-50 p-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Generation failed</p>
                <p className="text-xs text-red-600 mt-1">{error}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button onClick={handleGenerate}>Retry</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
