"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { AlertCircle, CheckCircle, AlertTriangle } from "lucide-react";

interface SaveConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editType: "patch" | "minor" | "major";
  onConfirm: (changeSummary: string) => void;
  isSubmitting: boolean;
}

const EDIT_TYPE_INFO = {
  patch: {
    title: "Patch Edit",
    icon: CheckCircle,
    iconColor: "text-green-600 dark:text-green-500",
    bgColor: "bg-green-50 dark:bg-green-950/20",
    borderColor: "border-green-200 dark:border-green-800",
    description: "Minor corrections (typos, formatting, metadata). Stays published.",
    impact: "✓ Stays published immediately",
    version: "1.0.0 → 1.0.1",
    requiresReview: false,
  },
  minor: {
    title: "Minor Edit",
    icon: AlertTriangle,
    iconColor: "text-yellow-600 dark:text-yellow-500",
    bgColor: "bg-yellow-50 dark:bg-yellow-950/20",
    borderColor: "border-yellow-200 dark:border-yellow-800",
    description: "Content changes (stem clarification, explanations, images). Requires review.",
    impact: "⚠ Requires re-review before republishing",
    version: "1.0.0 → 1.1.0",
    requiresReview: true,
  },
  major: {
    title: "Major Edit",
    icon: AlertCircle,
    iconColor: "text-red-600 dark:text-red-500",
    bgColor: "bg-red-50 dark:bg-red-950/20",
    borderColor: "border-red-200 dark:border-red-800",
    description: "Significant changes (correct answer, complete rewrite, difficulty change). Requires review.",
    impact: "⚠ Requires re-review before republishing",
    version: "1.0.0 → 2.0.0",
    requiresReview: true,
  },
};

export function SaveConfirmationDialog({
  open,
  onOpenChange,
  editType,
  onConfirm,
  isSubmitting,
}: SaveConfirmationDialogProps) {
  const [changeSummary, setChangeSummary] = useState("");
  const info = EDIT_TYPE_INFO[editType];
  const Icon = info.icon;

  const handleConfirm = () => {
    onConfirm(changeSummary);
    setChangeSummary("");
  };

  const handleCancel = () => {
    setChangeSummary("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${info.iconColor}`} />
            Confirm {info.title}
          </DialogTitle>
          <DialogDescription>{info.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Edit Type Details */}
          <div className={`p-4 rounded-lg border ${info.bgColor} ${info.borderColor}`}>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Impact</p>
                  <p className="text-sm font-medium mt-1">{info.impact}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Version</p>
                  <p className="text-sm font-medium mt-1">{info.version}</p>
                </div>
              </div>

              {info.requiresReview && (
                <div className="pt-3 border-t border-current/20">
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    ⚠️ This question will be moved to pending review and require approval before republishing.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Change Summary Input */}
          <div className="space-y-2">
            <Label htmlFor="changeSummary">
              Describe your changes {info.requiresReview ? "(required)" : "(optional)"}
            </Label>
            <Textarea
              id="changeSummary"
              value={changeSummary}
              onChange={(e) => setChangeSummary(e.target.value)}
              placeholder={
                editType === "patch"
                  ? "e.g., Fixed typo in question stem"
                  : editType === "minor"
                    ? "e.g., Clarified teaching point and updated distractor options"
                    : "e.g., Changed correct answer from A to B based on updated guidelines"
              }
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              This will be recorded in the question's version history.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isSubmitting || (info.requiresReview && !changeSummary.trim())}
          >
            {isSubmitting ? "Saving..." : `Confirm ${info.title}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
