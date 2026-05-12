// src/app/(dashboard)/dashboard/quiz/[id]/components/dialogs/CompletionFailureDialog.tsx

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface CompletionFailureDialogProps {
  open: boolean;
  errorMessage: string | null;
  isRetrying: boolean;
  onRetry: () => void;
  onDismiss: () => void;
}

/**
 * Shown when all quiz-completion attempts have failed (typically network or server
 * issues). Replaces the disappearing toast + stuck spinner with a persistent dialog
 * the user can act on: retry the completion, or dismiss to stay on the quiz and try
 * again later (their answers are still saved client-side and via auto-save).
 */
export function CompletionFailureDialog({
  open,
  errorMessage,
  isRetrying,
  onRetry,
  onDismiss,
}: CompletionFailureDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !isRetrying && onDismiss()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            We couldn&apos;t submit your quiz
          </DialogTitle>
          <DialogDescription>
            {errorMessage ||
              "Something went wrong while submitting your quiz. Your answers are saved locally — you can try again now or come back later."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onDismiss} disabled={isRetrying}>
            Stay on Quiz
          </Button>
          <Button variant="default" onClick={onRetry} disabled={isRetrying}>
            {isRetrying ? "Retrying..." : "Try Again"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
