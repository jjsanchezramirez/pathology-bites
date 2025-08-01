// src/features/questions/components/compact-answer-options.tsx
'use client';

import React, { useCallback, useState } from 'react';
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Badge } from "@/shared/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import { Label } from "@/shared/components/ui/label";
import { Plus, Trash2, GripVertical, ArrowUp, ArrowDown } from 'lucide-react';
import { AnswerOptionFormData } from '@/features/questions/types/questions';

interface CompactAnswerOptionsProps {
  options: AnswerOptionFormData[];
  onChange: (options: AnswerOptionFormData[]) => void;
  errors?: Record<string, string>;
}

export function CompactAnswerOptions({ options, onChange, errors }: CompactAnswerOptionsProps) {

  const addOption = useCallback(() => {
    const newOption: AnswerOptionFormData = {
      text: '',
      is_correct: false,
      explanation: '',
      order_index: options.length
    };
    onChange([...options, newOption]);
  }, [options, onChange]);

  const removeOption = useCallback((index: number) => {
    if (options.length <= 2) return; // Minimum 2 options

    const updatedOptions = options.filter((_, i) => i !== index);
    // Reorder indices
    const reorderedOptions = updatedOptions.map((option, i) => ({
      ...option,
      order_index: i
    }));

    // If we removed the correct answer, make the first option correct
    const hasCorrectAnswer = reorderedOptions.some(opt => opt.is_correct);
    if (!hasCorrectAnswer && reorderedOptions.length > 0) {
      reorderedOptions[0].is_correct = true;
    }

    onChange(reorderedOptions);
  }, [options, onChange]);

  const updateOption = useCallback((index: number, field: keyof AnswerOptionFormData, value: any) => {
    const updatedOptions = options.map((option, i) => {
      if (i === index) {
        return { ...option, [field]: value };
      }
      return option;
    });
    onChange(updatedOptions);
  }, [options, onChange]);

  const setCorrectAnswer = useCallback((index: number) => {
    const updatedOptions = options.map((option, i) => ({
      ...option,
      is_correct: i === index
    }));
    onChange(updatedOptions);
  }, [options, onChange]);

  const moveOption = useCallback((index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= options.length) return;

    const updatedOptions = [...options];
    const temp = updatedOptions[index];
    updatedOptions[index] = updatedOptions[newIndex];
    updatedOptions[newIndex] = temp;

    // Update order indices
    const reorderedOptions = updatedOptions.map((option, i) => ({
      ...option,
      order_index: i
    }));

    onChange(reorderedOptions);
  }, [options, onChange]);

  const correctAnswerIndex = options.findIndex(opt => opt.is_correct);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Question Options</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addOption}
          disabled={options.length >= 6}
          className="h-7 px-2 text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add
        </Button>
      </div>

      {errors?.options && (
        <p className="text-xs text-red-600">{errors.options}</p>
      )}

      <div className="space-y-1">
        {options.map((option, index) => (
          <div key={index} className="flex items-start gap-2">
            {/* Correct Answer Selector - Left Side */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setCorrectAnswer(index)}
              className={`h-8 w-8 p-0 shrink-0 mt-1 transition-colors ${
                option.is_correct
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <span className="text-xs font-bold">
                {option.is_correct ? '✓' : '○'}
              </span>
            </Button>

            {/* Option Container */}
            <div
              className={`flex-1 border rounded p-2 transition-colors ${
                option.is_correct
                  ? 'border-green-200 bg-green-50/50'
                  : 'border-border hover:border-muted-foreground/30'
              }`}
            >
              {/* Option Text Row */}
              <div className="flex items-center gap-1">
                {/* Letter Label */}
                <span className={`text-sm font-medium min-w-[20px] ${
                  option.is_correct ? 'text-green-700' : 'text-muted-foreground'
                }`}>
                  {String.fromCharCode(65 + index)}.
                </span>

                {/* Option Text */}
                <Input
                  placeholder={`Option ${String.fromCharCode(65 + index)}...`}
                  value={option.text}
                  onChange={(e) => updateOption(index, 'text', e.target.value)}
                  className={`border-0 bg-transparent p-0 h-auto text-sm focus-visible:ring-0 focus-visible:ring-offset-0 outline-none flex-1 ${
                    errors?.[`option_${index}_text`] ? 'text-red-600' : ''
                  }`}
                />
              </div>

              {errors?.[`option_${index}_text`] && (
                <p className="text-xs text-red-600 mt-1 ml-5">{errors[`option_${index}_text`]}</p>
              )}

              {/* Explanation Row */}
              <div className="flex items-start gap-1 mt-1">
                {/* Empty space to align with letter */}
                <span className="min-w-[20px] text-xs text-muted-foreground">

                </span>

                {/* Explanation */}
                <Textarea
                  placeholder="Explanation..."
                  value={option.explanation || ''}
                  onChange={(e) => updateOption(index, 'explanation', e.target.value)}
                  className="border-0 bg-transparent p-0 text-xs text-muted-foreground resize-none min-h-[32px] focus-visible:ring-0 focus-visible:ring-offset-0 outline-none flex-1"
                />
              </div>

              {errors?.[`option_${index}_explanation`] && (
                <p className="text-xs text-red-600 mt-1 ml-5">{errors[`option_${index}_explanation`]}</p>
              )}
            </div>

            {/* Delete Button - Right Side */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeOption(index)}
              disabled={options.length <= 2}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500 hover:bg-red-50 shrink-0 mt-1"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
