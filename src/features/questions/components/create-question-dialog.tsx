// src/components/questions/create-question-dialog.tsx
'use client';

import { useState, useEffect } from 'react';
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
import { Loader2 } from 'lucide-react';
import { useQuestions } from '@/features/questions/hooks/use-questions';
import { useQuestionSets } from '@/features/questions/hooks/use-question-sets';
import { useAuthStatus } from '@/features/auth/hooks/use-auth-status';
import { CompactAnswerOptions } from './compact-answer-options';
import { ImageAttachment } from './image-attachment';
import { SimpleTagsSelector } from './simple-tags-selector';
import { CategoriesDropdown } from './categories-dropdown';
import { AnswerOptionFormData, QuestionImageFormData } from '@/features/questions/types/questions';

const createQuestionSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  stem: z.string().min(10, 'Question stem must be at least 10 characters').max(2000, 'Question stem too long'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  teaching_point: z.string().min(10, 'Teaching point must be at least 10 characters').max(1000, 'Teaching point too long'),
  question_references: z.string().max(500, 'References too long').optional(),
  status: z.enum(['draft', 'under_review', 'approved_with_edits', 'rejected', 'published', 'flagged', 'archived']),
  question_set_id: z.string(),
});

type CreateQuestionFormData = z.infer<typeof createQuestionSchema>;

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
  const { createQuestion } = useQuestions();
  const { questionSets } = useQuestionSets();
  const { user } = useAuthStatus();

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
        question_set_id: data.question_set_id === 'none' ? null : data.question_set_id,
        question_references: data.question_references || null,
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
          fetch('/api/answer-options', {
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
          fetch('/api/question-tags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questionTags: questionTagsData }),
          })
        );
      }

      // 4. Create question category
      if (selectedCategoryId) {
        promises.push(
          fetch('/api/question-categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              questionCategories: [{
                question_id: newQuestion.id,
                category_id: selectedCategoryId,
              }]
            }),
          })
        );
      }

      // Create array to track which API each promise corresponds to
      const promiseLabels = [];
      if (answerOptions.length > 0) promiseLabels.push('answer-options');
      if (questionImages.length > 0) promiseLabels.push('question-images');
      if (selectedTagIds.length > 0) promiseLabels.push('question-tags');
      if (selectedCategoryId) promiseLabels.push('question-categories');

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
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Section 1: Basic Information */}
            <div className="space-y-6">
              <div className="border-b pb-4">
                <h3 className="text-lg font-semibold text-foreground">1. Basic Information</h3>
                <p className="text-sm text-muted-foreground">Enter the question details and metadata</p>
              </div>

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

                {/* Tags Section - Moved below and made more horizontal */}
                <div className="space-y-3">
                  <SimpleTagsSelector
                    selectedTagIds={selectedTagIds}
                    onTagsChange={setSelectedTagIds}
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Answer Options and Content */}
            <div className="space-y-6">
              <div className="border-b pb-4">
                <h3 className="text-lg font-semibold text-foreground">2. Answer Options & Content</h3>
                <p className="text-sm text-muted-foreground">Define answer choices, explanations, and teaching points</p>
              </div>

              <div className="space-y-6">
                {/* Answer Options - Full Width */}
                <CompactAnswerOptions
                  options={answerOptions}
                  onChange={setAnswerOptions}
                  errors={hasAttemptedSubmit ? validateAnswerOptions() : undefined}
                />

                {/* Teaching Point and References - Side by Side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                </div>
              </div>
            </div>

            {/* Section 3: Images */}
            <div className="space-y-6">
              <div className="border-b pb-4">
                <h3 className="text-lg font-semibold text-foreground">3. Images</h3>
                <p className="text-sm text-muted-foreground">Add images to support your question and explanations</p>
              </div>

              <ImageAttachment
                selectedImages={questionImages}
                onSelectionChange={setQuestionImages}
              />
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t">
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
                Create Question
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
