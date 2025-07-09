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
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { QuestionWithDetails, AnswerOptionFormData, QuestionImageFormData } from '@/features/questions/types/questions';
import { useQuestions } from '@/features/questions/hooks/use-questions';
import { useAuthStatus } from '@/features/auth/hooks/use-auth-status';
import { useUserRole } from '@/shared/hooks/use-user-role';

// Components
import { GeneralTab } from './general-tab';
import { OptionsTab } from './options-tab';
import { ReferencesTab } from './references-tab';
import { MediaTab } from './media-tab';
import { TabNavigation } from './tab-navigation';
import { UnsavedChangesDialog } from './unsaved-changes-dialog';
import { QuestionMetadata } from './question-metadata';

// Schema
const editQuestionSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  stem: z.string().min(10, 'Question stem must be at least 10 characters').max(2000, 'Question stem too long'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  teaching_point: z.string().min(10, 'Teaching point must be at least 10 characters').max(1000, 'Teaching point too long'),
  question_references: z.string().max(500, 'References too long').optional(),
  status: z.enum(['draft', 'under_review', 'published', 'rejected']),
  question_set_id: z.string(),
  category_id: z.string().nullable().optional(),
});

export type EditQuestionFormData = z.infer<typeof editQuestionSchema>;

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
  // Core state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [isInitializing, setIsInitializing] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [answerOptions, setAnswerOptions] = useState<AnswerOptionFormData[]>([]);
  const [questionImages, setQuestionImages] = useState<QuestionImageFormData[]>([]);

  // Hooks
  const { updateQuestion } = useQuestions();
  const { user } = useAuthStatus();
  const { isAdmin } = useUserRole();

  // Form
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
      category_id: null,
    },
  });

  // Track form changes
  useEffect(() => {
    const subscription = form.watch((_, { type }) => {
      if (type === 'change' && !isInitializing) {
        setHasUnsavedChanges(true);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, isInitializing]);

  // Initialize form when question changes
  useEffect(() => {
    if (open && question) {
      setIsInitializing(true);

      form.reset({
        title: question.title || '',
        stem: question.stem || '',
        difficulty: question.difficulty as 'easy' | 'medium' | 'hard' || 'medium',
        teaching_point: question.teaching_point || '',
        question_references: question.question_references || '',
        status: question.status as any || 'draft',
        question_set_id: question.question_set_id || 'none',
        category_id: question.categories?.[0]?.id || null,
      });

      // Initialize selected tag IDs
      setSelectedTagIds(question.tags?.map(tag => tag.id) || []);

      // Initialize answer options
      if (question.question_options && question.question_options.length > 0) {
        const sortedOptions = [...question.question_options].sort((a, b) => a.order_index - b.order_index);
        setAnswerOptions(sortedOptions.map(option => ({
          text: option.text,
          is_correct: option.is_correct,
          explanation: option.explanation || '',
          order_index: option.order_index
        })));
      } else {
        // Default to 5 empty options
        setAnswerOptions([
          { text: '', is_correct: true, explanation: '', order_index: 0 },
          { text: '', is_correct: false, explanation: '', order_index: 1 },
          { text: '', is_correct: false, explanation: '', order_index: 2 },
          { text: '', is_correct: false, explanation: '', order_index: 3 },
          { text: '', is_correct: false, explanation: '', order_index: 4 }
        ]);
      }

      // Initialize question images
      if (question.question_images) {
        const images = question.question_images.map(qi => ({
          image_id: qi.image?.id || '',
          question_section: (qi.question_section === 'explanation' ? 'explanation' : 'stem') as 'stem' | 'explanation',
          order_index: qi.order_index || 0
        }));
        setQuestionImages(images);
      } else {
        setQuestionImages([]);
      }

      setHasUnsavedChanges(false);
      setIsInitializing(false);
    }
  }, [open, question, form]);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setActiveTab('general');
      setHasUnsavedChanges(false);
      setIsInitializing(false);
      setSelectedTagIds([]);
      setAnswerOptions([]);
      setQuestionImages([]);
    }
  }, [open]);

  const onSubmit = async (data: EditQuestionFormData) => {
    if (!question || !user) {
      toast.error('Missing required data');
      return;
    }

    if (question.status === 'published' && !isAdmin) {
      toast.error('Only admins can edit published questions');
      return;
    }

    setIsSubmitting(true);
    try {
      const updateData = {
        ...data,
        question_set_id: data.question_set_id === 'none' ? null : data.question_set_id,
        question_references: data.question_references || null,
      };

      await updateQuestion(question.id, updateData, {
        answerOptions: answerOptions,
        questionImages: questionImages,
        tagIds: selectedTagIds,
        categoryId: data.category_id || undefined,
      });

      toast.success('Question updated successfully');
      setHasUnsavedChanges(false);
      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating question:', error);
      toast.error('Failed to update question');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!isSubmitting) {
      if (!open && hasUnsavedChanges) {
        setShowConfirmDialog(true);
      } else {
        onOpenChange(open);
      }
    }
  };

  const handleConfirmClose = () => {
    setShowConfirmDialog(false);
    setHasUnsavedChanges(false);
    onOpenChange(false);
  };

  const handleCancelClose = () => {
    setShowConfirmDialog(false);
  };

  if (!question) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogPortal>
          <DialogOverlay className="backdrop-blur-md bg-black/20" />
          <DialogContent className="w-full !max-w-6xl h-[85vh] flex flex-col p-0 overflow-hidden">
            <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4">
              <DialogTitle>Edit Question</DialogTitle>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full min-h-0">
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  <div className="flex-shrink-0 px-6">
                    <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
                  </div>

                  <div className="flex-1 overflow-y-auto px-6 py-4">
                    {activeTab === 'general' && (
                      <GeneralTab
                        form={form}
                        question={question}
                        onUnsavedChanges={() => setHasUnsavedChanges(true)}
                        onTagsChange={setSelectedTagIds}
                      />
                    )}
                    {activeTab === 'options' && (
                      <OptionsTab
                        question={question}
                        onUnsavedChanges={() => setHasUnsavedChanges(true)}
                        answerOptions={answerOptions}
                        onAnswerOptionsChange={setAnswerOptions}
                      />
                    )}
                    {activeTab === 'references' && (
                      <ReferencesTab
                        form={form}
                        onUnsavedChanges={() => setHasUnsavedChanges(true)}
                      />
                    )}
                    {activeTab === 'media' && (
                      <MediaTab
                        question={question}
                        onUnsavedChanges={() => setHasUnsavedChanges(true)}
                        questionImages={questionImages}
                        onQuestionImagesChange={setQuestionImages}
                      />
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center gap-3 px-6 py-4 flex-shrink-0 border-t bg-background">
                  <QuestionMetadata question={question} />

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
                      disabled={isSubmitting || !hasUnsavedChanges}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        hasUnsavedChanges ? 'Update Question' : 'No Changes'
                      )}
                    </Button>
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
