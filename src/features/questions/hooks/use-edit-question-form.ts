// src/features/questions/hooks/use-edit-question-form.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { QuestionWithDetails, QuestionOptionFormData, QuestionImageFormData } from '@/features/questions/types/questions';
import { useQuestions } from './use-questions';

// Form schema
const editQuestionSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  stem: z.string().min(10, 'Question stem must be at least 10 characters').max(2000, 'Question stem too long'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  teaching_point: z.string().min(10, 'Teaching point must be at least 10 characters').max(1000, 'Teaching point too long'),
  question_references: z.string().max(500, 'References too long').optional(),
  status: z.enum(['draft', 'pending_review', 'approved', 'flagged']),
  question_set_id: z.string(),
  category_id: z.string().nullable().optional(),
  updateType: z.enum(['patch', 'minor', 'major']).optional(),
  isPatchEdit: z.boolean().optional(),
  patchEditReason: z.string().max(500, 'Reason too long').optional(),
});

export type EditQuestionFormData = z.infer<typeof editQuestionSchema>;

interface UseEditQuestionFormProps {
  question?: QuestionWithDetails;
  open: boolean;
  onSave: () => void;
  onClose: () => void;
}

export function useEditQuestionForm({ question, open, onSave, onClose }: UseEditQuestionFormProps) {
  // State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [answerOptions, setAnswerOptions] = useState<QuestionOptionFormData[]>([]);
  const [questionImages, setQuestionImages] = useState<QuestionImageFormData[]>([]);
  const [isPatchEdit, setIsPatchEdit] = useState(false);
  const [patchEditReason, setPatchEditReason] = useState('');

  // Hooks
  const { updateQuestion } = useQuestions();

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
      updateType: 'patch',
      isPatchEdit: false,
      patchEditReason: '',
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

      // For published questions, default to patch edit
      const isPublished = question.status === 'published';
      setIsPatchEdit(isPublished);

      form.reset({
        title: question.title || '',
        stem: question.stem || '',
        difficulty: question.difficulty as 'easy' | 'medium' | 'hard' || 'medium',
        teaching_point: question.teaching_point || '',
        question_references: question.question_references || '',
        status: (question.status as 'draft' | 'pending_review' | 'approved' | 'flagged') || 'draft',
        question_set_id: question.question_set_id || 'none',
        category_id: question.category_id || null,
        updateType: isPublished ? 'patch' : 'minor',
        isPatchEdit: isPublished,
        patchEditReason: '',
      });

      // Initialize selected tag IDs
      const tagIds = question.tags?.map(tag => tag.id) || [];
      setSelectedTagIds(tagIds);

      // Initialize answer options with IDs for existing options
      const options: QuestionOptionFormData[] = question.question_options?.map((option, index) => ({
        id: option.id, // Include the ID for existing options
        text: option.text,
        is_correct: option.is_correct,
        explanation: option.explanation || '',
        order_index: index,
      })) || [];

      // Ensure we have at least 2 options
      while (options.length < 2) {
        options.push({
          text: '',
          is_correct: false,
          explanation: '',
          order_index: options.length,
        });
      }

      setAnswerOptions(options);

      // Initialize question images
      const images = question.question_images?.map((img, index) => ({
        image_id: img.image_id,
        question_section: img.question_section as 'stem' | 'explanation',
        order_index: index,
      })) || [];

      setQuestionImages(images);

      setTimeout(() => {
        setIsInitializing(false);
        setHasUnsavedChanges(false);
      }, 100);
    }
  }, [open, question, form]);

  // Handle form submission
  const handleSubmit = useCallback(async (data: EditQuestionFormData) => {
    if (!question) return;

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
        updateType: data.updateType,
        changeSummary: isPatchEdit ? patchEditReason : 'Question updated',
        isPatchEdit: isPatchEdit,
        patchEditReason: patchEditReason,
      });

      setHasUnsavedChanges(false);
      onSave();
      onClose();
    } catch (error) {
      toast.error('Failed to update question');
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [question, answerOptions, questionImages, selectedTagIds, updateQuestion, onSave, onClose, isPatchEdit, patchEditReason]);

  // Handle unsaved changes
  const handleUnsavedChanges = useCallback(() => {
    if (!isInitializing) {
      setHasUnsavedChanges(true);
    }
  }, [isInitializing]);

  return {
    // Form
    form,

    // State
    isSubmitting,
    hasUnsavedChanges,
    isInitializing,
    isPatchEdit,
    patchEditReason,

    // Form data
    selectedTagIds,
    answerOptions,
    questionImages,

    // Setters
    setSelectedTagIds,
    setAnswerOptions,
    setQuestionImages,
    setIsPatchEdit,
    setPatchEditReason,

    // Handlers
    handleSubmit,
    handleUnsavedChanges,
  };
}
