// src/components/questions/edit-question-dialog.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
// Removed AlertDialog imports - using regular Dialog for consistency
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/ui/form";

import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Button } from "@/shared/components/ui/button";
import { toast } from 'sonner';
import { Loader2, Plus, X } from 'lucide-react';
import { useQuestions } from '@/features/questions/hooks/use-questions';
import { QuestionWithDetails } from '@/features/questions/types/questions';
import { useQuestionSets } from '@/features/questions/hooks/use-question-sets';
import { useAuthStatus } from '@/features/auth/hooks/use-auth-status';
import { CompactAnswerOptions } from './compact-answer-options';
import { ImageAttachment } from './image-attachment';
import { SimpleTagsSelector } from './simple-tags-selector';
import { CategoriesDropdown } from './categories-dropdown';
import { AnswerOptionFormData, QuestionImageFormData } from '@/features/questions/types/questions';

// Helper functions for updating related question data
async function updateAnswerOptions(questionId: string, answerOptions: any[]) {
  const { createClient } = await import('@/shared/services/client');
  const supabase = createClient();

  // Delete existing question options
  await supabase
    .from('question_options')
    .delete()
    .eq('question_id', questionId);

  // Insert new question options
  if (answerOptions.length > 0) {
    const optionsToInsert = answerOptions
      .filter(option => option.text.trim() !== '')
      .map((option, index) => ({
        question_id: questionId,
        text: option.text.trim(),
        is_correct: option.is_correct,
        explanation: option.explanation || null,
        order_index: index
      }));

    if (optionsToInsert.length > 0) {
      const { error } = await supabase
        .from('question_options')
        .insert(optionsToInsert);

      if (error) throw error;
    }
  }
}

async function updateQuestionImages(questionId: string, questionImages: any[]) {
  const { createClient } = await import('@/shared/services/client');
  const supabase = createClient();

  // Delete existing question images
  await supabase
    .from('question_images')
    .delete()
    .eq('question_id', questionId);

  // Insert new question images
  if (questionImages.length > 0) {
    const imagesToInsert = questionImages.map((img) => ({
      question_id: questionId,
      image_id: img.image_id,
      question_section: img.question_section || 'stem',
      order_index: img.order_index
    }));

    const { error } = await supabase
      .from('question_images')
      .insert(imagesToInsert);

    if (error) throw error;
  }
}

async function updateQuestionTags(questionId: string, tagIds: string[]) {
  const { createClient } = await import('@/shared/services/client');
  const supabase = createClient();

  // Delete existing question tags
  await supabase
    .from('questions_tags')
    .delete()
    .eq('question_id', questionId);

  // Insert new question tags
  if (tagIds.length > 0) {
    const tagsToInsert = tagIds.map(tagId => ({
      question_id: questionId,
      tag_id: tagId
    }));

    const { error } = await supabase
      .from('questions_tags')
      .insert(tagsToInsert);

    if (error) throw error;
  }
}

async function updateQuestionCategory(questionId: string, categoryId: string | null) {
  const { createClient } = await import('@/shared/services/client');
  const supabase = createClient();

  // Update the category_id directly in the questions table
  const { error } = await supabase
    .from('questions')
    .update({ category_id: categoryId })
    .eq('id', questionId);

  if (error) throw error;
}

const editQuestionSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  stem: z.string().min(10, 'Question stem must be at least 10 characters').max(2000, 'Question stem too long'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  teaching_point: z.string().min(10, 'Teaching point must be at least 10 characters').max(1000, 'Teaching point too long'),
  question_references: z.string().max(500, 'References too long').optional(),
  status: z.enum(['draft', 'under_review', 'approved_with_edits', 'rejected', 'published', 'flagged', 'archived']),
  question_set_id: z.string(),
});

type EditQuestionFormData = z.infer<typeof editQuestionSchema>;

