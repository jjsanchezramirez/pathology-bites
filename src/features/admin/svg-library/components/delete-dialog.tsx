"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogOverlay,
  DialogPortal,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "@/shared/utils/ui/toast";
import type { SvgAsset } from "../types";
import { log } from "@/shared/utils/logging";

interface DeleteSvgDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: SvgAsset | null;
  onSuccess: () => void;
}

export function DeleteSvgDialog({ open, onOpenChange, asset, onSuccess }: DeleteSvgDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!asset) return;

    try {
      setIsDeleting(true);

      const response = await fetch(`/api/admin/svg-assets/${asset.id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Delete failed");
      }

      toast.success("SVG asset deleted successfully");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete SVG asset";
      log.error("Delete error:", error);
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!asset) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="backdrop-blur-md bg-black/20" />
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Are you sure you want to permanently delete &quot;{asset.name}&quot;?</p>
              <p>This action cannot be undone.</p>
            </div>
          </DialogHeader>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete SVG
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
