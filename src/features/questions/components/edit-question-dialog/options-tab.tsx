'use client';

import React, { useState, useEffect } from 'react';
import { QuestionWithDetails, AnswerOptionFormData } from '@/features/questions/types/questions';
import { CompactAnswerOptions } from '../compact-answer-options';

interface OptionsTabProps {
  question?: QuestionWithDetails;
  onUnsavedChanges: () => void;
  answerOptions: AnswerOptionFormData[];
  onAnswerOptionsChange: (options: AnswerOptionFormData[]) => void;
  mode?: 'create' | 'edit';
}

export function OptionsTab({ question, onUnsavedChanges, answerOptions, onAnswerOptionsChange, mode = 'edit' }: OptionsTabProps) {
  const handleOptionsChange = (newOptions: AnswerOptionFormData[]) => {
    onAnswerOptionsChange(newOptions);
    onUnsavedChanges();
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium mb-4">Answer Options</h3>
        <CompactAnswerOptions
          options={answerOptions}
          onChange={handleOptionsChange}
        />
      </div>
    </div>
  );
}
