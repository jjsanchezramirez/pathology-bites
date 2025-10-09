'use client';

import React from 'react';
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
import { AlertTriangle } from 'lucide-react';
import { QuestionWithDetails } from '@/features/questions/types/questions';
import { useUserRole } from '@/shared/hooks/use-user-role';
import { useAuthStatus } from '@/features/auth/hooks/use-auth-status';
import { canDeleteQuestion } from '@/features/questions/utils/deletion-helpers';

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
  onDelete
}: DeleteQuestionDialogProps) {
  const [isDeleting, setIsDeleting] = React.useState(false);
  const { role } = useUserRole();
  const { user } = useAuthStatus();

  // Check if deletion is allowed
  const deletionCheck = canDeleteQuestion(question, role, user?.id || null);

  const handleDelete = async () => {
    if (!question || !deletionCheck.canDelete) return;

    setIsDeleting(true);
    try {
      await onDelete(question.id);
      onOpenChange(false);
      onSuccess();
    } catch (error) {
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
              {deletionCheck.canDelete ? 'Confirm Deletion' : 'Cannot Delete Question'}
            </DialogTitle>
            <DialogDescription>
              {deletionCheck.canDelete ? (
                <>
                  Are you sure you want to delete "{question?.title}"?
                  <br />
                  <br />
                  This action cannot be undone. All associated answer options and images will also be removed.
                </>
              ) : (
                `Cannot delete "${question?.title}"`
              )}
            </DialogDescription>
          </DialogHeader>

          {!deletionCheck.canDelete && deletionCheck.reason && (
            <div className="px-6">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {deletionCheck.reason}
                </AlertDescription>
              </Alert>
            </div>
          )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            {deletionCheck.canDelete ? 'Cancel' : 'Close'}
          </Button>
          {deletionCheck.canDelete && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Confirm Deletion'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
