// src/components/questions/answer-options.tsx
'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { AnswerOptionFormData } from '@/types/questions';

interface AnswerOptionsProps {
  options: AnswerOptionFormData[];
  onChange: (options: AnswerOptionFormData[]) => void;
  errors?: Record<string, string>;
}

export function AnswerOptions({ options, onChange, errors }: AnswerOptionsProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const addOption = () => {
    const newOption: AnswerOptionFormData = {
      text: '',
      is_correct: false,
      explanation: '',
      order_index: options.length
    };
    onChange([...options, newOption]);
  };

  const removeOption = (index: number) => {
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
  };

  const updateOption = (index: number, field: keyof AnswerOptionFormData, value: any) => {
    const updatedOptions = options.map((option, i) => {
      if (i === index) {
        // If setting this option as correct, unset all others
        if (field === 'is_correct' && value === true) {
          return { ...option, [field]: value };
        }
        return { ...option, [field]: value };
      } else if (field === 'is_correct' && value === true) {
        // Unset other correct answers
        return { ...option, is_correct: false };
      }
      return option;
    });
    onChange(updatedOptions);
  };

  const setCorrectAnswer = (index: number) => {
    const updatedOptions = options.map((option, i) => ({
      ...option,
      is_correct: i === index
    }));
    onChange(updatedOptions);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    const updatedOptions = [...options];
    const draggedOption = updatedOptions[draggedIndex];
    
    // Remove dragged item
    updatedOptions.splice(draggedIndex, 1);
    // Insert at new position
    updatedOptions.splice(dropIndex, 0, draggedOption);
    
    // Update order indices
    const reorderedOptions = updatedOptions.map((option, i) => ({
      ...option,
      order_index: i
    }));
    
    onChange(reorderedOptions);
    setDraggedIndex(null);
  };

  const correctAnswerIndex = options.findIndex(opt => opt.is_correct);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Answer Options</label>
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

      <div className="space-y-3">
        <RadioGroup value={correctAnswerIndex.toString()} onValueChange={(value) => setCorrectAnswer(parseInt(value))}>
          {options.map((option, index) => (
            <div
              key={index}
              className={`border rounded-lg p-4 space-y-3 ${
                option.is_correct ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-border'
              }`}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
            >
              <div className="flex items-start gap-3">
                <div className="flex items-center gap-2 mt-1">
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                  <RadioGroupItem value={index.toString()} id={`option-${index}`} />
                  <Label htmlFor={`option-${index}`} className="sr-only">
                    Mark as correct answer
                  </Label>
                </div>
                
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={option.is_correct ? 'default' : 'secondary'}>
                      Option {String.fromCharCode(65 + index)}
                    </Badge>
                    {option.is_correct && (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        Correct Answer
                      </Badge>
                    )}
                  </div>
                  
                  <Input
                    placeholder={`Enter option ${String.fromCharCode(65 + index)} text...`}
                    value={option.text}
                    onChange={(e) => updateOption(index, 'text', e.target.value)}
                    className={errors?.[`option_${index}_text`] ? 'border-red-500' : ''}
                  />
                  {errors?.[`option_${index}_text`] && (
                    <p className="text-sm text-red-600">{errors[`option_${index}_text`]}</p>
                  )}
                  
                  <Textarea
                    placeholder={`Explanation for option ${String.fromCharCode(65 + index)} (optional for correct answer, required for incorrect answers)...`}
                    value={option.explanation || ''}
                    onChange={(e) => updateOption(index, 'explanation', e.target.value)}
                    className={`min-h-[80px] ${errors?.[`option_${index}_explanation`] ? 'border-red-500' : ''}`}
                  />
                  {errors?.[`option_${index}_explanation`] && (
                    <p className="text-sm text-red-600">{errors[`option_${index}_explanation`]}</p>
                  )}
                </div>
                
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeOption(index)}
                  disabled={options.length <= 2}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </RadioGroup>
      </div>

      <div className="text-xs text-muted-foreground space-y-1">
        <p>• Click the radio button to mark the correct answer</p>
        <p>• Drag options to reorder them</p>
        <p>• Explanations are required for incorrect answers</p>
        <p>• Minimum 2 options, maximum 6 options</p>
      </div>
    </div>
  );
}
