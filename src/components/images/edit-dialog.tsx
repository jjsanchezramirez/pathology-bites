import { useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Trash2 } from 'lucide-react';
import { useImageEdit } from '@/hooks/use-image-edit';
import { IMAGE_CATEGORIES, type ImageData, ImageCategory } from '@/types/images';
import Image from 'next/image';

interface EditDialogProps {
  image: ImageData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

export function EditImageDialog({ 
  image, 
  open, 
  onOpenChange, 
  onSave 
}: EditDialogProps) {
  const {
    formData,
    setFormData,
    isLoading,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    handleUpdateImage,
    handleDeleteImage,
    initializeForm,
    resetState
  } = useImageEdit({ onSuccess: onSave });

  // Debug logging: track mount/unmount
  useEffect(() => {
    console.log("EditImageDialog mounted");
    return () => {
      console.log("EditImageDialog unmounted");
      // Force cleanup on unmount
      resetState();
      // Remove any potential focus traps or overlay classes.
      document.body.classList.remove('dialog-open');
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    };
  }, [resetState]);

  // Initialize form on open; force cleanup when closed.
  useEffect(() => {
    if (open) {
      console.log("Dialog opened, initializing form");
      initializeForm(image);
      // If your dialog library adds a body class for modals, add it here:
      document.body.classList.add('dialog-open');
    } else {
      console.log("Dialog closed, cleaning up");
      resetState();
      document.body.classList.remove('dialog-open');
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }
  }, [open, image, initializeForm, resetState]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (image) {
      await handleUpdateImage(image.id);
      onOpenChange(false);
    }
  };

  const handleDelete = async () => {
    if (image) {
      await handleDeleteImage(image.id, image.storage_path);
      onOpenChange(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onOpenChange={(openState) => {
        console.log("Dialog open state changed:", openState);
        onOpenChange(openState);
        if (!openState) {
          // Extra cleanup when dialog is closed.
          resetState();
          document.body.classList.remove('dialog-open');
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
        }
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit Image</DialogTitle>
          <DialogDescription>Update the image details and category</DialogDescription>
        </DialogHeader>

        {image ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Image Preview */}
            <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted flex items-center justify-center">
              <Image
                src={image.url}
                alt={formData.alt_text || image.alt_text}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-contain"
                priority
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => {
                  setFormData({
                    ...formData,
                    description: e.target.value
                  });
                }}
                placeholder="Enter a detailed description of the image"
                className="resize-none"
                rows={3}
              />
            </div>

            {/* Alt Text */}
            <div className="space-y-2">
              <Label htmlFor="alt_text">Alt Text</Label>
              <Input
                id="alt_text"
                value={formData.alt_text}
                onChange={(e) => {
                  setFormData({
                    ...formData,
                    alt_text: e.target.value
                  });
                }}
                placeholder="Enter alternative text for screen readers"
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => {
                  setFormData({
                    ...formData,
                    category: value as ImageCategory
                  });
                }}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(IMAGE_CATEGORIES).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="destructive"
                onClick={() => setIsDeleteDialogOpen(true)}
                disabled={isLoading}
                className="w-full sm:w-auto"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isLoading}
                  className="flex-1 sm:flex-none"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 sm:flex-none min-w-[80px]"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Save'
                  )}
                </Button>
              </div>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <p>No image selected.</p>
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        )}
      </DialogContent>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Image</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this image? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}