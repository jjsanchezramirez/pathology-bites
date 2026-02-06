// src/app/(dashboard)/dashboard/quiz/[id]/components/dialogs/ExitConfirmDialog.tsx

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";

interface ExitConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmExit: () => void;
  onSaveAndExit: () => void;
  isSaving?: boolean;
}

export function ExitConfirmDialog({
  open,
  onOpenChange,
  onConfirmExit,
  onSaveAndExit,
  isSaving = false,
}: ExitConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Exit Quiz?</DialogTitle>
          <DialogDescription>
            You have an active quiz in progress. What would you like to do?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Continue Quiz
          </Button>
          <Button variant="secondary" onClick={onSaveAndExit} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save & Exit"}
          </Button>
          <Button variant="destructive" onClick={onConfirmExit}>
            Exit Without Saving
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
