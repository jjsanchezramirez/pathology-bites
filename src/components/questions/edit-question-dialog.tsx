// src/components/questions/edit-question-dialog.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from 'lucide-react';
import { useQuestions, QuestionWithDetails } from '@/hooks/use-questions';
import { useQuestionSets } from '@/hooks/use-question-sets';
import { fetchImages } from '@/lib/images/images';
import { ImageData } from '@/types/images';
import { ImagePreview } from '@/components/images/image-preview';

const editQuestionSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  stem: z.string().min(10, 'Question stem must be at least 10 characters').max(2000, 'Question stem too long'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  teaching_point: z.string().min(10, 'Teaching point must be at least 10 characters').max(1000, 'Teaching point too long'),
  question_references: z.string().max(500, 'References too long').optional(),
  status: z.enum(['draft', 'published', 'archived']),
  question_set_id: z.string(),
});

type EditQuestionFormData = z.infer<typeof editQuestionSchema>;

interface EditQuestionDialogProps {
  question: QuestionWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

export function EditQuestionDialog({
  question,
  open,
  onOpenChange,
  onSave
}: EditQuestionDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);

  // Image selection state
  const [availableImages, setAvailableImages] = useState<ImageData[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [imageSearchTerm, setImageSearchTerm] = useState('');
  const [imageCategoryFilter, setImageCategoryFilter] = useState('all');
  const [imagePage, setImagePage] = useState(0);
  const [totalImages, setTotalImages] = useState(0);

  const { toast } = useToast();
  const { updateQuestion } = useQuestions();
  const { questionSets } = useQuestionSets();

  const form = useForm<EditQuestionFormData>({
    resolver: zodResolver(editQuestionSchema),
    defaultValues: {
      title: '',
      stem: '',
      difficulty: 'medium',
      teaching_point: '',
      question_references: '',
      status: 'draft',
      question_set_id: 'none',
    },
  });

  // Load images function
  const loadImages = useCallback(async () => {
    setImagesLoading(true);
    try {
      const result = await fetchImages({
        page: imagePage,
        pageSize: 12,
        searchTerm: imageSearchTerm || undefined,
        category: imageCategoryFilter === 'all' ? undefined : imageCategoryFilter,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      setAvailableImages(result.data);
      setTotalImages(result.total);
    } catch (error) {
      console.error('Failed to load images:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load images',
      });
    } finally {
      setImagesLoading(false);
    }
  }, [imagePage, imageSearchTerm, imageCategoryFilter, toast]);

  // Image selection handlers
  const handleImageToggle = (imageId: string) => {
    setSelectedImages(prev => {
      if (prev.includes(imageId)) {
        return prev.filter(id => id !== imageId);
      } else if (prev.length < 10) { // Max 10 images
        return [...prev, imageId];
      }
      return prev;
    });
  };

  const handleRemoveImage = (imageId: string) => {
    setSelectedImages(prev => prev.filter(id => id !== imageId));
  };

  const handleImageSearch = (term: string) => {
    setImageSearchTerm(term);
    setImagePage(0);
  };

  const handleImageCategoryChange = (category: string) => {
    setImageCategoryFilter(category);
    setImagePage(0);
  };

  // Initialize form when question changes
  useEffect(() => {
    if (question && open) {
      form.reset({
        title: question.title || '',
        stem: question.stem || '',
        difficulty: question.difficulty as 'easy' | 'medium' | 'hard',
        teaching_point: question.teaching_point || '',
        question_references: question.question_references || '',
        status: question.status as 'draft' | 'published' | 'archived',
        question_set_id: question.question_set_id || 'none',
      });

      // TODO: Load existing images for this question
      setSelectedImages([]);

      // Load images when dialog opens
      loadImages();
    } else if (!open) {
      // Reset image state when dialog closes
      setImageSearchTerm('');
      setImageCategoryFilter('all');
      setImagePage(0);
    }
  }, [question, open, form, loadImages]);

  // Reload images when search/filter changes
  useEffect(() => {
    if (open) {
      loadImages();
    }
  }, [open, loadImages]);

  const onSubmit = async (data: EditQuestionFormData) => {
    if (!question) return;

    setIsSubmitting(true);
    try {
      // Update the question
      const updateData = {
        ...data,
        question_set_id: data.question_set_id === 'none' ? null : data.question_set_id,
        question_references: data.question_references || null,
      };

      await updateQuestion(question.id, updateData);

      // TODO: Handle image associations if selectedImages changed
      // This would require additional API calls to update question_images records

      toast({
        title: 'Success',
        description: 'Question updated successfully',
      });

      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to update question:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update question',
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
        setSelectedImages([]);
      }
    }
  };

  if (!question) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Question</DialogTitle>
          <DialogDescription>
            Update the question details. You can modify images and change the question set association.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter question title..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="stem"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Question Stem</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter the question content..."
                          className="min-h-[120px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="teaching_point"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teaching Point</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter the teaching point or explanation..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="question_references"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>References (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter references or citations..."
                          className="min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="difficulty"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Difficulty</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select difficulty" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="easy">Easy</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="hard">Hard</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="published">Published</SelectItem>
                            <SelectItem value="archived">Archived</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="question_set_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Question Set (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select question set" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No question set</SelectItem>
                          {questionSets.map((set) => (
                            <SelectItem key={set.id} value={set.id}>
                              {set.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Image Selection */}
                <div className="space-y-3">
                  <label className="text-sm font-medium">Images (Optional)</label>

                  {/* Selected Images Display */}
                  {selectedImages.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Selected Images ({selectedImages.length}/10)
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {selectedImages.map((imageId) => {
                          const image = availableImages.find(img => img.id === imageId);
                          if (!image) return null;
                          return (
                            <div key={imageId} className="relative group">
                              <div className="w-12 h-12 rounded border overflow-hidden">
                                <ImagePreview
                                  src={image.url}
                                  alt={image.alt_text}
                                  size="sm"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <button
                                type="button"
                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleRemoveImage(imageId)}
                              >
                                ×
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Image Search and Filter */}
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Search images..."
                        value={imageSearchTerm}
                        onChange={(e) => handleImageSearch(e.target.value)}
                        className="flex-1"
                      />
                      <Select value={imageCategoryFilter} onValueChange={handleImageCategoryChange}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="gross">Gross</SelectItem>
                          <SelectItem value="microscopic">Microscopic</SelectItem>
                          <SelectItem value="figure">Figure</SelectItem>
                          <SelectItem value="table">Table</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Available Images Grid */}
                  <div className="border rounded-md p-3 max-h-48 overflow-y-auto">
                    {imagesLoading ? (
                      <div className="flex justify-center items-center h-20">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="ml-2 text-sm text-muted-foreground">Loading images...</span>
                      </div>
                    ) : availableImages.length === 0 ? (
                      <div className="text-center text-sm text-muted-foreground py-4">
                        No images found
                      </div>
                    ) : (
                      <div className="grid grid-cols-6 gap-2">
                        {availableImages.map((image) => {
                          const isSelected = selectedImages.includes(image.id);
                          const canSelect = !isSelected && selectedImages.length < 10;

                          return (
                            <div
                              key={image.id}
                              className={`relative cursor-pointer rounded border-2 transition-all ${
                                isSelected
                                  ? 'border-primary bg-primary/10'
                                  : canSelect
                                    ? 'border-border hover:border-primary/50'
                                    : 'border-border opacity-50 cursor-not-allowed'
                              }`}
                              onClick={() => canSelect || isSelected ? handleImageToggle(image.id) : undefined}
                            >
                              <div className="aspect-square rounded overflow-hidden">
                                <ImagePreview
                                  src={image.url}
                                  alt={image.alt_text}
                                  size="sm"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              {isSelected && (
                                <div className="absolute top-0 right-0 bg-primary text-primary-foreground rounded-full w-4 h-4 text-xs flex items-center justify-center">
                                  ✓
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Pagination */}
                    {totalImages > 12 && (
                      <div className="flex justify-center gap-2 mt-3 pt-2 border-t">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setImagePage(p => Math.max(0, p - 1))}
                          disabled={imagePage === 0}
                        >
                          Previous
                        </Button>
                        <span className="text-xs text-muted-foreground self-center">
                          Page {imagePage + 1} of {Math.ceil(totalImages / 12)}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setImagePage(p => p + 1)}
                          disabled={(imagePage + 1) * 12 >= totalImages}
                        >
                          Next
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Question Info */}
                <div className="text-sm text-muted-foreground space-y-1 pt-4 border-t">
                  <p><strong>Created:</strong> {new Date(question.created_at).toLocaleDateString()}</p>
                  <p><strong>Last Updated:</strong> {new Date(question.updated_at).toLocaleDateString()}</p>
                  <p><strong>Version:</strong> {question.version}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Update Question
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
