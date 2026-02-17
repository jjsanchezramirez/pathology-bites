"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogOverlay,
  DialogPortal,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "@/shared/utils/ui/toast";
import { softDeleteAudio } from "@/features/admin/audio/services/audio";
import type { Audio } from "@/features/admin/audio/types";

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
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!audio) return;

    try {
      setIsDeleting(true);
      await softDeleteAudio(audio.id);
      toast.success("Audio file deleted successfully");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete audio file";
      console.error("Delete error:", error);
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!audio) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="backdrop-blur-md bg-black/20" />
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Are you sure you want to permanently delete &quot;{audio.title}&quot;?</p>
              <p>This action cannot be undone.</p>
            </div>
          </DialogHeader>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Audio
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
