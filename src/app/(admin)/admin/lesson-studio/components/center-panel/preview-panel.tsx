import { forwardRef } from "react";
import { Button } from "@/shared/components/ui/button";
import { Upload, Sparkles, Play, Loader2 } from "lucide-react";
import { ExplainerPlayer } from "@/shared/components/explainer/explainer-player";
import type { ExplainerSequence, CaptionChunk } from "@/shared/types/explainer";

interface PreviewPanelProps {
  previewSequence: ExplainerSequence | null;
  audioUrl: string;
  audioTranscript: string;
  seekTime: number | undefined;
  captionChunks: CaptionChunk[];
  selectedImagesCount: number;
  isGenerating: boolean;
  isRegeneratingPreview: boolean;
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onAudioLoaded: (duration: number) => void;
  onAIGenerate: () => void;
  onManualPreview: () => void;
}

export const PreviewPanel = forwardRef<HTMLDivElement, PreviewPanelProps>(
  (
    {
      previewSequence,
      audioUrl,
      audioTranscript,
      seekTime,
      captionChunks,
      selectedImagesCount,
      isGenerating,
      isRegeneratingPreview,
      isDragOver,
      onDragOver,
      onDragLeave,
      onDrop,
      onAudioLoaded,
      onAIGenerate,
      onManualPreview,
    },
    ref
  ) => {
    return (
      <div
        className="flex-1 flex items-center justify-center bg-muted/30 p-8 relative"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {/* Drop overlay */}
        {isDragOver && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-primary/10 border-2 border-dashed border-primary rounded-lg pointer-events-none">
            <Upload className="h-10 w-10 text-primary" />
            <p className="text-sm font-medium text-primary">Drop sequence JSON to load</p>
          </div>
        )}

        {/* Updating overlay */}
        {isRegeneratingPreview && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm pointer-events-none">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-sm font-medium text-muted-foreground">Updating preview...</p>
          </div>
        )}

        {previewSequence ? (
          <div ref={ref} className="w-full max-w-5xl">
            <ExplainerPlayer
              sequence={previewSequence}
              audioUrl={audioUrl}
              className="w-full"
              seekToTime={seekTime}
              onAudioLoaded={onAudioLoaded}
              captions={captionChunks.length > 0 ? captionChunks : undefined}
            />
          </div>
        ) : (
          <div className="text-center space-y-3">
            <div className="text-muted-foreground text-sm">No preview yet</div>
            <p className="text-xs text-muted-foreground/70">
              {!audioUrl
                ? "1. Select audio, 2. Add images, 3. Click AI Generate"
                : selectedImagesCount === 0
                  ? "Add images to the sequence"
                  : !audioTranscript
                    ? "Selected audio has no transcript — choose different audio or use Manual Preview"
                    : "Ready! Click AI Generate to create your sequence"}
            </p>
            {selectedImagesCount > 0 && (
              <div className="flex flex-col gap-2 items-center">
                <Button
                  onClick={onAIGenerate}
                  disabled={!audioUrl || !audioTranscript || isGenerating}
                  className="w-full"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      AI Generate
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={onManualPreview}
                  disabled={!audioUrl || isGenerating}
                  className="w-full"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Manual Preview
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground/50 mt-2">
              or drop a sequence JSON here to reload
            </p>
          </div>
        )}
      </div>
    );
  }
);

PreviewPanel.displayName = "PreviewPanel";
