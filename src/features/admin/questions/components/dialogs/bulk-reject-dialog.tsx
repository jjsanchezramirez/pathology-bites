"use client";

import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { XCircle } from "lucide-react";

interface BulkRejectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questionCount: number;
  /** Called with the trimmed feedback; the same text is stored on every question. */
  onConfirm: (feedback: string) => void;
}

/**
 * Feedback prompt for bulk rejection. A rejected question must carry reviewer
 * feedback (database constraint), so the bulk action can't run without it, the
 * same as the single reject in the review queue.
 */
export function BulkRejectDialog({
  open,
  onOpenChange,
  questionCount,
  onConfirm,
}: BulkRejectDialogProps) {
  const [feedback, setFeedback] = useState("");
  const trimmed = feedback.trim();
  const plural = questionCount !== 1 ? "s" : "";

  const close = () => {
    onOpenChange(false);
    setFeedback("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : close())}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5" />
            Reject {questionCount} Question{plural}
          </DialogTitle>
          <DialogDescription>
            The feedback below is saved on every selected question and shown to its author.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="bulk-reject-feedback">Feedback</Label>
          <Textarea
            id="bulk-reject-feedback"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="What needs to change before these questions can be approved?"
            rows={5}
            maxLength={5000}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={!trimmed}
            onClick={() => {
              onConfirm(trimmed);
              close();
            }}
          >
            Reject {questionCount} Question{plural}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
