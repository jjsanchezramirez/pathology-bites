"use client";

import { useState, useEffect } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Loader2, Save } from "lucide-react";
import type { ExplainerSequence } from "@/shared/types/explainer";

interface SaveToDatabaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sequence: ExplainerSequence | null;
  // If these are provided, we're updating an existing sequence
  existingSequenceId?: string | null;
  existingTitle?: string;
  existingDescription?: string;
  onSaveSuccess?: (sequenceId: string) => void;
}

export function SaveToDatabaseDialog({
  open,
  onOpenChange,
  sequence,
  existingSequenceId,
  existingTitle,
  existingDescription,
  onSaveSuccess,
}: SaveToDatabaseDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isUpdateMode = !!existingSequenceId;

  // Pre-fill form when in update mode
  useEffect(() => {
    if (open && isUpdateMode) {
      setTitle(existingTitle || "");
      setDescription(existingDescription || "");
    } else if (open && !isUpdateMode) {
      // Clear form when creating new
      setTitle("");
      setDescription("");
      setStatus("draft");
    }
  }, [open, isUpdateMode, existingTitle, existingDescription]);

  const handleSave = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    if (!sequence) {
      setError("No sequence data to save");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const endpoint = isUpdateMode
        ? "/api/admin/interactive-sequences/update"
        : "/api/admin/interactive-sequences/create";

      const body = isUpdateMode
        ? {
            id: existingSequenceId,
            title: title.trim(),
            description: description.trim() || null,
            sequence_data: sequence,
            status,
          }
        : {
            title: title.trim(),
            description: description.trim() || null,
            sequence_data: sequence,
            status,
          };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || `Failed to ${isUpdateMode ? "update" : "save"} sequence`);
        return;
      }

      // Show success state
      setSuccess(true);

      // Reset form after short delay and close
      setTimeout(() => {
        setTitle("");
        setDescription("");
        setStatus("draft");
        setSuccess(false);
        onOpenChange(false);

        // Notify parent
        if (onSaveSuccess && data.sequence?.id) {
          onSaveSuccess(data.sequence.id);
        }
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isUpdateMode ? "Update Sequence" : "Save New Sequence"}</DialogTitle>
          <DialogDescription>
            {isUpdateMode
              ? "Update this existing sequence with your changes."
              : "Save this interactive sequence to the database for use in questions, lessons, and other educational content."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded">
              ✓ Sequence {isUpdateMode ? "updated" : "saved"} successfully!
            </div>
          )}

          {error && !success && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Acute Inflammation Overview"
              disabled={isSaving}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this sequence..."
              rows={3}
              disabled={isSaving}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as "draft" | "published")}
              disabled={isSaving}
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft (work in progress)</SelectItem>
                <SelectItem value="published">Published (ready to use)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="text-sm text-muted-foreground">
            <p>
              <strong>Sequence Info:</strong>
            </p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>{sequence?.segments.length || 0} segments</li>
              <li>{sequence?.duration.toFixed(1) || 0}s duration</li>
              <li>{sequence?.audioUrl ? "With audio" : "No audio"}</li>
              <li>{sequence?.captions?.length || 0} captions</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving || success}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || success || !title.trim()}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : success ? (
              <>✓ Saved</>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {isUpdateMode ? "Update Sequence" : "Save to Database"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
