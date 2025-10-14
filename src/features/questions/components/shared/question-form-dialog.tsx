'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Form } from "@/shared/components/ui/form";
import { Button } from "@/shared/components/ui/button";
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useAuthStatus } from '@/features/auth/hooks/use-auth-status';
import { useUserRole } from '@/shared/hooks/use-user-role';
import { QuestionWithDetails, QuestionOptionFormData, QuestionImageFormData } from '@/features/questions/types/questions';

// Shared tab components
import { GeneralTab } from './general-tab';
import { OptionsTab } from './options-tab';
import { ReferencesTab } from './references-tab';
import { MediaTab } from './media-tab';
import { TabNavigation } from './tab-navigation';
import { UnsavedChangesDialog } from './unsaved-changes-dialog';
import { QuestionMetadata } from './question-metadata';

// Schema for both create and edit modes
const questionFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  stem: z.string().min(10, 'Question stem must be at least 10 characters').max(2000, 'Question stem too long'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  teaching_point: z.string().min(10, 'Teaching point must be at least 10 characters').max(1000, 'Teaching point too long'),
  question_references: z.string().max(500, 'References too long').optional(),
  status: z.enum(['draft', 'pending_review', 'rejected', 'published', 'flagged', 'archived']),
  question_set_id: z.string(),
  category_id: z.string().nullable().optional(),
});

export type QuestionFormData = z.infer<typeof questionFormSchema>;

interface QuestionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  mode: 'create' | 'edit';
  question?: QuestionWithDetails; // Only required for edit mode
  onSubmit: (
    data: QuestionFormData,
    options: {
      answerOptions: QuestionOptionFormData[];
      questionImages: QuestionImageFormData[];
      tagIds: string[];
      categoryId?: string;
    }
  ) => Promise<void>;
}

