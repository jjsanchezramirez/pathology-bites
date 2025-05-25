// src/components/images/edit-dialog.tsx
'use client'

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { updateImage } from '@/lib/images/images';
import { ImageData, IMAGE_CATEGORIES } from '@/types/images';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ImagePreview } from './image-preview';
import { Loader2 } from 'lucide-react';

const editImageSchema = z.object({
  description: z.string().min(1, 'Description is required').max(500, 'Description too long'),
  alt_text: z.string().min(1, 'Alt text is required').max(200, 'Alt text too long'),
  category: z.enum(['gross', 'microscopic', 'figure', 'table']), // Updated to match IMAGE_CATEGORIES
});

type EditImageFormData = z.infer<typeof editImageSchema>;

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
  const { toast } = useToast();

  const form = useForm<EditImageFormData>({
    resolver: zodResolver(editImageSchema),
    defaultValues: {
      description: '',
      alt_text: '',
      category: 'microscopic',
    },
  });

  // Initialize form when image changes
  useEffect(() => {
    if (image && open) {
      form.reset({
        description: image.description || '',
        alt_text: image.alt_text || '',
        category: image.category as 'gross' | 'microscopic' | 'figure' | 'table',
      });
    }
  }, [image, open, form]);

  const onSubmit = async (data: EditImageFormData) => {
    if (!image) return;

    setIsSubmitting(true);
    try {
      await updateImage(image.id, data);
      toast({
        title: 'Success',
        description: 'Image updated successfully',
      });
      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to update image:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update image',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!isSubmitting) {
      onOpenChange(open);
      if (!open) {
        form.reset();
      }
    }
  };

  if (!image) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Image</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Image Preview */}
          <div className="space-y-4">
            <ImagePreview
              src={image.url}
              alt={image.alt_text}
              size="lg"
              className="w-full h-48"
            />
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>File Type:</strong> {image.file_type}</p>
              <p><strong>Created:</strong> {new Date(image.created_at).toLocaleDateString()}</p>
              {image.source_ref && (
                <p><strong>Source:</strong> {image.source_ref}</p>
              )}
            </div>
          </div>

          {/* Edit Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="alt_text"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Alt Text</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Descriptive text for screen readers"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Detailed description of the image"
                        className="min-h-24"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(IMAGE_CATEGORIES).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
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
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}