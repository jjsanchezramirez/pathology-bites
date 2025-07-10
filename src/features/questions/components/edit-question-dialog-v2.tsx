'use client';

import React from 'react';
import { useQuestions } from '@/features/questions/hooks/use-questions';
import { QuestionFormDialog, QuestionFormData } from './shared/question-form-dialog';
import { QuestionWithDetails, QuestionOptionFormData, QuestionImageFormData } from '@/features/questions/types/questions';

interface EditQuestionDialogProps {
  question: QuestionWithDetails;
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
  const { updateQuestion } = useQuestions();

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
      const updateData = {
        ...data,
        question_set_id: data.question_set_id === 'none' ? null : data.question_set_id,
        question_references: data.question_references || null,
      };

      await updateQuestion(question.id, updateData, {
        answerOptions: options.answerOptions,
        questionImages: options.questionImages,
        tagIds: options.tagIds,
        categoryId: options.categoryId,
      });

    } catch (error) {
      console.error('Error updating question:', error);
      throw error; // Re-throw to be handled by QuestionFormDialog
    }
  };

  return (
    <QuestionFormDialog
      open={open}
      onOpenChange={onOpenChange}
      onSave={onSave}
      mode="edit"
      question={question}
      onSubmit={handleSubmit}
    />
  );
}
