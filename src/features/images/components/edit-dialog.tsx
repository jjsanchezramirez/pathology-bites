// src/components/images/edit-dialog.tsx
'use client'

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { updateImage } from '@/features/images/services/images';
import { ImageData, IMAGE_CATEGORIES } from '@/features/images/types/images';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogOverlay,
  DialogPortal,
} from '@/shared/components/ui/dialog';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Button } from '@/shared/components/ui/button';

import { Loader2 } from 'lucide-react';

interface EditImageDialogProps {
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
}: EditImageDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [description, setDescription] = useState('');
  const [altText, setAltText] = useState('');
  const [category, setCategory] = useState<'gross' | 'microscopic' | 'figure' | 'table'>('microscopic');
  const [sourceRef, setSourceRef] = useState('');

  // Initialize state when image changes or dialog opens
  useEffect(() => {
    if (image && open) {
      setDescription(image.description || '');
      setAltText(image.alt_text || '');
      setCategory(image.category as 'gross' | 'microscopic' | 'figure' | 'table');
      setSourceRef(image.source_ref || '');
    }
  }, [image, open]);

  // Reset state when dialog closes (like upload dialog)
  useEffect(() => {
    if (!open) {
      setDescription('');
      setAltText('');
      setCategory('microscopic');
      setSourceRef('');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!image || !altText.trim()) return;

    setIsSubmitting(true);
    try {
      const data = {
        description: description.trim(),
        alt_text: altText.trim(),
        category,
        source_ref: sourceRef.trim() || undefined,
      };

      await updateImage(image.id, data);
      toast.success('Image updated successfully');

      // Close dialog first
      onOpenChange(false);

      // Then trigger refresh after a short delay
      setTimeout(() => {
        onSave();
      }, 100);
    } catch (error) {
      console.error('Failed to update image:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update image');
    } finally {
      setIsSubmitting(false);
    }
  };



  if (!image) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="backdrop-blur-md bg-black/20" />
        <DialogContent
          className="!max-w-[1000px] !w-[85vw] max-h-[85vh] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 bg-background"
          style={{ maxWidth: '1000px', width: '85vw' }}
          showCloseButton={true}
        >
        <DialogHeader>
          <DialogTitle>Edit Image</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Image Preview - Takes 1/3 of space */}
          <div className="space-y-3">
            <div className="rounded-lg overflow-hidden relative h-64">
              <Image
                src={image.url}
                alt={image.alt_text || ''}
                className="object-contain bg-muted/20"
                fill
                unoptimized
                sizes="(max-width: 768px) 100vw, 33vw"
              />
            </div>
            <div className="text-xs text-muted-foreground space-y-1 bg-muted/20 rounded-lg p-3">
              <h4 className="font-medium text-foreground mb-1 text-sm">Image Details</h4>
              <p><strong>File Type:</strong> {image.file_type}</p>
              <p><strong>Uploaded:</strong> {new Date(image.created_at).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Edit Form - Takes 2/3 of space */}
          <div className="lg:col-span-2 space-y-4">
            <h4 className="font-medium text-foreground">Edit Image Information</h4>
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* First row - Name and Category */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="alt_text">Name</Label>
                  <Input
                    id="alt_text"
                    value={altText}
                    onChange={(e) => setAltText(e.target.value)}
                    placeholder="Image name or title"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={category} onValueChange={(value) => setCategory(value as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
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
              </div>

              {/* Second row - Description (full width) */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detailed description of the image"
                  className="min-h-20"
                />
              </div>

              {/* Third row - Source (full width) */}
              <div className="space-y-2">
                <Label htmlFor="source_ref">Source (Optional)</Label>
                <Input
                  id="source_ref"
                  value={sourceRef}
                  onChange={(e) => setSourceRef(e.target.value)}
                  placeholder="Source reference or attribution"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}