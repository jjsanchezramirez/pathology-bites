'use client';

import React from 'react';
import { BlurredDialog } from "@/shared/components/ui/blurred-dialog";
import { Button } from "@/shared/components/ui/button";

interface UnsavedChangesDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function UnsavedChangesDialog({ open, onConfirm, onCancel }: UnsavedChangesDialogProps) {
  return (
    <BlurredDialog
      open={open}
      onOpenChange={() => onCancel()}
      title="Unsaved Changes"
      description="You have unsaved changes. Are you sure you want to close without saving?"
      maxWidth="md"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
          >
            Close Without Saving
          </Button>
        </>
      }
    >
      <div></div>
    </BlurredDialog>
  );
}
