// src/app/(dashboard)/dashboard/quiz/[id]/components/dialogs/TimerExpiredDialog.tsx

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";

interface TimerExpiredDialogProps {
  open: boolean;
  onViewResults: () => void;
}

export function TimerExpiredDialog({ open, onViewResults }: TimerExpiredDialogProps) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Time&apos;s Up!</DialogTitle>
          <DialogDescription>
            The time limit for this quiz has been reached. Your quiz has been automatically
            submitted.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={onViewResults}>View Results</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
