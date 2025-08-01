// src/features/questions/hooks/use-import-question-form.ts
'use client';

import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { useQuestions } from './use-questions';
import { useAuthStatus } from '@/features/auth/hooks/use-auth-status';

// JSON schema for question import
const answerOptionSchema = z.object({
  text: z.string().min(1, 'Answer option text is required'),
  is_correct: z.boolean(),
  explanation: z.string().optional(),
  order_index: z.number().int().min(0),
});

const questionImageSchema = z.object({
  image_id: z.string().uuid('Invalid image ID format'),
  question_section: z.enum(['stem', 'explanation']),
  order_index: z.number().int().min(0),
});

const importQuestionSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  stem: z.string().min(10, 'Question stem must be at least 10 characters').max(2000, 'Question stem too long'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  teaching_point: z.string().min(10, 'Teaching point must be at least 10 characters').max(1000, 'Teaching point too long'),
  question_references: z.string().max(500, 'References too long').optional(),
  status: z.enum(['draft', 'published']).default('draft'),
  question_set_id: z.string().uuid('Invalid question set ID').optional().nullable(),
  answer_options: z.array(answerOptionSchema).min(2, 'At least 2 answer options required').max(10, 'Maximum 10 answer options allowed'),
  question_images: z.array(questionImageSchema).optional().default([]),
  tag_ids: z.array(z.string().uuid('Invalid tag ID')).optional().default([]),
  category_ids: z.array(z.string().uuid('Invalid category ID')).optional().default([]),
});

const formSchema = z.object({
  jsonInput: z.string().min(1, 'JSON input is required'),
});

export type ImportQuestionFormData = z.infer<typeof formSchema>;
export type ImportQuestionData = z.infer<typeof importQuestionSchema>;

interface UseImportQuestionFormProps {
  open: boolean;
  onSave: () => void;
  onClose: () => void;
}

