// src/components/questions/compact-answer-options.tsx
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Answer Options</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addOption}
          disabled={options.length >= 6} // Maximum 6 options
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Option
        </Button>
      </div>

      {errors?.options && (
        <p className="text-sm text-red-600">{errors.options}</p>
      )}

      <div className="space-y-2">
        <RadioGroup
          value={correctAnswerIndex >= 0 ? correctAnswerIndex.toString() : ""}
          onValueChange={(value) => setCorrectAnswer(parseInt(value))}
        >
          {options.map((option, index) => (
            <div
              key={index}
              className={`border rounded-md p-3 ${
                option.is_correct ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-border'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Reorder buttons */}
                <div className="flex flex-col gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => moveOption(index, 'up')}
                    disabled={index === 0}
                    className="h-6 w-6 p-0"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => moveOption(index, 'down')}
                    disabled={index === options.length - 1}
                    className="h-6 w-6 p-0"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                </div>

                <RadioGroupItem value={index.toString()} id={`option-${index}`} className="shrink-0" />
                <Label htmlFor={`option-${index}`} className="sr-only">
                  Mark as correct answer
                </Label>

                <Badge variant={option.is_correct ? 'default' : 'secondary'} className="text-xs shrink-0">
                  {String.fromCharCode(65 + index)}
                </Badge>
                {option.is_correct && (
                  <Badge variant="outline" className="text-green-600 border-green-600 text-xs shrink-0">
                    ✓
                  </Badge>
                )}

                <div className="flex-1">
                  <Input
                    placeholder={`Option ${String.fromCharCode(65 + index)} text...`}
                    value={option.text}
                    onChange={(e) => updateOption(index, 'text', e.target.value)}
                    className={`text-sm h-8 ${errors?.[`option_${index}_text`] ? 'border-red-500' : ''}`}
                  />
                  {errors?.[`option_${index}_text`] && (
                    <p className="text-xs text-red-600 mt-1">{errors[`option_${index}_text`]}</p>
                  )}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeOption(index)}
                  disabled={options.length <= 2}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Explanation field */}
              <div className="mt-3 ml-12">
                <Textarea
                  placeholder={`Explanation ${option.is_correct ? '(optional)' : '(required)'}...`}
                  value={option.explanation || ''}
                  onChange={(e) => updateOption(index, 'explanation', e.target.value)}
                  className="min-h-[60px] text-sm resize-none"
                />
                {errors?.[`option_${index}_explanation`] && (
                  <p className="text-xs text-red-600 mt-1">{errors[`option_${index}_explanation`]}</p>
                )}
              </div>
            </div>
          ))}
        </RadioGroup>
      </div>

      <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
        <p>• Click the radio button to mark the correct answer</p>
        <p>• Explanations are required for incorrect answers</p>
        <p>• Use the arrow buttons to reorder options</p>
      </div>
    </div>
  );
}
