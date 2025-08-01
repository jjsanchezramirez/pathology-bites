'use client'

// Single image deletion confirmation dialog
import { useState } from 'react';
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
import { Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { deleteImage } from '@/features/images/services/images';
import type { ImageData } from '@/features/images/types/images';

interface DeleteImageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  image: ImageData | null;
  onSuccess: () => void;
}

export function DeleteImageDialog({ 
  open, 
  onOpenChange, 
  image,
  onSuccess 
}: DeleteImageDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!image) return;

    try {
      setIsDeleting(true);
      
      await deleteImage(image.storage_path, image.id);
      
      toast.success('Image deleted successfully');
      onSuccess();
      onOpenChange(false);
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete image';
      console.error('Delete error:', error);
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!image) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="backdrop-blur-md bg-black/20" />
        <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm Deletion</DialogTitle>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Are you sure you want to permanently delete "{image.alt_text || 'Untitled image'}"?</p>
            <p>This action cannot be undone.</p>
          </div>
        </DialogHeader>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Image
              </>
            )}
          </Button>
        </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
