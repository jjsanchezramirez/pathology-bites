// src/features/questions/hooks/use-create-question-form.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { useQuestions } from './use-questions';
import { useAuthStatus } from '@/features/auth/hooks/use-auth-status';
import { QuestionOptionFormData, QuestionImageFormData } from '../types/questions';

// Schema for create question form
const createQuestionSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  stem: z.string().min(10, 'Question stem must be at least 10 characters').max(2000, 'Question stem too long'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  teaching_point: z.string().min(10, 'Teaching point must be at least 10 characters').max(1000, 'Teaching point too long'),
  question_references: z.string().max(500, 'References too long').optional(),
  status: z.enum(['draft', 'pending', 'approved', 'flagged']),
  question_set_id: z.string(),
  category_id: z.string().nullable().optional(),
});

export type CreateQuestionFormData = z.infer<typeof createQuestionSchema>;

interface UseCreateQuestionFormProps {
  open: boolean;
  onSave: () => void;
  onClose: () => void;
}

export function useCreateQuestionForm({ open, onSave, onClose }: UseCreateQuestionFormProps) {
  // State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [answerOptions, setAnswerOptions] = useState<QuestionOptionFormData[]>([]);
  const [questionImages, setQuestionImages] = useState<QuestionImageFormData[]>([]);

  // Hooks
  const { createQuestion } = useQuestions();
  const { user } = useAuthStatus();

  // Form
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

  // Initialize form when dialog opens
  useEffect(() => {
    if (open) {
      setIsInitializing(true);
      
      // Reset form and state
      form.reset({
        title: '',
        stem: '',
        difficulty: 'medium',
        teaching_point: '',
        question_references: '',
        status: 'draft',
        question_set_id: 'none',
        category_id: null,
      });

      // Initialize answer options with default structure
      setAnswerOptions([
        { text: '', is_correct: true, explanation: '', order_index: 0 },
        { text: '', is_correct: false, explanation: '', order_index: 1 },
        { text: '', is_correct: false, explanation: '', order_index: 2 },
        { text: '', is_correct: false, explanation: '', order_index: 3 },
        { text: '', is_correct: false, explanation: '', order_index: 4 }
      ]);

      // Reset other state
      setQuestionImages([]);
      setSelectedTagIds([]);
      setHasUnsavedChanges(false);
      setHasAttemptedSubmit(false);

      setTimeout(() => setIsInitializing(false), 100);
    }
  }, [open, form]);

  // Track changes in answer options, images, and tags
  useEffect(() => {
    if (!isInitializing) {
      const hasChanges =
        answerOptions.some(option => option.text.trim() !== '' || option.explanation?.trim() !== '') ||
        questionImages.length > 0 ||
        selectedTagIds.length > 0;

      if (hasChanges) {
        setHasUnsavedChanges(true);
      }
    }
  }, [answerOptions, questionImages, selectedTagIds, isInitializing]);

  // Validate answer options
  const validateAnswerOptions = useCallback(() => {
    const errors: Record<string, string> = {};
    
    // Filter out empty options
    const validOptions = answerOptions.filter(option => option.text.trim() !== '');
    
    if (validOptions.length < 2) {
      errors.general = 'At least 2 answer options are required';
    }
    
    const hasCorrectAnswer = validOptions.some(option => option.is_correct);
    if (!hasCorrectAnswer) {
      errors.general = 'At least one correct answer is required';
    }
    
    return errors;
  }, [answerOptions]);

  // Handle form submission
  const handleSubmit = useCallback(async (data: CreateQuestionFormData) => {
    if (!user) {
      toast.error('You must be logged in to create questions');
      return;
    }

    setHasAttemptedSubmit(true);

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
        category_id: data.category_id || null,
      };

      const newQuestion = await createQuestion(questionData);

      // Create related records in parallel
      const promises = [];

      // 1. Create answer options
      if (answerOptions.length > 0) {
        const validOptions = answerOptions.filter(option => option.text.trim() !== '');
        if (validOptions.length > 0) {
          const answerOptionsData = validOptions.map(option => ({
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
          fetch('/api/questions/images', {
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
          fetch('/api/content/questions/tags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questionTags: questionTagsData }),
          })
        );
      }

      // Wait for all related records to be created
      const results = await Promise.allSettled(promises);
      
      // Check for any failures
      const failures = results.filter(result => result.status === 'rejected');
      if (failures.length > 0) {
        console.warn('Some related records failed to create:', failures);
        toast.warning('Question created, but some related data may not have been saved');
      }

      toast.success('Question created successfully');
      setHasUnsavedChanges(false);
      onSave();
      onClose();
    } catch (error) {
      console.error('Error creating question:', error);
      toast.error('Failed to create question');
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [user, answerOptions, questionImages, selectedTagIds, validateAnswerOptions, createQuestion, onSave, onClose]);

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
    hasAttemptedSubmit,
    isInitializing,
    
    // Form data
    selectedTagIds,
    answerOptions,
    questionImages,
    
    // Setters
    setSelectedTagIds,
    setAnswerOptions,
    setQuestionImages,
    
    // Handlers
    handleSubmit,
    handleUnsavedChanges,
    validateAnswerOptions,
  };
}
