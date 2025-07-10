'use client';

import React from 'react';
import { toast } from 'sonner';
import { useQuestions } from '@/features/questions/hooks/use-questions';
import { QuestionFormDialog, QuestionFormData } from './shared/question-form-dialog';
import { QuestionOptionFormData, QuestionImageFormData } from '@/features/questions/types/questions';

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
  const { createQuestion } = useQuestions();

  const handleSubmit = async (
    data: QuestionFormData,
    options: {
      answerOptions: QuestionOptionFormData[];
      questionImages: QuestionImageFormData[];
      tagIds: string[];
      categoryId?: string;
    }
  ) => {
    try {
      // Validate answer options
      const validOptions = options.answerOptions.filter(opt => opt.text.trim() !== '');
      if (validOptions.length < 2) {
        throw new Error('At least 2 answer options are required');
      }

      const hasCorrectAnswer = validOptions.some(opt => opt.is_correct);
      if (!hasCorrectAnswer) {
        throw new Error('At least one correct answer is required');
      }

      // Create the question using the existing createQuestion function
      const questionData = {
        title: data.title,
        stem: data.stem,
        difficulty: data.difficulty,
        teaching_point: data.teaching_point,
        question_references: data.question_references || null,
        status: data.status,
        question_set_id: data.question_set_id === 'none' ? null : data.question_set_id,
        category_id: options.categoryId || null,
        created_by: '', // Will be set by the API
        updated_by: '', // Will be set by the API
      };

      await createQuestion(questionData);
      
      // Note: The current createQuestion function doesn't handle answer options, images, or tags
      // This would need to be enhanced to support the full question creation workflow
      // For now, we'll create the basic question and show a warning about additional data
      
      if (validOptions.length > 0 || options.questionImages.length > 0 || options.tagIds.length > 0) {
        toast.warning('Question created, but answer options, images, and tags need to be added separately');
      }

    } catch (error) {
      console.error('Error creating question:', error);
      throw error; // Re-throw to be handled by QuestionFormDialog
    }
  };

  return (
    <QuestionFormDialog
      open={open}
      onOpenChange={onOpenChange}
      onSave={onSave}
      mode="create"
      onSubmit={handleSubmit}
    />
  );
}
