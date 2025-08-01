'use client';

import React from 'react';
import { QuestionWithDetails, QuestionOptionFormData } from '@/features/questions/types/questions';
import { CompactAnswerOptions } from '../compact-answer-options';

interface OptionsTabProps {
  question?: QuestionWithDetails;
  answerOptions: QuestionOptionFormData[];
  setAnswerOptions: (options: QuestionOptionFormData[]) => void;
  hasAttemptedSubmit: boolean;
  validateAnswerOptions: () => Record<string, string>;
  onUnsavedChanges: () => void;
  mode?: 'create' | 'edit';
}

export function OptionsTab({
  question,
  answerOptions,
  setAnswerOptions,
  hasAttemptedSubmit,
  validateAnswerOptions,
  onUnsavedChanges,
  mode = 'edit'
}: OptionsTabProps) {
  const handleOptionsChange = (newOptions: QuestionOptionFormData[]) => {
    setAnswerOptions(newOptions);
    onUnsavedChanges();
  };

  const validationErrors = hasAttemptedSubmit ? validateAnswerOptions() : {};

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium mb-4">Answer Options</h3>
        <CompactAnswerOptions
          options={answerOptions}
          onChange={handleOptionsChange}
        />
        {validationErrors.general && (
          <p className="text-sm text-red-600 mt-2">{validationErrors.general}</p>
        )}
      </div>
    </div>
  );
}
