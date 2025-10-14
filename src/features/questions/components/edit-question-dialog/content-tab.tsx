'use client';

import React, { useState } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Brain, Loader2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
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
  const [chatMessage, setChatMessage] = useState('');
  const [isRefining, setIsRefining] = useState(false);

  // Handle AI refinement
  const handleAIRefinement = async () => {
    if (!chatMessage.trim()) {
      toast.error('Please enter a refinement request');
      return;
    }

    setIsRefining(true);
    try {
      const currentFormData = form.getValues();
      
      const requestBody = {
        mode: 'refinement',
        instructions: chatMessage,
        currentQuestion: {
          title: currentFormData.title,
          stem: currentFormData.stem,
          answer_options: answerOptions,
          teaching_point: currentFormData.teaching_point,
          question_references: currentFormData.question_references
        },
        model: 'Llama-3.3-8B-Instruct' // Use fast model for refinements
      };

      console.log('Sending refinement request:', requestBody);

      const response = await fetch('/api/admin/ai-generate-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('API Error:', response.status, errorData);
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to refine question`);
      }

      const data = await response.json();
      console.log('Refinement response:', data);

      // Check if we got valid data back
      if (!data || (!data.stem && !data.title)) {
        throw new Error('Invalid response from AI service');
      }

      // Update form with refined content
      if (data.title) {
        form.setValue('title', data.title);
      }
      if (data.stem) {
        form.setValue('stem', data.stem);
      }
      if (data.teaching_point) {
        form.setValue('teaching_point', data.teaching_point);
      }
      if (data.question_references) {
        form.setValue('question_references', data.question_references);
      }
      
      // Update answer options if provided
      if (data.answer_options && Array.isArray(data.answer_options)) {
        const updatedOptions = data.answer_options.map((option: any, index: number) => ({
          text: option.text || '',
          is_correct: option.is_correct || false,
          explanation: option.explanation || '',
          order_index: index
        }));
        onAnswerOptionsChange(updatedOptions);
      }

      onUnsavedChanges();
      toast.success('Question refined successfully!');
      setChatMessage('');
    } catch (error) {
      console.error('AI refinement error:', error);
      toast.error(`Failed to refine question: ${error.message}`);
    } finally {
      setIsRefining(false);
    }
  };

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

      {/* AI Refinement */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Refine Question with AI
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Request Changes</Label>
            <Textarea
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              placeholder="Ask AI to modify specific parts of the question (e.g., 'Make the question more challenging', 'Add more clinical context', 'Improve the distractors')"
              rows={3}
            />
          </div>
          <Button 
            onClick={handleAIRefinement}
            disabled={!chatMessage.trim() || isRefining}
            className="w-full"
          >
            {isRefining ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Refining...
              </>
            ) : (
              <>
                <Brain className="mr-2 h-4 w-4" />
                Refine Question
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
