// src/app/(dashboard)/dashboard/quiz/[id]/components/dialogs/UnansweredWarningDialog.tsx

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";

interface UnansweredWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unansweredCount: number;
  onContinue: () => void;
  onCompleteAnyway: () => void;
}

export function UnansweredWarningDialog({
  open,
  onOpenChange,
  unansweredCount,
  onContinue,
  onCompleteAnyway,
}: UnansweredWarningDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unanswered Questions</DialogTitle>
          <DialogDescription>
            You have {unansweredCount} unanswered question
            {unansweredCount !== 1 ? "s" : ""}. Would you like to review them before completing the
            quiz?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onContinue}>
            Review Questions
          </Button>
          <Button variant="default" onClick={onCompleteAnyway}>
            Complete Anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
