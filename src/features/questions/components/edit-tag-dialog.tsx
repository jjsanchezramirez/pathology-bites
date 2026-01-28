// src/components/question-management/edit-tag-dialog.tsx
"use client";

import { useState, useEffect } from "react";
import { toast } from "@/shared/utils/toast";
import { BlurredDialog } from "@/shared/components/ui/blurred-dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/shared/utils/api-client";

interface Tag {
  id: string;
  name: string;
  created_at: string;
  question_count?: number;
}

interface EditTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  tag: Tag | null;
}

const MAX_TAG_LENGTH = 50;
const MIN_TAG_LENGTH = 2;

export function EditTagDialog({ open, onOpenChange, onSuccess, tag }: EditTagDialogProps) {
  const [name, setName] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState("");

  // Update form when tag changes
  useEffect(() => {
    if (tag && open) {
      setName(tag.name);
      setError("");
    }
  }, [tag, open]);

  const validateTagName = (value: string): string | null => {
    const trimmed = value.trim();

    if (!trimmed) {
      return "Tag name is required";
    }

    if (trimmed.length < MIN_TAG_LENGTH) {
      return `Tag name must be at least ${MIN_TAG_LENGTH} characters`;
    }

    if (trimmed.length > MAX_TAG_LENGTH) {
      return `Tag name cannot exceed ${MAX_TAG_LENGTH} characters`;
    }

    // Check for invalid characters (allow letters, numbers, spaces, hyphens, underscores)
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(trimmed)) {
      return "Tag name can only contain letters, numbers, spaces, hyphens, and underscores";
    }

    return null;
  };

  const handleNameChange = (value: string) => {
    setName(value);
    const validationError = validateTagName(value);
    setError(validationError || "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateTagName(name);
    if (validationError) {
      setError(validationError);
      toast.error(validationError);
      return;
    }

    if (!tag) {
      toast.error("No tag selected for editing");
      return;
    }

    setIsUpdating(true);
    try {
      const response = await apiClient.patch("/api/admin/questions/metadata/tags", {
        tagId: tag.id,
        name: name.trim(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update tag");
      }

      toast.success("Tag updated successfully");

      // Close dialog first, then refresh data
      onOpenChange(false);
      setTimeout(() => {
        onSuccess();
      }, 100);
    } catch (error) {
      console.error("Error updating tag:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update tag");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isUpdating) {
      onOpenChange(newOpen);
      // Note: State cleanup removed to prevent conflicts with Select dropdown portals
      // State will be reset when dialog opens again via useEffect
    }
  };

  return (
    <BlurredDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Edit Tag"
      description="Update the tag name. This will affect all questions that use this tag."
      maxWidth="md"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isUpdating}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isUpdating || !name.trim() || !!error}
            onClick={handleSubmit}
          >
            {isUpdating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              "Update Tag"
            )}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Tag Name</Label>
          <Input
            id="name"
            placeholder="Enter tag name..."
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            disabled={isUpdating}
            autoFocus
            className={error ? "border-red-500" : ""}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <p className="text-xs text-muted-foreground">
            {name.length}/{MAX_TAG_LENGTH} characters
          </p>
        </div>
      </form>
    </BlurredDialog>
  );
}
