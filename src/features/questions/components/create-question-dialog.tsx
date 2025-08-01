// src/components/questions/create-question-dialog.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Image from 'next/image';
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
// Removed AlertDialog imports - using regular Dialog for consistency
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/ui/form";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Button } from "@/shared/components/ui/button";
import { toast } from 'sonner';
import { Loader2, Plus, X } from 'lucide-react';
import { useQuestions } from '@/features/questions/hooks/use-questions';
import { useQuestionSets } from '@/features/questions/hooks/use-question-sets';
import { useAuthStatus } from '@/features/auth/hooks/use-auth-status';
import { CompactAnswerOptions } from './compact-answer-options';
import { AnswerOptionFormData, QuestionImageFormData } from '@/features/questions/types/questions';

const createQuestionSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  stem: z.string().min(10, 'Question stem must be at least 10 characters').max(2000, 'Question stem too long'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  teaching_point: z.string().min(10, 'Teaching point must be at least 10 characters').max(1000, 'Teaching point too long'),
  question_references: z.string().max(500, 'References too long').optional(),
  status: z.enum(['draft', 'pending', 'approved', 'flagged']),
  question_set_id: z.string(),
});

type CreateQuestionFormData = z.infer<typeof createQuestionSchema>;

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
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Debounce search term to prevent flickering during fast typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300); // 300ms delay

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadImages = React.useCallback(async () => {
    try {
      const { fetchImages } = await import('@/features/images/services/images');
      const result = await fetchImages({
        page: 0,
        pageSize: 10, // Load exactly 10 images (2 rows of 5)
        searchTerm: debouncedSearchTerm || undefined,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      setAvailableImages(result.data);
    } catch (error) {
      console.error('Failed to load images:', error);
    }
  }, [debouncedSearchTerm]);

  useEffect(() => {
    if (showImagePicker) {
      loadImages();
    }
  }, [showImagePicker, loadImages]);

  const handleRemoveImage = (imageId: string, index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);
  };

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
    const newImages = selectedImageIds.map((imageId, index) => ({
      image_id: imageId,
      question_section: section,
      order_index: images.length + index + 1,
    }));

    onImagesChange([...images, ...newImages]);
    setSelectedImageIds([]);
    setShowImagePicker(false);
  };

  const handleCancelSelection = () => {
    setSelectedImageIds([]);
    setShowImagePicker(false);
    setSearchTerm('');
  };

  return (
    <div>
      <div className="grid grid-cols-5 gap-4">
        {/* Existing Images */}
        {images.map((imageItem, index) => {
          const uniqueKey = `${imageItem.image_id}-${index}`;
          const imageInfo = availableImages.find(img => img.id === imageItem.image_id);

          return (
            <div key={uniqueKey} className="relative group aspect-square">
              <div className="w-full h-full bg-muted rounded border flex items-center justify-center">
                {imageInfo ? (
                  <Image
                    src={imageInfo.url}
                    alt={imageInfo.alt_text || ''}
                    fill
                    unoptimized
                    className="object-cover rounded"
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
          <DialogOverlay className="backdrop-blur-md bg-black/30" />
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
                {availableImages.length === 0 ? (
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
                          <Image
                            src={image.url}
                            alt={image.alt_text || ''}
                            width={192}
                            height={192}
                            unoptimized
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

interface CreateQuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

export function CreateQuestionDialog({
  open,
  onOpenChange,
  onSave
}: CreateQuestionDialogProps) {
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
  const [tagSearch, setTagSearch] = useState('');
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [availableCategories, setAvailableCategories] = useState<any[]>([]);
  const { createQuestion } = useQuestions();
  const { questionSets } = useQuestionSets();
  const { user } = useAuthStatus();

  // Filter tags based on search
  const filteredTags = availableTags.filter(tag =>
    tag.name.toLowerCase().includes(tagSearch.toLowerCase())
  );

  // Check if we can create a new tag
  const canCreateNewTag = tagSearch.trim() &&
    !availableTags.some(tag => tag.name.toLowerCase() === tagSearch.toLowerCase());

  // Create new tag function
  const createNewTag = async (tagName: string) => {
    try {
      const response = await fetch('/api/admin/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tagName.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create tag');
      }

      const data = await response.json();
      const newTag = data.tag;

      // Add to available tags
      setAvailableTags(prev => [...prev, newTag]);

      // Add to selected tags
      setSelectedTagIds(prev => [...prev, newTag.id]);

      // Clear search
      setTagSearch('');
      setHasUnsavedChanges(true);

      toast.success('Tag created successfully');
    } catch (error) {
      console.error('Failed to create tag:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create tag');
    }
  };

  const form = useForm<CreateQuestionFormData>({
    resolver: zodResolver(createQuestionSchema),
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

  // Load tags and categories when dialog opens
  useEffect(() => {
    if (open) {
      // Reset form and state when dialog opens
      setHasUnsavedChanges(false);
      setHasAttemptedSubmit(false);
      setTagSearch('');
      setSelectedTagIds([]);
      setSelectedCategoryId('');
      setQuestionImages([]);
      setAnswerOptions([
        { text: '', is_correct: true, explanation: '', order_index: 0 },
        { text: '', is_correct: false, explanation: '', order_index: 1 },
        { text: '', is_correct: false, explanation: '', order_index: 2 },
        { text: '', is_correct: false, explanation: '', order_index: 3 },
        { text: '', is_correct: false, explanation: '', order_index: 4 }
      ]);
      form.reset();

      // Load tags (latest 10 created)
      fetch('/api/admin/tags?page=0&pageSize=10&sortBy=created_at&sortOrder=desc')
        .then(res => res.json())
        .then(data => setAvailableTags(data.tags || []))
        .catch(err => console.error('Failed to load tags:', err));

      // Load categories
      fetch('/api/admin/categories?page=0&pageSize=1000')
        .then(res => res.json())
        .then(data => setAvailableCategories(data.categories || []))
        .catch(err => console.error('Failed to load categories:', err));
    }
  }, [open, form]);

  // Watch for form changes to set unsaved changes flag
  useEffect(() => {
    const subscription = form.watch(() => {
      setHasUnsavedChanges(true);
    });
    return () => subscription.unsubscribe();
  }, [form]);

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

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
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
    }
  }, [open, form]);

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

  const onSubmit = async (data: CreateQuestionFormData) => {
    setHasAttemptedSubmit(true);

    if (!user) {
      toast.error('You must be logged in to create questions');
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
      // Create the question
      const questionData = {
        ...data,
        created_by: user.id,
        updated_by: user.id,
        question_set_id: data.question_set_id === 'none' ? null : data.question_set_id,
        question_references: data.question_references || null,
        category_id: selectedCategoryId || null,
      };

      const newQuestion = await createQuestion(questionData);

      // Create all related records in parallel
      const promises = [];

      // 1. Create answer options
      if (answerOptions.length > 0) {
        const answerOptionsData = answerOptions.map(option => ({
          question_id: newQuestion.id,
          text: option.text,
          is_correct: option.is_correct,
          explanation: option.explanation || null,
          order_index: option.order_index,
        }));

        promises.push(
          fetch('/api/questions/answer-options', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answerOptions: answerOptionsData }),
          })
        );
      }

      // 2. Create question images
      if (questionImages.length > 0) {
        const questionImagesData = questionImages.map(img => ({
          question_id: newQuestion.id,
          image_id: img.image_id,
          question_section: img.question_section,
          order_index: img.order_index,
        }));

        promises.push(
          fetch('/api/question-images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questionImages: questionImagesData }),
          })
        );
      }

      // 3. Create question tags
      if (selectedTagIds.length > 0) {
        const questionTagsData = selectedTagIds.map(tagId => ({
          question_id: newQuestion.id,
          tag_id: tagId,
        }));

        promises.push(
          fetch('/api/questions/tags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questionTags: questionTagsData }),
          })
        );
      }

      // Note: Category is now set directly on the question via category_id field

      // Create array to track which API each promise corresponds to
      const promiseLabels = [];
      if (answerOptions.length > 0) promiseLabels.push('answer-options');
      if (questionImages.length > 0) promiseLabels.push('question-images');
      if (selectedTagIds.length > 0) promiseLabels.push('question-tags');

      // Wait for all related records to be created and check for errors
      const results = await Promise.allSettled(promises);

      // Check if any requests failed
      const errors = [];

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const apiName = promiseLabels[i] || `API ${i + 1}`;

        if (result.status === 'rejected') {
          errors.push(`${apiName}: ${result.reason?.message || 'Network error'}`);
        } else if (!result.value.ok) {
          try {
            const errorData = await result.value.json();
            errors.push(`${apiName}: ${errorData.error || 'Unknown error'}`);
          } catch {
            errors.push(`${apiName}: Failed to parse error response`);
          }
        }
      }

      if (errors.length > 0) {
        console.error('Some related records failed to create:', errors);
        toast.warning(`Question created but some related data failed: ${errors.join(', ')}`);
      } else {
        toast.success('Question created successfully with all related data');
      }

      // Reset form state
      setHasUnsavedChanges(false);
      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create question:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create question');
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogOverlay className="backdrop-blur-md bg-black/20" />
        <DialogContent className="w-full max-w-[min(85vw,1400px)] sm:max-w-[min(85vw,1400px)] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Question</DialogTitle>
          <DialogDescription>
            Create a new question for your question bank. You can add images and associate it with a question set.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
            <div className="flex flex-col h-full">
              <Tabs defaultValue="general" className="flex-1 flex flex-col">
                <TabsList className="grid w-full grid-cols-4 flex-shrink-0">
                  <TabsTrigger value="general">General</TabsTrigger>
                  <TabsTrigger value="options">Options</TabsTrigger>
                  <TabsTrigger value="references">References</TabsTrigger>
                  <TabsTrigger value="media">Media</TabsTrigger>
                </TabsList>
                {/* Tab 1: General */}
                <TabsContent value="general" className="space-y-4 flex-1 overflow-y-auto">
                  <div className="grid grid-cols-1 gap-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Question title"
                              {...field}
                              onChange={(e) => {
                                field.onChange(e);
                                setHasUnsavedChanges(true);
                              }}
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
                              placeholder="Enter the question text..."
                              className="min-h-[100px]"
                              {...field}
                              onChange={(e) => {
                                field.onChange(e);
                                setHasUnsavedChanges(true);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select
                              onValueChange={(value) => {
                                field.onChange(value);
                                setHasUnsavedChanges(true);
                              }}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="draft">Draft</SelectItem>
                                <SelectItem value="pending">Pending Review</SelectItem>
                                <SelectItem value="approved">Approved</SelectItem>
                                <SelectItem value="flagged">Flagged</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="difficulty"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Difficulty</FormLabel>
                            <Select
                              onValueChange={(value) => {
                                field.onChange(value);
                                setHasUnsavedChanges(true);
                              }}
                              defaultValue={field.value}
                            >
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
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Category Selection */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Category</label>
                        <Select
                          onValueChange={(value) => {
                            setSelectedCategoryId(value);
                            setHasUnsavedChanges(true);
                          }}
                          value={selectedCategoryId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableCategories.map((category) => (
                              <SelectItem key={category.id} value={category.id}>
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Question Set Selection */}
                      <FormField
                        control={form.control}
                        name="question_set_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Question Set</FormLabel>
                            <Select
                              onValueChange={(value) => {
                                field.onChange(value);
                                setHasUnsavedChanges(true);
                              }}
                              defaultValue={field.value}
                            >
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
                    </div>

                    {/* Tags Section with Search */}
                    <div className="space-y-2">
                      <FormLabel>Tags</FormLabel>
                      <Input
                        placeholder="Search tags or type to create new (press Enter)..."
                        value={tagSearch}
                        onChange={(e) => setTagSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (canCreateNewTag) {
                              createNewTag(tagSearch);
                            }
                          }
                        }}
                        className="mb-2"
                      />
                      <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                        {/* Create new tag option */}
                        {canCreateNewTag && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => createNewTag(tagSearch)}
                            className="border-dashed border-primary text-primary hover:bg-primary/10"
                          >
                            + Create "{tagSearch}" (or press Enter)
                          </Button>
                        )}

                        {/* Existing tags */}
                        {filteredTags.map((tag) => (
                          <Button
                            key={tag.id}
                            type="button"
                            variant={selectedTagIds.includes(tag.id) ? "default" : "outline"}
                            size="sm"
                            onClick={() => {
                              setSelectedTagIds(prev =>
                                prev.includes(tag.id)
                                  ? prev.filter(id => id !== tag.id)
                                  : [...prev, tag.id]
                              );
                              setHasUnsavedChanges(true);
                            }}
                          >
                            {tag.name}
                          </Button>
                        ))}

                        {/* Show message when no tags found and can't create */}
                        {filteredTags.length === 0 && !canCreateNewTag && tagSearch && (
                          <div className="text-sm text-muted-foreground py-2">
                            No tags found matching "{tagSearch}"
                          </div>
                        )}

                        {/* Show hint when no search term */}
                        {!tagSearch && filteredTags.length === 0 && (
                          <div className="text-sm text-muted-foreground py-2">
                            Showing latest 10 tags. Type to search or create new tags.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Tab 2: Answer Options */}
                <TabsContent value="options" className="space-y-4 flex-1 overflow-y-auto">
                  <CompactAnswerOptions
                    options={answerOptions}
                    onChange={(newOptions) => {
                      setAnswerOptions(newOptions);
                      setHasUnsavedChanges(true);
                    }}
                    errors={hasAttemptedSubmit ? validateAnswerOptions() : undefined}
                  />
                </TabsContent>

                {/* Tab 3: References & Teaching Point */}
                <TabsContent value="references" className="space-y-4 flex-1 overflow-y-auto">
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="teaching_point"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Teaching Point</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Key learning point or takeaway from this question..."
                              className="min-h-[100px]"
                              {...field}
                              onChange={(e) => {
                                field.onChange(e);
                                setHasUnsavedChanges(true);
                              }}
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
                          <FormLabel>References</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Add references, citations, or sources..."
                              className="min-h-[100px]"
                              {...field}
                              onChange={(e) => {
                                field.onChange(e);
                                setHasUnsavedChanges(true);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>

                {/* Tab 4: Media */}
                <TabsContent value="media" className="space-y-6 flex-1 overflow-y-auto">
                  <div className="space-y-6">
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
                          setHasUnsavedChanges(true);
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
                          setHasUnsavedChanges(true);
                        }}
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t flex-shrink-0 bg-background">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !hasUnsavedChanges}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    {hasUnsavedChanges ? 'Create Question' : 'No Changes'}
                  </>
                )}
              </Button>
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
              <Button onClick={handleConfirmClose} variant="destructive">
                Discard Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </Dialog>
  );
}
