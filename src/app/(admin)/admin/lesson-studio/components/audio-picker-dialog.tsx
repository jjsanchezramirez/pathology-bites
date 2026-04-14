import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPortal,
  DialogOverlay,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Search, Music, Check, Clock, X, Loader2 } from "lucide-react";
import type { Audio as AudioRecord } from "@/features/admin/audio/types";

interface AudioPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  audioRecords: AudioRecord[];
  audioSearch: string;
  onSearchChange: (search: string) => void;
  audioLoading: boolean;
  selectedAudioUrl: string;
  onSelectAudio: (record: AudioRecord) => void;
  /** Called when the user clicks "Remove audio". */
  onRemoveAudio: () => void;
}

/**
 * Format duration in seconds to M:SS format
 */
function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AudioPickerDialog({
  open,
  onOpenChange,
  audioRecords,
  audioSearch,
  onSearchChange,
  audioLoading,
  selectedAudioUrl,
  onSelectAudio,
  onRemoveAudio,
}: AudioPickerDialogProps) {
  const hasSelection = !!selectedAudioUrl;
  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        onOpenChange(newOpen);
        if (!newOpen) onSearchChange("");
      }}
    >
      <DialogPortal>
        <DialogOverlay className="backdrop-blur-md bg-black/20" />
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Select Audio</DialogTitle>
            <DialogDescription>
              Search your audio library and select a track for the lesson.
            </DialogDescription>
          </DialogHeader>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by title or description…"
              value={audioSearch}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 pr-9"
              autoFocus
            />
            {audioLoading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
            )}
          </div>

          {/* Results — stale results stay visible while a new search is in
              flight so the list doesn't flicker on every keystroke. */}
          <div className="max-h-[400px] overflow-y-auto -mx-6 px-6 space-y-1">
            {audioLoading && audioRecords.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading…
              </div>
            ) : !audioLoading && audioRecords.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                <Music className="h-8 w-8 opacity-30" />
                <p className="text-sm">No audio files found</p>
              </div>
            ) : (
              audioRecords.map((record) => {
                const isSelected = record.url === selectedAudioUrl;
                return (
                  <button
                    key={record.id}
                    onClick={() => onSelectAudio(record)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors hover:bg-muted/60 ${
                      isSelected ? "bg-muted ring-1 ring-primary/30" : ""
                    }`}
                  >
                    <div
                      className={`flex-shrink-0 h-9 w-9 rounded-md flex items-center justify-center ${isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                    >
                      {isSelected ? <Check className="h-4 w-4" /> : <Music className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{record.title}</p>
                      {record.description && (
                        <p className="text-xs text-muted-foreground truncate">
                          {record.description}
                        </p>
                      )}
                    </div>
                    {record.duration_seconds != null && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <Clock className="h-3 w-3" />
                        {formatDuration(record.duration_seconds)}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between border-t pt-3">
            <p className="text-xs text-muted-foreground">
              {hasSelection ? "Audio is set for this lesson." : "No audio selected."}
            </p>
            <Button
              variant="ghost"
              size="sm"
              disabled={!hasSelection}
              onClick={() => {
                onRemoveAudio();
                onOpenChange(false);
              }}
            >
              <X className="mr-1 h-3 w-3" />
              Remove audio
            </Button>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
