"use client";

import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Loader2, UserCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

interface Reviewer {
  id: string;
  name: string;
  full_name: string;
  pending_count: number;
}

interface ReviewerAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmittingForReview: boolean;
  updateType: string | undefined;
  loadingReviewers: boolean;
  reviewers: Reviewer[];
  selectedReviewerId: string;
  onSelectReviewer: (id: string) => void;
  onCancel: () => void;
  onAssign: () => void;
}

export function ReviewerAssignmentDialog({
  open,
  onOpenChange,
  isSubmittingForReview,
  updateType,
  loadingReviewers,
  reviewers,
  selectedReviewerId,
  onSelectReviewer,
  onCancel,
  onAssign,
}: ReviewerAssignmentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Assign Reviewer</DialogTitle>
          <DialogDescription>
            {isSubmittingForReview
              ? "Please select a reviewer to evaluate this question."
              : `This ${updateType} edit requires review. Please select a reviewer to evaluate these changes.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reviewer">Select Reviewer</Label>
            {loadingReviewers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Select value={selectedReviewerId} onValueChange={onSelectReviewer}>
                <SelectTrigger id="reviewer">
                  <SelectValue placeholder="Select a reviewer..." />
                </SelectTrigger>
                <SelectContent>
                  {reviewers.map((reviewer) => (
                    <SelectItem key={reviewer.id} value={reviewer.id}>
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-4 w-4" />
                          <span>{reviewer.full_name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground ml-4">
                          {reviewer.pending_count} pending
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {reviewers.length === 0 && !loadingReviewers && (
              <p className="text-sm text-muted-foreground">No reviewers available</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onAssign} disabled={!selectedReviewerId || loadingReviewers}>
            Assign & Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
