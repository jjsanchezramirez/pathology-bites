"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/shared/components/ui/button";
import { SectionCard } from "@/shared/components/ui/page-layout";
import { Plus } from "lucide-react";
import type { Audio } from "@/features/admin/audio/types";
import { toast } from "@/shared/utils/ui/toast";
import { AudioTable } from "@/features/admin/audio/components/audio-table";
import { AudioStatsCards } from "@/features/admin/audio/components/audio-stats-cards";
import {
  AudioUploadDialog,
  type AudioFileReadyState,
} from "@/features/admin/audio/components/upload-dialog";
import { EditAudioDialog } from "@/features/admin/audio/components/edit-dialog";
import { DeleteAudioDialog } from "@/features/admin/audio/components/delete-dialog";

/**
 * Extract audio duration using native HTML5 Audio API
 * No FFmpeg required - browsers can handle all common audio formats
 */
async function getAudioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);
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
}

export function AudioTab() {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [audioFileReady, setAudioFileReady] = useState<AudioFileReadyState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedAudio, setSelectedAudio] = useState<Audio | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [audioToDelete, setAudioToDelete] = useState<Audio | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const handleAudioFilePicked = useCallback(async (file: File) => {
    if (!file.type.startsWith("audio/")) {
      toast.error("Please select an audio file.");
      return;
    }

    setUploadDialogOpen(true);
    setAudioFileReady(null);

    // Get duration using native Audio API - no FFmpeg needed
    const duration = await getAudioDuration(file);

    if (duration === null) {
      toast.error("Could not read audio duration. File may be corrupted.");
    }

    setAudioFileReady({
      file,
      originalSize: file.size,
      duration,
    });
  }, []);

  // Listen for drop events bubbled up from the dialog's drop zone
  useEffect(() => {
    const handler = (e: Event) => {
      const file = (e as CustomEvent<{ file: File }>).detail?.file;
      if (file) handleAudioFilePicked(file);
    };
    document.addEventListener("audio-drop", handler);
    return () => document.removeEventListener("audio-drop", handler);
  }, [handleAudioFilePicked]);

  const handleEdit = (audio: Audio) => {
    setSelectedAudio(audio);
    setEditDialogOpen(true);
  };

  const handleDelete = (audio: Audio) => {
    setAudioToDelete(audio);
    setDeleteDialogOpen(true);
  };

  return (
    <>
      {/* Stats */}
      <AudioStatsCards refreshKey={refreshKey} />

      <SectionCard
        title="Audio Management"
        description="Upload, edit, and organize your audio collection. Search by title, description, or transcript."
        actions={
          <Button onClick={() => setUploadDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Upload Audio
          </Button>
        }
      >
        <AudioTable onEdit={handleEdit} onDelete={handleDelete} refreshKey={refreshKey} />
      </SectionCard>

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

      {/* Upload Dialog */}
      <AudioUploadDialog
        open={uploadDialogOpen}
        onOpenChange={(open) => {
          setUploadDialogOpen(open);
          if (!open) {
            setAudioFileReady(null);
          }
        }}
        onSuccess={() => {
          refresh();
          setAudioFileReady(null);
        }}
        fileReady={audioFileReady}
        onRequestFilePick={() => fileInputRef.current?.click()}
      />

      {/* Edit Dialog */}
      <EditAudioDialog
        audio={selectedAudio}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={refresh}
      />

      {/* Delete Dialog */}
      <DeleteAudioDialog
        audio={audioToDelete}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onSuccess={refresh}
      />
    </>
  );
}
