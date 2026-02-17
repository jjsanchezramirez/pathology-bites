"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  Loader2,
  Plus,
  Search,
  Music,
  Trash2,
  Download,
  MoreVertical,
  Edit,
  AudioLines,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { fetchAudio, getAudioStats } from "@/features/admin/audio/services/audio";
import type { Audio, AudioListFilters } from "@/features/admin/audio/types";
import { toast } from "@/shared/utils/ui/toast";
import {
  AudioUploadDialog,
  type AudioFileReadyState,
} from "@/features/admin/audio/components/upload-dialog";
import { EditAudioDialog } from "@/features/admin/audio/components/edit-dialog";
import { DeleteAudioDialog } from "@/features/admin/audio/components/delete-dialog";
import { CATEGORIES } from "@/shared/config/categories";
import { getCategoryById } from "@/shared/config/category-color-map";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds === 0) return "Unknown";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Row Actions Component
function RowActions({
  audio,
  onEdit,
  onDelete,
}: {
  audio: Audio;
  onEdit: (audio: Audio) => void;
  onDelete: (audio: Audio) => void;
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit(audio)}>
          <Edit className="h-4 w-4 mr-2" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem className="text-red-600" onClick={() => onDelete(audio)}>
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

async function compressAudioToMP3(
  file: File,
  onProgress?: (percent: number) => void
): Promise<File> {
  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  const { fetchFile } = await import("@ffmpeg/util");

  const ffmpeg = new FFmpeg();
  ffmpeg.on("progress", ({ progress }: { progress: number }) => {
    onProgress?.(Math.round(progress * 100));
  });

  await ffmpeg.load({
    coreURL: "/ffmpeg/ffmpeg-core.js",
    wasmURL: "/ffmpeg/ffmpeg-core.wasm",
  });

  const ext = file.name.split(".").pop()?.toLowerCase() || "wav";
  const inputName = `input.${ext}`;
  await ffmpeg.writeFile(inputName, await fetchFile(file));

  await ffmpeg.exec([
    "-i",
    inputName,
    "-codec:a",
    "libmp3lame",
    "-q:a",
    "3",
    "-ar",
    "24000",
    "-ac",
    "1",
    "-id3v2_version",
    "3",
    "output.mp3",
  ]);

  const mp3Data = await ffmpeg.readFile("output.mp3");
  const mp3Blob = new Blob([mp3Data as Uint8Array], { type: "audio/mpeg" });
  return new File([mp3Blob], file.name.replace(/\.[^.]+$/, ".mp3"), { type: "audio/mpeg" });
}

export default function AdminAudioPage() {
  const [audio, setAudio] = useState<Audio[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<AudioListFilters>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [audioFileReady, setAudioFileReady] = useState<AudioFileReadyState | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedAudio, setSelectedAudio] = useState<Audio | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [audioToDelete, setAudioToDelete] = useState<Audio | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);
  const [audioDurations, setAudioDurations] = useState<Record<string, number>>({});
  const [stats, setStats] = useState<{
    total: number;
    totalSizeBytes: number;
    unusedCount: number;
    unusedSizeBytes: number;
  } | null>(null);

  // Get level 2 categories (subspecialties) for the category dropdown
  const pathologyCategories = CATEGORIES.filter((cat) => cat.level === 2).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  // Listen for drop events bubbled up from the dialog's drop zone
  useEffect(() => {
    const handler = (e: Event) => {
      const file = (e as CustomEvent<{ file: File }>).detail?.file;
      if (file) handleAudioFilePicked(file);
    };
    document.addEventListener("audio-drop", handler);
    return () => document.removeEventListener("audio-drop", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAudioFilePicked = useCallback(async (file: File) => {
    if (!file.type.startsWith("audio/")) {
      toast.error("Please select an audio file.");
      return;
    }

    setUploadDialogOpen(true);
    setAudioFileReady(null);

    const originalSize = file.size;
    let finalFile = file;

    if (file.type !== "audio/mpeg") {
      setIsCompressing(true);
      setCompressionProgress(0);
      try {
        finalFile = await compressAudioToMP3(file, setCompressionProgress);
      } catch (err) {
        console.error("Compression failed:", err);
        toast.error("Audio compression failed. Uploading original file.");
        finalFile = file;
      } finally {
        setIsCompressing(false);
      }
    }

    // Extract duration from the final file
    const duration = await new Promise<number | null>((resolve) => {
      const audio = new Audio();
      const url = URL.createObjectURL(finalFile);
      audio.src = url;
      audio.addEventListener("loadedmetadata", () => {
        URL.revokeObjectURL(url);
        resolve(isFinite(audio.duration) ? audio.duration : null);
      });
      audio.addEventListener("error", () => {
        URL.revokeObjectURL(url);
        resolve(null);
      });
      audio.load();
    });

    setAudioFileReady({ file: finalFile, originalSize, duration });
  }, []);

  const loadAudio = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchAudio(filters);
      setAudio(data);
    } catch (error) {
      console.error("Error loading audio:", error);
      toast.error("Failed to load audio files");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const loadStats = useCallback(async () => {
    try {
      const data = await getAudioStats();
      // TODO: Implement actual unused audio tracking
      setStats({
        ...data,
        unusedCount: 0,
        unusedSizeBytes: 0,
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  }, []);

  useEffect(() => {
    loadAudio();
    loadStats();
  }, [loadAudio, loadStats]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setFilters((prev) => ({
        ...prev,
        search: searchQuery,
        pathology_category_id:
          categoryFilter !== "all" && categoryFilter !== "uncategorized"
            ? categoryFilter
            : undefined,
      }));
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, categoryFilter]);

  const handleEdit = (audio: Audio) => {
    setSelectedAudio(audio);
    setEditDialogOpen(true);
  };

  const handleDelete = (audio: Audio) => {
    setAudioToDelete(audio);
    setDeleteDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Audio Library</h1>
        <p className="text-muted-foreground">
          Manage educational audio files and TTS-generated content
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Total Audio Files Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Audio Files</CardTitle>
              <Music className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                {formatBytes(stats.totalSizeBytes)} total size
              </p>
            </CardContent>
          </Card>

          {/* Storage Used Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
              <Download className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatBytes(stats.totalSizeBytes)}</div>
              <p className="text-xs text-muted-foreground">Audio storage</p>
            </CardContent>
          </Card>

          {/* Unused Audio Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unused Audio</CardTitle>
              <AudioLines className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.unusedCount}</div>
              <p className="text-xs text-muted-foreground">
                {formatBytes(stats.unusedSizeBytes)} not in use
              </p>
            </CardContent>
          </Card>

          {/* Cleanup Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cleanup</CardTitle>
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Button
                variant={stats.unusedCount > 0 ? "destructive" : "outline"}
                size="sm"
                onClick={() => setShowCleanupDialog(true)}
                disabled={stats.unusedCount === 0}
                className="w-full"
              >
                {stats.unusedCount > 0 ? (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clean Up ({stats.unusedCount})
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    All Clean
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Audio Management Card */}
      <Card>
        <CardHeader>
          <CardTitle>Audio Management</CardTitle>
          <CardDescription>
            Upload, edit, and organize your audio collection. Use the search to find audio files by
            title, description, or transcript.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex gap-4 items-center justify-between">
              <div className="flex gap-4 items-center flex-1">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by title, description, or transcript..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="uncategorized">Uncategorized</SelectItem>
                    {pathologyCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.shortForm}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => setUploadDialogOpen(true)}
                className="bg-primary hover:bg-primary/90"
              >
                <Plus className="h-4 w-4 mr-2" />
                Upload Audio
              </Button>
            </div>

            {/* Audio Table */}
            <div className="rounded-md border bg-card">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="min-w-[250px]">Audio Details</TableHead>
                    <TableHead className="w-[110px]">Category</TableHead>
                    <TableHead className="w-[80px]">Size</TableHead>
                    <TableHead className="w-[100px]">Created</TableHead>
                    <TableHead className="w-[60px]">Usage</TableHead>
                    <TableHead className="min-w-[300px]">Player</TableHead>
                    <TableHead className="w-[70px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : audio.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        {searchQuery || categoryFilter !== "all"
                          ? "No audio files found matching your filters"
                          : "No audio files uploaded yet"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    audio.map((item) => {
                      // Get category info
                      const categoryWithColor = item.pathology_category_id
                        ? getCategoryById(item.pathology_category_id)
                        : null;

                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-medium line-clamp-1 flex-1">
                                  {item.title}
                                </p>
                                <div className="text-xs text-muted-foreground shrink-0">
                                  {formatDuration(audioDurations[item.id] ?? item.duration_seconds)}
                                </div>
                              </div>
                              {(item.description || item.generated_text) && (
                                <p className="line-clamp-1 text-xs text-muted-foreground">
                                  {item.description || item.generated_text}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {categoryWithColor ? (
                              <span
                                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                                style={{
                                  backgroundColor: `hsl(${categoryWithColor.color.match(/hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/)?.[1]} ${Math.min(parseInt(categoryWithColor.color.match(/hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/)?.[2] || "50"), 50)}% 90%)`,
                                  color: `hsl(${categoryWithColor.color.match(/hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/)?.[1]} ${categoryWithColor.color.match(/hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/)?.[2]}% 20%)`,
                                }}
                              >
                                {categoryWithColor.shortForm}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">Uncategorized</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatBytes(item.file_size_bytes)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(item.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {/* TODO: Implement audio usage tracking */}
                            <span className="text-xs text-muted-foreground">-</span>
                          </TableCell>
                          <TableCell>
                            <audio
                              controls
                              src={item.url}
                              className="w-full h-6"
                              crossOrigin="anonymous"
                              preload="metadata"
                              style={{ maxWidth: "none" }}
                              onLoadedMetadata={(e) => {
                                const audioElement = e.currentTarget;
                                if (audioElement.duration && isFinite(audioElement.duration)) {
                                  // Update local state to display duration immediately
                                  setAudioDurations((prev) => ({
                                    ...prev,
                                    [item.id]: audioElement.duration,
                                  }));

                                  // Update database if not set
                                  if (!item.duration_seconds) {
                                    fetch("/api/admin/audio/update-duration", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        id: item.id,
                                        duration: audioElement.duration,
                                      }),
                                    }).catch((err) =>
                                      console.error("Failed to update duration:", err)
                                    );
                                  }
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <RowActions audio={item} onEdit={handleEdit} onDelete={handleDelete} />
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      {/* Hidden file input owned by the page so FFmpeg dynamic imports work */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleAudioFilePicked(file);
          e.target.value = "";
        }}
      />

      <AudioUploadDialog
        open={uploadDialogOpen}
        onOpenChange={(open) => {
          setUploadDialogOpen(open);
          if (!open) {
            setAudioFileReady(null);
            setIsCompressing(false);
            setCompressionProgress(0);
          }
        }}
        onSuccess={() => {
          loadAudio();
          loadStats();
          setAudioFileReady(null);
        }}
        fileReady={audioFileReady}
        onRequestFilePick={() => fileInputRef.current?.click()}
        isCompressing={isCompressing}
        compressionProgress={compressionProgress}
      />

      {/* Edit Dialog */}
      <EditAudioDialog
        audio={selectedAudio}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={() => {
          loadAudio();
          loadStats();
        }}
      />

      <DeleteAudioDialog
        audio={audioToDelete}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onSuccess={() => {
          loadAudio();
          loadStats();
        }}
      />

      {/* Cleanup Dialog - TODO: Implement */}
      {showCleanupDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Audio Cleanup</CardTitle>
              <CardDescription>Remove unused audio files to free up storage space</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                TODO: Implement audio cleanup functionality
              </p>
              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowCleanupDialog(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button variant="destructive" disabled className="flex-1">
                  Clean Up (Coming Soon)
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
