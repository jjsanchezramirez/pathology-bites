"use client";

import { ConfirmDialog } from "@/shared/components/ui/confirm-dialog";
import { toast } from "@/shared/utils/ui/toast";
import { softDeleteAudio } from "@/features/admin/audio/services/audio";
import type { Audio } from "@/features/admin/audio/types";
import { log } from "@/shared/utils/logging";

interface DeleteAudioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  audio: Audio | null;
  onSuccess: () => void;
}

export function DeleteAudioDialog({
  open,
  onOpenChange,
  audio,
  onSuccess,
}: DeleteAudioDialogProps) {
  if (!audio) return null;

  const handleDelete = async () => {
    try {
      await softDeleteAudio(audio.id);
      toast.success("Audio file deleted successfully");
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete audio file";
      log.error("Delete error:", error);
      toast.error(message);
    }
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Confirm Deletion"
      description={`Are you sure you want to permanently delete "${audio.title}"? This action cannot be undone.`}
      confirmLabel="Delete Audio"
      variant="destructive"
      onConfirm={handleDelete}
    />
  );
}
