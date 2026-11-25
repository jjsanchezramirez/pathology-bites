"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { QuestionWithDetails } from "@/shared/types/questions";
import { useUserRole } from "@/shared/hooks/use-user-role";
import { useAuthContext } from "@/features/auth/components/auth-provider";
import { canDeleteQuestion } from "@/features/admin/questions/utils/deletion-helpers";

interface DeleteQuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: QuestionWithDetails | null;
  onSuccess: () => void;
  onDelete: (questionId: string) => Promise<void>;
}

export function DeleteQuestionDialog({
  open,
  onOpenChange,
  question,
  onSuccess,
  onDelete,
}: DeleteQuestionDialogProps) {
  const [isDeleting, setIsDeleting] = React.useState(false);
  const { isAdmin, can } = useUserRole();
  const { user } = useAuthContext();

  // Check if deletion is allowed
  const deletionCheck = canDeleteQuestion(question, {
    isAdmin,
    canCreate: can("create_questions"),
    userId: user?.id || null,
  });

  const handleDelete = async () => {
    if (!question || !deletionCheck.canDelete) return;

    setIsDeleting(true);
    try {
      await onDelete(question.id);
      onOpenChange(false);
      onSuccess();
    } catch {
      // Error is handled by the hook
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="backdrop-blur-md bg-black/20" />
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {deletionCheck.canDelete ? "Archive this question?" : "Cannot archive this question"}
            </DialogTitle>
            <DialogDescription>
              {deletionCheck.canDelete ? (
                <>
                  "{question?.title}" will be archived and hidden from students and the review
                  queue. Nothing is deleted: its options, images, history and student answers are
                  kept, and it can be restored to draft from the Archived filter.
                </>
              ) : (
                `Cannot archive "${question?.title}"`
              )}
            </DialogDescription>
          </DialogHeader>

          {!deletionCheck.canDelete && deletionCheck.reason && (
            <div className="px-6">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{deletionCheck.reason}</AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
              {deletionCheck.canDelete ? "Cancel" : "Close"}
            </Button>
            {deletionCheck.canDelete && (
              <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? "Archiving..." : "Archive"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