// MediaSection component for handling images in specific sections
interface MediaSectionProps {
  images: QuestionImageFormData[];
  section: 'stem' | 'explanation';
  maxImages: number;
  onImagesChange: (images: QuestionImageFormData[]) => void;
}

function MediaSection({ images, section, maxImages, onImagesChange }: MediaSectionProps) {
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [availableImages, setAvailableImages] = useState<any[]>([]);
  const [currentImages, setCurrentImages] = useState<any[]>([]);
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const loadImages = useCallback(async () => {
    setLoading(true);
    try {
      const { fetchImages } = await import('@/features/images/services/images');
      const result = await fetchImages({
        page: 0,
        pageSize: 10, // Load exactly 10 images (2 rows of 5)
        searchTerm: searchTerm || undefined,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      setAvailableImages(result.data);
    } catch (error) {
      console.error('Failed to load images:', error);
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  // Load current images data when images prop changes
  const loadCurrentImages = useCallback(async () => {
    if (images.length === 0) {
      setCurrentImages([]);
      return;
    }

    try {
      const { fetchImages } = await import('@/features/images/services/images');
      const result = await fetchImages({
        page: 0,
        pageSize: 100, // Get enough to cover all possible images
      });

      if (result.error) {
        throw new Error(result.error);
      }

      // Map the current images to their full data
      const imageData = images.map(img => {
        const fullImageData = result.data.find(availImg => availImg.id === img.image_id);
        return {
          ...img,
          imageData: fullImageData
        };
      });

      setCurrentImages(imageData);
    } catch (error) {
      console.error('Failed to load current images:', error);
      setCurrentImages([]);
    }
  }, [images]);

  useEffect(() => {
    if (showImagePicker) {
      loadImages();
      setSelectedImageIds([]); // Reset selection when opening
    }
  }, [loadImages, showImagePicker]);

  useEffect(() => {
    loadCurrentImages();
  }, [loadCurrentImages]);

  const handleImageToggle = (imageId: string) => {
    // Check if image is already added to this section
    const imageAlreadyExists = images.some(img => img.image_id === imageId);
    if (imageAlreadyExists) {
      return; // Don't allow selecting already added images
    }

    setSelectedImageIds(prev => {
      if (prev.includes(imageId)) {
        return prev.filter(id => id !== imageId);
      } else {
        // Check if we would exceed the limit
        const remainingSlots = maxImages - images.length;
        if (prev.length >= remainingSlots) {
          return prev; // Don't add more if it would exceed limit
        }
        return [...prev, imageId];
      }
    });
  };

  const handleSelectImages = () => {
    const newImages: QuestionImageFormData[] = selectedImageIds.map((imageId, index) => ({
      image_id: imageId,
      question_section: section,
      order_index: images.length + index
    }));

    onImagesChange([...images, ...newImages]);
    setSelectedImageIds([]);
    setShowImagePicker(false);
  };

  const handleCancelSelection = () => {
    setSelectedImageIds([]);
    setShowImagePicker(false);
  };

  const handleRemoveImage = (imageId: string, indexToRemove?: number) => {
    let updatedImages;

    if (indexToRemove !== undefined) {
      // Remove specific instance by index
      updatedImages = images.filter((img, index) => index !== indexToRemove);
    } else {
      // Remove first occurrence of the image (fallback)
      const imageIndex = images.findIndex(img => img.image_id === imageId);
      if (imageIndex !== -1) {
        updatedImages = images.filter((img, index) => index !== imageIndex);
      } else {
        return; // Image not found
      }
    }

    // Reorder remaining images
    const reorderedImages = updatedImages.map((img, index) => ({
      ...img,
      order_index: index
    }));
    onImagesChange(reorderedImages);
  };

  return (
    <div>
      {/* Current Images Grid */}
      <div className="grid grid-cols-5 gap-2 mb-3">
        {currentImages.map((imageItem, index) => {
          const imageInfo = imageItem.imageData;
          // Create unique key combining section, image_id, and index to handle duplicate images
          const uniqueKey = `${section}-${imageItem.image_id}-${index}`;

          return (
            <div key={uniqueKey} className="relative group aspect-square">
              <div className="w-full h-full bg-muted rounded border flex items-center justify-center">
                {imageInfo ? (
                  <img
                    src={imageInfo.url}
                    alt={imageInfo.alt_text || ''}
                    className="w-full h-full object-cover rounded"
                  />
                ) : (
                  <div className="text-xs text-muted-foreground text-center p-1">
                    Loading...
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleRemoveImage(imageItem.image_id, index)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          );
        })}

        {/* Add Image Button */}
        {images.length < maxImages && (
          <button
            type="button"
            onClick={() => setShowImagePicker(true)}
            className="aspect-square border-2 border-dashed border-muted-foreground/30 rounded flex items-center justify-center hover:border-muted-foreground/50 transition-colors"
          >
            <Plus className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Image Picker Dialog */}
      <Dialog open={showImagePicker} onOpenChange={handleCancelSelection}>
        <DialogPortal>
          <DialogOverlay className="backdrop-blur-md bg-black/20" />
          <DialogContent className="!max-w-[1090px] !w-[1090px] max-h-[85vh] overflow-hidden border-0">
            <DialogHeader>
              <DialogTitle>Select Images for {section === 'stem' ? 'Question Body' : 'Explanation'}</DialogTitle>
              <DialogDescription>
                Choose up to {maxImages - images.length} more image{maxImages - images.length !== 1 ? 's' : ''} for this section.
                {selectedImageIds.length > 0 && ` ${selectedImageIds.length} image${selectedImageIds.length !== 1 ? 's' : ''} selected.`}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 flex-1 overflow-hidden">
              <Input
                placeholder="Search images..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />

              <div className="border rounded-lg p-4">
                {loading ? (
                  <div className="flex justify-center items-center h-40">
                    <div className="text-sm text-muted-foreground">Loading images...</div>
                  </div>
                ) : availableImages.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-12">
                    <p>No images found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-5 gap-3">
                    {availableImages.map((image) => {
                      const isSelected = selectedImageIds.includes(image.id);
                      const isAlreadyAdded = images.some(img => img.image_id === image.id);
                      const canSelect = !isAlreadyAdded && (isSelected || selectedImageIds.length < (maxImages - images.length));

                      return (
                        <div
                          key={image.id}
                          className={`relative cursor-pointer rounded border-2 transition-all w-48 h-48 ${
                            isAlreadyAdded
                              ? 'border-muted bg-muted/50 opacity-50 cursor-not-allowed'
                              : isSelected
                                ? 'border-primary bg-primary/10'
                                : canSelect
                                  ? 'border-border hover:border-primary/50'
                                  : 'border-muted opacity-50 cursor-not-allowed'
                          }`}
                          onClick={() => canSelect && handleImageToggle(image.id)}
                          title={isAlreadyAdded ? 'Already added to this section' : image.alt_text || ''}
                        >
                          <img
                            src={image.url}
                            alt={image.alt_text || ''}
                            className="w-48 h-48 object-cover rounded"
                          />
                          {isSelected && (
                            <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">
                              ✓
                            </div>
                          )}
                          {isAlreadyAdded && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded">
                              <span className="text-white text-xs font-medium">Added</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={handleCancelSelection}>
                Cancel
              </Button>
              <Button
                onClick={handleSelectImages}
                disabled={selectedImageIds.length === 0}
              >
                Select {selectedImageIds.length > 0 ? `${selectedImageIds.length} ` : ''}Image{selectedImageIds.length !== 1 ? 's' : ''}
              </Button>
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </div>
  );
}

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
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Enhanced form state - Default to 5 answer options
  const [answerOptions, setAnswerOptions] = useState<AnswerOptionFormData[]>([
    { text: '', is_correct: true, explanation: '', order_index: 0 },
    { text: '', is_correct: false, explanation: '', order_index: 1 },
    { text: '', is_correct: false, explanation: '', order_index: 2 },
    { text: '', is_correct: false, explanation: '', order_index: 3 },
    { text: '', is_correct: false, explanation: '', order_index: 4 }
  ]);
  const [questionImages, setQuestionImages] = useState<QuestionImageFormData[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const { updateQuestion } = useQuestions();
  const { questionSets } = useQuestionSets();
  const { user } = useAuthStatus();

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

  // Track form changes
  useEffect(() => {
    const subscription = form.watch((_, { type }) => {
      if (type === 'change') {
        setHasUnsavedChanges(true);
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Track changes in other form fields
  useEffect(() => {
    const hasChanges =
      answerOptions.some(option => option.text.trim() !== '' || option.explanation?.trim() !== '') ||
      questionImages.length > 0 ||
      selectedTagIds.length > 0 ||
      selectedCategoryId !== '';

    if (hasChanges) {
      setHasUnsavedChanges(true);
    }
  }, [answerOptions, questionImages, selectedTagIds, selectedCategoryId]);

  // Fetch complete question data when dialog opens
  const [fullQuestionData, setFullQuestionData] = useState<QuestionWithDetails | null>(null);

  const fetchCompleteQuestionData = useCallback(async (questionId: string) => {
    try {
      const { createClient } = await import('@/shared/services/client');
      const supabase = createClient();

      // First, get the basic question data
      const { data: questionData, error: questionError } = await supabase
        .from('questions')
        .select('*')
        .eq('id', questionId)
        .single();

      if (questionError) {
        console.error('Error fetching question data:', questionError);
        return;
      }

      // Get question options
      const { data: questionOptions, error: optionsError } = await supabase
        .from('question_options')
        .select('*')
        .eq('question_id', questionId)
        .order('order_index');

      // Get question images with image data
      const { data: questionImages, error: imagesError } = await supabase
        .from('question_images')
        .select(`
          *,
          image:images(*)
        `)
        .eq('question_id', questionId)
        .order('order_index');

      // Get tags
      const { data: questionTags, error: tagsError } = await supabase
        .from('question_tags')
        .select(`
          tag:tags(*)
        `)
        .eq('question_id', questionId);

      // Get categories
      const { data: questionCategories, error: categoriesError } = await supabase
        .from('question_categories')
        .select(`
          category:categories(*)
        `)
        .eq('question_id', questionId);

      // Combine all data
      const completeData = {
        ...questionData,
        question_options: questionOptions || [],
        question_images: questionImages || [],
        tags: questionTags || [],
        categories: questionCategories || []
      };

      console.log('Complete question data loaded:', completeData);
      setFullQuestionData(completeData);
    } catch (error) {
      console.error('Error fetching complete question data:', error);
    }
  }, []);

  // Fetch complete data when question changes and dialog opens
  useEffect(() => {
    if (question && open) {
      fetchCompleteQuestionData(question.id);
    }
  }, [question, open, fetchCompleteQuestionData]);

  // Initialize form when complete question data is loaded
  useEffect(() => {
    if (fullQuestionData && open) {
      form.reset({
        title: fullQuestionData.title || '',
        stem: fullQuestionData.stem || '',
        difficulty: fullQuestionData.difficulty as 'easy' | 'medium' | 'hard',
        teaching_point: fullQuestionData.teaching_point || '',
        question_references: fullQuestionData.question_references || '',
        status: fullQuestionData.status as 'draft' | 'published' | 'archived',
        question_set_id: fullQuestionData.question_set_id || 'none',
      });

      // Load existing question options (check both new and legacy field names)
      const existingOptions = fullQuestionData.question_options || fullQuestionData.answer_options;
      if (existingOptions && existingOptions.length > 0) {
        const sortedOptions = [...existingOptions].sort((a, b) => a.order_index - b.order_index);
        setAnswerOptions(sortedOptions.map(option => ({
          text: option.text,
          is_correct: option.is_correct,
          explanation: option.explanation || '',
          order_index: option.order_index
        })));
      } else {
        // Default empty options if none exist
        setAnswerOptions([
          { text: '', is_correct: true, explanation: '', order_index: 0 },
          { text: '', is_correct: false, explanation: '', order_index: 1 },
          { text: '', is_correct: false, explanation: '', order_index: 2 },
          { text: '', is_correct: false, explanation: '', order_index: 3 },
          { text: '', is_correct: false, explanation: '', order_index: 4 }
        ]);
      }

      // Load existing images
      if (fullQuestionData.question_images && fullQuestionData.question_images.length > 0) {
        setQuestionImages(fullQuestionData.question_images.map(qi => ({
          image_id: qi.image?.id || '',
          question_section: (qi.question_section === 'explanation' ? 'explanation' : 'stem') as 'stem' | 'explanation',
          order_index: qi.order_index || 0
        })));
      } else {
        setQuestionImages([]);
      }

      // Load existing tags
      if (fullQuestionData.tags && fullQuestionData.tags.length > 0) {
        setSelectedTagIds(fullQuestionData.tags.map(tag => tag.id));
      } else {
        setSelectedTagIds([]);
      }

      // Load existing categories
      if (fullQuestionData.categories && fullQuestionData.categories.length > 0) {
        setSelectedCategoryId(fullQuestionData.categories[0].id);
      } else {
        setSelectedCategoryId('');
      }
      setHasUnsavedChanges(false);
    }
  }, [fullQuestionData, open, form]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setHasAttemptedSubmit(false);
      setHasUnsavedChanges(false);
    }
  }, [open]);

  // Validation function for answer options
  const validateAnswerOptions = (): Record<string, string> => {
    const errors: Record<string, string> = {};

    console.log('🔍 Validating answer options:', answerOptions);

    if (answerOptions.length < 2) {
      errors.options = 'At least 2 answer options are required';
      console.log('❌ Not enough options:', answerOptions.length);
      return errors;
    }

    const correctAnswers = answerOptions.filter(opt => opt.is_correct);
    console.log('✅ Correct answers found:', correctAnswers.length);
    if (correctAnswers.length !== 1) {
      errors.options = 'Exactly one correct answer must be selected';
      console.log('❌ Wrong number of correct answers:', correctAnswers.length);
    }

    answerOptions.forEach((option, index) => {
      console.log(`🔍 Checking option ${index}:`, { text: option.text, is_correct: option.is_correct, explanation: option.explanation });
      if (!option.text.trim()) {
        errors[`option_${index}_text`] = 'Option text is required';
        console.log(`❌ Option ${index} missing text`);
      }
      if (!option.is_correct && !option.explanation?.trim()) {
        errors[`option_${index}_explanation`] = 'Explanation is required for incorrect answers';
        console.log(`❌ Option ${index} missing explanation`);
      }
    });

    console.log('🔍 Validation errors:', errors);
    return errors;
  };

  const onSubmit = async (data: EditQuestionFormData) => {
    if (!question) return;

    setHasAttemptedSubmit(true);

    if (!user) {
      toast.error('You must be logged in to update questions');
      return;
    }

    // Validate answer options
    const optionErrors = validateAnswerOptions();
    if (Object.keys(optionErrors).length > 0) {
      toast.error('Please fix the answer options errors');
      return;
    }

    setIsSubmitting(true);
    try {
      // Update the question
      const updateData = {
        ...data,
        question_set_id: data.question_set_id === 'none' ? null : data.question_set_id,
        question_references: data.question_references || null,
      };

      console.log('Updating question with data:', updateData);

      // Update all question data in sequence
      await updateQuestion(question.id, updateData);

      console.log('Updating answer options:', answerOptions);
      await updateAnswerOptions(question.id, answerOptions);

      console.log('Updating question images:', questionImages);
      await updateQuestionImages(question.id, questionImages);

      console.log('Updating question tags:', selectedTagIds);
      await updateQuestionTags(question.id, selectedTagIds);

      console.log('Updating question category:', selectedCategoryId);
      await updateQuestionCategory(question.id, selectedCategoryId || null);

      toast.success('Question updated successfully');

      // Reset form state
      setHasUnsavedChanges(false);
      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to update question:', error);

      // Provide specific error message for version conflicts
      let errorMessage = 'Failed to update question';
      if (error instanceof Error) {
        if (error.message.includes('question_versions_question_id_version_number_key')) {
          errorMessage = 'Question update conflict detected. Please try again in a moment.';
        } else {
          errorMessage = error.message;
        }
      }

      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetFormState = () => {
    setHasAttemptedSubmit(false);
    setHasUnsavedChanges(false);
    form.reset();
    setAnswerOptions([
      { text: '', is_correct: true, explanation: '', order_index: 0 },
      { text: '', is_correct: false, explanation: '', order_index: 1 },
      { text: '', is_correct: false, explanation: '', order_index: 2 },
      { text: '', is_correct: false, explanation: '', order_index: 3 },
      { text: '', is_correct: false, explanation: '', order_index: 4 }
    ]);
    setQuestionImages([]);
    setSelectedTagIds([]);
    setSelectedCategoryId('');
  };

  const handleOpenChange = (open: boolean) => {
    if (!isSubmitting) {
      if (!open && hasUnsavedChanges) {
        // Show confirmation dialog if there are unsaved changes
        setShowConfirmDialog(true);
        return; // Don't close the main dialog yet
      } else {
        if (!open) {
          resetFormState();
        }
        onOpenChange(open);
      }
    }
  };

  const handleConfirmClose = () => {
    setShowConfirmDialog(false);
    resetFormState();
    // Use setTimeout to ensure the confirmation dialog closes first
    setTimeout(() => {
      onOpenChange(false);
    }, 0);
  };

  const handleCancelClose = () => {
    setShowConfirmDialog(false);
  };

  if (!question) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogOverlay className="backdrop-blur-md bg-black/20" />
        <DialogContent className="w-full max-w-[min(85vw,1200px)] sm:max-w-[min(85vw,1200px)] h-[75vh] border-0 flex flex-col">
            <DialogHeader>
              <DialogTitle>Edit Question</DialogTitle>
              <DialogDescription>
                Update the question details. You can modify answer options, images, tags, and categories.
              </DialogDescription>
            </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
              <Tabs defaultValue="basic" className="w-full flex flex-col flex-1">
                <TabsList className="grid w-full grid-cols-4 flex-shrink-0">
                  <TabsTrigger value="basic">General</TabsTrigger>
                  <TabsTrigger value="content">Content</TabsTrigger>
                  <TabsTrigger value="references">Teaching & References</TabsTrigger>
                  <TabsTrigger value="media">Media</TabsTrigger>
                </TabsList>

                {/* Scrollable content area */}
                <div className="flex-1 overflow-y-auto min-h-0 py-4">

                {/* Tab 1: Basic Information */}
                <TabsContent value="basic" className="space-y-4 h-full">

              <div className="space-y-4">
                {/* Title - Full Width */}
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

                {/* Question Stem - Full Width */}
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

                {/* Metadata Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <FormField
                    control={form.control}
                    name="difficulty"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Difficulty</FormLabel>
                        <FormControl>
                          <select
                            {...field}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <option value="easy">Easy</option>
                            <option value="medium">Medium</option>
                            <option value="hard">Hard</option>
                          </select>
                        </FormControl>
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
                        <FormControl>
                          <select
                            {...field}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <option value="draft">Draft</option>
                            <option value="under_review">Under Review</option>
                            <option value="approved_with_edits">Approved with Edits</option>
                            <option value="rejected">Rejected</option>
                            <option value="published">Published</option>
                            <option value="flagged">Flagged</option>
                            <option value="archived">Archived</option>
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="question_set_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Question Set</FormLabel>
                        <FormControl>
                          <select
                            {...field}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <option value="none">No question set</option>
                            {questionSets.map((set) => (
                              <option key={set.id} value={set.id}>
                                {set.name}
                              </option>
                            ))}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Categories */}
                  <CategoriesDropdown
                    selectedCategoryId={selectedCategoryId}
                    onCategoryChange={setSelectedCategoryId}
                  />
                </div>

                {/* Tags - Full Width */}
                <SimpleTagsSelector
                  selectedTagIds={selectedTagIds}
                  onTagsChange={setSelectedTagIds}
                />
              </div>

              </TabsContent>

                {/* Tab 2: Content */}
                <TabsContent value="content" className="space-y-4 h-full">
                <div className="space-y-6">
                  {/* Question Options - Full Width */}
                  <CompactAnswerOptions
                    options={answerOptions}
                    onChange={setAnswerOptions}
                    errors={hasAttemptedSubmit ? validateAnswerOptions() : undefined}
                  />
                </div>
                </TabsContent>

                {/* Tab 3: Teaching & References */}
                <TabsContent value="references" className="space-y-6 h-full">
                {/* Teaching Point */}
                <FormField
                  control={form.control}
                  name="teaching_point"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teaching Point</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter the teaching point or explanation..."
                          className="min-h-[120px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* References */}
                <FormField
                  control={form.control}
                  name="question_references"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>References (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter references or citations..."
                          className="min-h-[120px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

                {/* Tab 4: Media */}
                <TabsContent value="media" className="space-y-6 h-full">
                {/* Question Body Images */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">Question Body Images</h4>
                    <span className="text-xs text-muted-foreground">
                      {questionImages.filter(img => img.question_section === 'stem').length}/3
                    </span>
                  </div>
                  <MediaSection
                    images={questionImages.filter(img => img.question_section === 'stem')}
                    section="stem"
                    maxImages={3}
                    onImagesChange={(newImages) => {
                      const explanationImages = questionImages.filter(img => img.question_section === 'explanation');
                      setQuestionImages([...newImages, ...explanationImages]);
                    }}
                  />
                </div>

                {/* Explanation Images */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">Explanation Images</h4>
                    <span className="text-xs text-muted-foreground">
                      {questionImages.filter(img => img.question_section === 'explanation').length}/1
                    </span>
                  </div>
                  <MediaSection
                    images={questionImages.filter(img => img.question_section === 'explanation')}
                    section="explanation"
                    maxImages={1}
                    onImagesChange={(newImages) => {
                      const stemImages = questionImages.filter(img => img.question_section === 'stem');
                      setQuestionImages([...stemImages, ...newImages]);
                    }}
                  />
                </div>
                </TabsContent>
                </div>
              </Tabs>

              <div className="flex justify-between items-center gap-3 pt-6 flex-shrink-0 border-t bg-background">
              {/* Metadata */}
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {question.created_by_name && <span>By: {question.created_by_name}</span>}
                <span>Created: {new Date(question.created_at).toLocaleDateString()}</span>
                <span>Last Updated: {new Date(question.updated_at).toLocaleDateString()}</span>
                {question.version && <span>v{question.version}</span>}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Update Question
              </Button>
              </div>
            </div>
            </form>
          </Form>
        </DialogContent>
      </DialogPortal>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogPortal>
          <DialogOverlay className="backdrop-blur-md bg-black/20" />
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Unsaved Changes</DialogTitle>
              <DialogDescription>
                You have unsaved changes. Are you sure you want to close this dialog? All changes will be lost.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={handleCancelClose}>
                Keep Editing
              </Button>
              <Button
                onClick={handleConfirmClose}
                variant="destructive"
              >
                Discard Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </Dialog>
  );
}