export function QuestionFormDialog({
  open,
  onOpenChange,
  onSave,
  mode,
  question,
  onSubmit
}: QuestionFormDialogProps) {
  // State
  const [activeTab, setActiveTab] = useState('general');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  
  // Form state
  const [answerOptions, setAnswerOptions] = useState<QuestionOptionFormData[]>([]);
  const [questionImages, setQuestionImages] = useState<QuestionImageFormData[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // Hooks
  const { user } = useAuthStatus();
  const { isAdmin } = useUserRole();

  // Form
  const form = useForm<QuestionFormData>({
    resolver: zodResolver(questionFormSchema),
    defaultValues: {
      title: '',
      stem: '',
      difficulty: 'medium',
      teaching_point: '',
      question_references: '',
      status: 'draft',
      question_set_id: 'none',
      category_id: null,
    },
  });

  // Initialize form data for edit mode
  useEffect(() => {
    if (mode === 'edit' && question && open) {
      setIsInitializing(true);
      
      // Set form values
      form.reset({
        title: question.title || '',
        stem: question.stem || '',
        difficulty: (question.difficulty as 'easy' | 'medium' | 'hard') || 'medium',
        teaching_point: question.teaching_point || '',
        question_references: question.question_references || '',
        status: (question.status as 'draft' | 'pending' | 'approved' | 'flagged') || 'draft',
        question_set_id: question.question_set_id || 'none',
        category_id: question.category_id || null,
      });

      // Set answer options
      const options = question.question_options || [];
      setAnswerOptions(options.map((opt, index) => ({
        id: opt.id,
        text: opt.text,
        is_correct: opt.is_correct,
        explanation: opt.explanation || '',
        order_index: index,
      })));

      // Set question images
      const images = question.question_images || [];
      setQuestionImages(images.map((img, index) => ({
        image_id: img.image_id,
        question_section: img.question_section as 'stem' | 'explanation',
        order_index: index,
      })));

      // Set selected tags
      const tags = question.tags || [];
      setSelectedTagIds(tags.map(tag => tag.id));

      setIsInitializing(false);
      setHasUnsavedChanges(false);
    } else if (mode === 'create' && open) {
      // Reset for create mode
      form.reset();
      setAnswerOptions([
        { text: '', is_correct: true, explanation: '', order_index: 0 },
        { text: '', is_correct: false, explanation: '', order_index: 1 },
        { text: '', is_correct: false, explanation: '', order_index: 2 },
        { text: '', is_correct: false, explanation: '', order_index: 3 },
        { text: '', is_correct: false, explanation: '', order_index: 4 },
      ]);
      setQuestionImages([]);
      setSelectedTagIds([]);
      setIsInitializing(false);
      setHasUnsavedChanges(false);
    }
  }, [mode, question, open, form]);

  // Track form changes
  useEffect(() => {
    const subscription = form.watch((_, { type }) => {
      if (type === 'change' && !isInitializing) {
        setHasUnsavedChanges(true);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, isInitializing]);

  // Handle dialog close with unsaved changes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && hasUnsavedChanges) {
      setShowConfirmDialog(true);
    } else {
      onOpenChange(newOpen);
      if (!newOpen) {
        setActiveTab('general');
        setHasUnsavedChanges(false);
      }
    }
  };

  const handleConfirmClose = () => {
    setShowConfirmDialog(false);
    setHasUnsavedChanges(false);
    onOpenChange(false);
    setActiveTab('general');
  };

  const handleCancelClose = () => {
    setShowConfirmDialog(false);
  };

  // Form submission
  const handleSubmit = async (data: QuestionFormData) => {
    if (mode === 'edit' && !question) {
      toast.error('Missing question data');
      return;
    }

    if (mode === 'edit' && question?.status === 'approved' && !isAdmin) {
      toast.error('Only admins can edit published questions');
      return;
    }

    setIsSubmitting(true);
    try {
      const updateData = {
        ...data,
        question_set_id: data.question_set_id === 'none' ? 'none' : data.question_set_id,
        question_references: data.question_references || undefined,
      };

      await onSubmit(updateData, {
        answerOptions,
        questionImages,
        tagIds: selectedTagIds,
        categoryId: data.category_id || undefined,
      });

      toast.success(mode === 'create' ? 'Question created successfully' : 'Question updated successfully');
      setHasUnsavedChanges(false);
      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error(`Error ${mode === 'create' ? 'creating' : 'updating'} question:`, error);
      toast.error(`Failed to ${mode === 'create' ? 'create' : 'update'} question`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const dialogTitle = mode === 'create' ? 'Create New Question' : 'Edit Question';

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogPortal>
          <DialogOverlay className="backdrop-blur-md bg-black/30" />
          <DialogContent className="!max-w-[1100px] !w-[95vw] max-h-[85vh] overflow-hidden border-0 p-0">
            <DialogHeader className="px-6 py-4 border-b bg-background">
              <DialogTitle className="text-xl font-semibold">{dialogTitle}</DialogTitle>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col h-full">
                <div className="flex flex-col h-full">
                  <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

                  <div className="flex-1 overflow-y-auto px-6 py-4">
                    {activeTab === 'general' && (
                      <GeneralTab
                        form={form}
                        question={question}
                        selectedTagIds={selectedTagIds}
                        setSelectedTagIds={setSelectedTagIds}
                        onUnsavedChanges={() => setHasUnsavedChanges(true)}
                        mode={mode}
                      />
                    )}
                    {activeTab === 'options' && (
                      <OptionsTab
                        question={question}
                        answerOptions={answerOptions}
                        setAnswerOptions={setAnswerOptions}
                        hasAttemptedSubmit={false}
                        validateAnswerOptions={() => ({})}
                        onUnsavedChanges={() => setHasUnsavedChanges(true)}
                        mode={mode}
                      />
                    )}
                    {activeTab === 'references' && (
                      <ReferencesTab
                        form={form}
                        onUnsavedChanges={() => setHasUnsavedChanges(true)}
                        mode={mode}
                      />
                    )}
                    {activeTab === 'media' && (
                      <MediaTab
                        question={question}
                        questionImages={questionImages}
                        setQuestionImages={setQuestionImages}
                        onUnsavedChanges={() => setHasUnsavedChanges(true)}
                        mode={mode}
                      />
                    )}
                  </div>

                  <div className="flex justify-between items-center gap-3 px-6 py-4 flex-shrink-0 border-t bg-background">
                    {mode === 'edit' && question && <QuestionMetadata question={question} />}
                    {mode === 'create' && <div />}

                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleOpenChange(false)}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={isSubmitting || (mode === 'edit' && !hasUnsavedChanges)}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {mode === 'create' ? 'Creating...' : 'Updating...'}
                          </>
                        ) : (
                          mode === 'create' ? 'Create Question' : 
                          hasUnsavedChanges ? 'Update Question' : 'No Changes'
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </form>
            </Form>
          </DialogContent>
        </DialogPortal>
      </Dialog>

      <UnsavedChangesDialog
        open={showConfirmDialog}
        onConfirm={handleConfirmClose}
        onCancel={handleCancelClose}
      />
    </>
  );
}