export function useImportQuestionForm({ open, onSave, onClose }: UseImportQuestionFormProps) {
  // State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ImportQuestionData | null>(null);
  const [showExamples, setShowExamples] = useState(false);

  // Hooks
  const { createQuestion } = useQuestions();
  const { user } = useAuthStatus();

  // Form
  const form = useForm<ImportQuestionFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      jsonInput: '',
    },
  });

  // Reset form when dialog opens/closes
  const resetForm = useCallback(() => {
    form.reset({ jsonInput: '' });
    setValidationError(null);
    setParsedData(null);
    setShowExamples(false);
  }, [form]);

  // Validate JSON input
  const validateJson = useCallback((jsonString: string): ImportQuestionData | null => {
    try {
      const parsed = JSON.parse(jsonString);
      const validated = importQuestionSchema.parse(parsed);
      setValidationError(null);
      return validated;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join('; ');
        setValidationError(`Validation error: ${errorMessages}`);
      } else if (error instanceof SyntaxError) {
        setValidationError(`Invalid JSON format: ${error.message}`);
      } else {
        setValidationError('Unknown error occurred while parsing JSON');
      }
      return null;
    }
  }, []);

  // Handle JSON input change
  const handleJsonChange = useCallback((value: string) => {
    if (value.trim()) {
      const validated = validateJson(value);
      setParsedData(validated);
    } else {
      setValidationError(null);
      setParsedData(null);
    }
  }, [validateJson]);

  // Additional validation for parsed data
  const validateParsedData = useCallback((data: ImportQuestionData): string[] => {
    const validationErrors = [];

    // Check if at least one answer option is correct
    const hasCorrectAnswer = data.answer_options.some(option => option.is_correct);
    if (!hasCorrectAnswer) {
      validationErrors.push('At least one answer option must be marked as correct (is_correct: true)');
    }

    // Check for duplicate order indices in answer options
    const orderIndices = data.answer_options.map(option => option.order_index);
    const uniqueIndices = new Set(orderIndices);
    if (orderIndices.length !== uniqueIndices.size) {
      validationErrors.push('Answer options must have unique order_index values');
    }

    // Check for duplicate order indices in question images
    if (data.question_images && data.question_images.length > 0) {
      const imageOrderIndices = data.question_images.map(img => img.order_index);
      const uniqueImageIndices = new Set(imageOrderIndices);
      if (imageOrderIndices.length !== uniqueImageIndices.size) {
        validationErrors.push('Question images must have unique order_index values');
      }
    }

    return validationErrors;
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(async (data: ImportQuestionFormData) => {
    if (!user) {
      toast.error('You must be logged in to import questions');
      return;
    }

    if (!parsedData) {
      toast.error('Please provide valid JSON data');
      return;
    }

    // Additional validation
    const validationErrors = validateParsedData(parsedData);
    if (validationErrors.length > 0) {
      toast.error(`Validation errors: ${validationErrors.join('; ')}`);
      return;
    }

    setIsSubmitting(true);
    try {
      // Create the question (only core question fields)
      const questionData = {
        title: parsedData.title,
        stem: parsedData.stem,
        difficulty: parsedData.difficulty,
        teaching_point: parsedData.teaching_point,
        question_references: parsedData.question_references || null,
        status: parsedData.status,
        created_by: user.id,
        updated_by: user.id,
        question_set_id: parsedData.question_set_id || null,
      };

      const newQuestion = await createQuestion(questionData);

      // Create all related records in parallel
      const promises = [];
      const promiseLabels = [];

      // 1. Create answer options
      if (parsedData.answer_options.length > 0) {
        const answerOptionsData = parsedData.answer_options.map(option => ({
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
        promiseLabels.push('answer options');
      }

      // 2. Create question images
      if (parsedData.question_images && parsedData.question_images.length > 0) {
        const questionImagesData = parsedData.question_images.map(img => ({
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
        promiseLabels.push('question images');
      }

      // 3. Create question tags
      if (parsedData.tag_ids && parsedData.tag_ids.length > 0) {
        const questionTagsData = parsedData.tag_ids.map(tagId => ({
          question_id: newQuestion.id,
          tag_id: tagId,
        }));

        promises.push(
          fetch('/api/questions/tags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questionTags: questionTagsData }),
          })
        );
        promiseLabels.push('question tags');
      }

      // Wait for all related records to be created
      const results = await Promise.allSettled(promises);
      
      // Check for any failures
      const failures = results.filter(result => result.status === 'rejected');
      if (failures.length > 0) {
        console.warn('Some related records failed to create:', failures);
        toast.warning('Question imported, but some related data may not have been saved');
      }

      toast.success('Question imported successfully');
      resetForm();
      onSave();
      onClose();
    } catch (error) {
      console.error('Error importing question:', error);
      toast.error('Failed to import question');
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [user, parsedData, validateParsedData, createQuestion, resetForm, onSave, onClose]);

  // Example JSON templates
  const SIMPLE_JSON = `{
  "title": "Sample Question Title",
  "stem": "This is the question stem. What is the correct answer?",
  "difficulty": "medium",
  "teaching_point": "This is the teaching point that explains the concept.",
  "answer_options": [
    {
      "text": "Option A - Incorrect answer",
      "is_correct": false,
      "explanation": "This is why this option is incorrect",
      "order_index": 0
    },
    {
      "text": "Option B - Correct answer",
      "is_correct": true,
      "explanation": "This is why this option is correct",
      "order_index": 1
    }
  ]
}`;

  const FULL_JSON = `{
  "title": "Advanced Question with All Fields",
  "stem": "This is a more complex question stem. What is the correct answer?",
  "difficulty": "hard",
  "teaching_point": "This teaching point explains the advanced concept.",
  "question_references": "Reference: Medical Textbook, Chapter 5",
  "status": "draft",
  "question_set_id": null,
  "answer_options": [
    {
      "text": "Option A - Incorrect",
      "is_correct": false,
      "explanation": "Explanation for option A",
      "order_index": 0
    },
    {
      "text": "Option B - Correct",
      "is_correct": true,
      "explanation": "Explanation for option B",
      "order_index": 1
    },
    {
      "text": "Option C - Incorrect",
      "is_correct": false,
      "explanation": "Explanation for option C",
      "order_index": 2
    }
  ],
  "question_images": [],
  "tag_ids": [],
  "category_ids": []
}`;

  return {
    // Form
    form,

    // State
    isSubmitting,
    validationError,
    parsedData,
    showExamples,

    // Setters
    setShowExamples,

    // Handlers
    handleSubmit,
    handleJsonChange,
    resetForm,
    validateJson,
    validateParsedData,

    // Examples
    SIMPLE_JSON,
    FULL_JSON,

    // Schemas (for reuse)
    importQuestionSchema,
    answerOptionSchema,
    questionImageSchema,
  };
}
