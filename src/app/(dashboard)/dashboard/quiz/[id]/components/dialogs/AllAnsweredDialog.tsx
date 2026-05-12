// src/app/(dashboard)/dashboard/quiz/[id]/components/dialogs/AllAnsweredDialog.tsx

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";

interface AllAnsweredDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitQuiz: () => void;
  onContinue: () => void;
}

/**
 * Shown when the user has just answered the last remaining question (typically by
 * navigating back and filling a skipped question). Offers a shortcut to submit
 * without making them scroll to the last-question Submit button.
 */
export function AllAnsweredDialog({
  open,
  onOpenChange,
  onSubmitQuiz,
  onContinue,
}: AllAnsweredDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>All questions answered</DialogTitle>
          <DialogDescription>
            You&apos;ve answered every question. Submit the quiz now, or keep reviewing your answers
            before submitting.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onContinue}>
            Keep Reviewing
          </Button>
          <Button variant="default" onClick={onSubmitQuiz}>
            Submit Quiz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
