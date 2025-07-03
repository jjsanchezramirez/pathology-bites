'use client'

// Cleanup confirmation dialog for orphaned images
import { useState } from 'react';
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
import { Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getOrphanedImages } from '@/features/images/services/image-analytics';
import { bulkDeleteImages } from '@/features/images/services/images';

interface CleanupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orphanedCount: number;
  orphanedSize: string;
  onSuccess: () => void;
}

export function CleanupDialog({ 
  open, 
  onOpenChange, 
  orphanedCount, 
  orphanedSize,
  onSuccess 
}: CleanupDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCleanup = async () => {
    if (orphanedCount === 0) return;

    try {
      setIsDeleting(true);
      
      // Get orphaned images
      const orphanedImages = await getOrphanedImages();
      const orphanedIds = orphanedImages.map(img => img.id);

      if (orphanedIds.length === 0) {
        toast.info('No orphaned images to clean up');
        onOpenChange(false);
        return;
      }

      // Delete orphaned images
      const result = await bulkDeleteImages(orphanedIds);

      if (result.success) {
        toast.success(`Successfully deleted ${result.deleted} orphaned images`);
        onSuccess();
        onOpenChange(false);
      } else {
        toast.error(`Failed to delete some images: ${result.errors.join(', ')}`);
      }
    } catch (error) {
      console.error('Failed to cleanup orphaned images:', error);
      toast.error('Failed to cleanup orphaned images');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="backdrop-blur-md bg-black/20" />
        <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm Deletion</DialogTitle>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Are you sure you want to permanently delete {orphanedCount} unused images ({orphanedSize})?</p>
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
            onClick={handleCleanup}
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
                Delete {orphanedCount} Unused Images
              </>
            )}
          </Button>
        </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
