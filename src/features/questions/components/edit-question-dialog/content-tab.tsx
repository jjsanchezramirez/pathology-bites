'use client';

import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/ui/form";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";

import { QuestionWithDetails } from '@/features/questions/types/questions';
import { EditQuestionFormData } from '@/features/questions/hooks/use-edit-question-form';

interface QuestionOptionFormData {
  text: string;
  is_correct: boolean;
  explanation: string;
  order_index: number;
}

interface ContentTabProps {
  form: UseFormReturn<EditQuestionFormData>;
  question: QuestionWithDetails;
  onUnsavedChanges: () => void;
  answerOptions: QuestionOptionFormData[];
  onAnswerOptionsChange: (options: QuestionOptionFormData[]) => void;
}

export function ContentTab({
  form,
  question,
  onUnsavedChanges,
  answerOptions,
  onAnswerOptionsChange
}: ContentTabProps) {

  // Handle answer option changes
  const updateAnswerOption = (index: number, field: string, value: any) => {
    const updatedOptions = [...answerOptions];
    updatedOptions[index] = { ...updatedOptions[index], [field]: value };
    
    // If marking as correct, unmark others
    if (field === 'is_correct' && value === true) {
      updatedOptions.forEach((opt, i) => {
        if (i !== index) opt.is_correct = false;
      });
    }
    
    onAnswerOptionsChange(updatedOptions);
    onUnsavedChanges();
  };

  return (
    <div className="space-y-6">
      {/* Question Title */}
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Question Title</FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder="Brief descriptive title for the question"
                onChange={(e) => {
                  field.onChange(e);
                  onUnsavedChanges();
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Question Stem */}
      <FormField
        control={form.control}
        name="stem"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Question Stem</FormLabel>
            <FormControl>
              <Textarea
                {...field}
                placeholder="The main question text..."
                rows={6}
                onChange={(e) => {
                  field.onChange(e);
                  onUnsavedChanges();
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Answer Options */}
      <div className="space-y-3">
        <Label>Answer Options</Label>
        {answerOptions.map((option, index) => (
          <div key={index} className={`border rounded-lg p-3 space-y-2 ${option.is_correct ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'border-border'}`}>
            {/* Option Row */}
            <div className="flex items-center gap-3">
              <input
                type="radio"
                name="correct-answer"
                checked={option.is_correct}
                onChange={() => updateAnswerOption(index, 'is_correct', !option.is_correct)}
                className="h-4 w-4 text-green-600 focus:ring-green-500"
              />
              <Label className="text-sm font-medium min-w-[60px]">
                Option {String.fromCharCode(65 + index)}:
              </Label>
              <Input
                value={option.text}
                onChange={(e) => updateAnswerOption(index, 'text', e.target.value)}
                placeholder={`Answer choice ${String.fromCharCode(65 + index)}`}
                className="flex-1"
              />
            </div>
            
            {/* Explanation */}
            <div className="ml-7">
              <Label className="text-xs text-muted-foreground">Explanation:</Label>
              <Textarea
                value={option.explanation}
                onChange={(e) => updateAnswerOption(index, 'explanation', e.target.value)}
                placeholder="Explanation for this answer choice..."
                rows={2}
                className="mt-1"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Teaching Point */}
      <FormField
        control={form.control}
        name="teaching_point"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Teaching Point</FormLabel>
            <FormControl>
              <Textarea
                {...field}
                placeholder="Key learning objective or teaching point..."
                rows={3}
                onChange={(e) => {
                  field.onChange(e);
                  onUnsavedChanges();
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* References */}
      <FormField
        control={form.control}
        name="question_references"
        render={({ field }) => (
          <FormItem>
            <FormLabel>References</FormLabel>
            <FormControl>
              <Textarea
                {...field}
                placeholder="Citations and references..."
                rows={2}
                onChange={(e) => {
                  field.onChange(e);
                  onUnsavedChanges();
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />


    </div>
  );
}
