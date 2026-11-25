"use client";

import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Archive } from "lucide-react";

interface DeleteQuestionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  deleting: boolean;
  onConfirm: () => void;
}

export function DeleteQuestionsDialog({
  open,
  onOpenChange,
  count,
  deleting,
  onConfirm,
}: DeleteQuestionsDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!deleting) onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive {count === 1 ? "question" : `${count} questions`}?</DialogTitle>
          <DialogDescription>
            {count === 1
              ? "This archives the draft question. It is kept with its history, and you can restore it from the Question Database (Archived filter)."
              : `This archives ${count} draft questions. They are kept with their history, and you can restore them from the Question Database (Archived filter).`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={deleting}>
            <Archive className="h-4 w-4 mr-2" />
            {deleting ? "Archiving..." : "Archive"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
