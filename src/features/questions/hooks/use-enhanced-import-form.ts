// src/features/questions/hooks/use-enhanced-import-form.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { useQuestions } from './use-questions';
import { useAuthStatus } from '@/features/auth/hooks/use-auth-status';

// Enhanced schema that supports external image URLs
const questionOptionSchema = z.object({
  text: z.string().min(1, 'Question option text is required'),
  is_correct: z.boolean(),
  explanation: z.string().optional(),
  order_index: z.number().int().min(0),
});

const questionImageSchema = z.object({
  image_url: z.string().url('Invalid image URL').optional(),
  image_id: z.string().uuid('Invalid image ID format').optional(),
  question_section: z.enum(['stem', 'explanation']),
  order_index: z.number().int().min(0),
  alt_text: z.string().optional(),
  caption: z.string().optional(),
});

const importQuestionSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  stem: z.string().min(10, 'Question stem must be at least 10 characters').max(2000, 'Question stem too long'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  teaching_point: z.string().min(10, 'Teaching point must be at least 10 characters').max(1000, 'Teaching point too long'),
  question_references: z.string().max(500, 'References too long').optional(),
  status: z.enum(['draft', 'published']).default('draft'),
  question_set_id: z.string().uuid('Invalid question set ID').optional().nullable(),
  answer_options: z.array(questionOptionSchema).min(2, 'At least 2 answer options required').max(10, 'Maximum 10 answer options allowed'),
  question_images: z.array(questionImageSchema).optional().default([]),
  tag_ids: z.array(z.string().uuid('Invalid tag ID')).optional().default([]),
  category_ids: z.array(z.string().uuid('Invalid category ID')).optional().default([]),
});

const formSchema = z.object({
  selectedCategory: z.string().optional(),
  selectedQuestionSet: z.string().min(1, 'Please select a question set'),
  jsonFile: z.any().optional(),
});

export type EnhancedImportFormData = z.infer<typeof formSchema>;
export type EnhancedImportQuestionData = z.infer<typeof importQuestionSchema>;

interface Category {
  id: string;
  name: string;
  level: number;
  parent_id: string | null;
}

interface QuestionSet {
  id: string;
  name: string;
  description: string | null;
}

interface UseEnhancedImportFormProps {
  open: boolean;
  onSave: () => void;
  onClose: () => void;
}

export function useEnhancedImportForm({ open, onSave, onClose }: UseEnhancedImportFormProps) {
  // State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedQuestions, setParsedQuestions] = useState<EnhancedImportQuestionData[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // Hooks
  const { createQuestion } = useQuestions();
  const { user } = useAuthStatus();

  // Form
  const form = useForm<EnhancedImportFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      selectedCategory: '',
      selectedQuestionSet: '',
      jsonFile: undefined,
    },
  });

  // Load categories and question sets
  useEffect(() => {
    if (open) {
      loadCategories();
      loadQuestionSets();
    }
  }, [open]);

  const loadCategories = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (error) {
      // Failed to load categories - will use empty array
    }
  }, []);

  const loadQuestionSets = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/question-sets');
      if (response.ok) {
        const data = await response.json();
        setQuestionSets(data);
      }
    } catch (error) {
      // Failed to load question sets - will use empty array
    }
  }, []);

  // Reset form when dialog opens/closes
  const resetForm = useCallback(() => {
    form.reset({
      selectedCategory: '',
      selectedQuestionSet: '',
      jsonFile: undefined,
    });
    setSelectedFile(null);
    setParsedQuestions([]);
    setValidationErrors([]);
    setImportProgress(0);
    setIsProcessing(false);
  }, [form]);

  // Handle file selection
  const handleFileSelection = useCallback(async (file: File) => {
    setSelectedFile(file);
    setIsProcessing(true);
    setValidationErrors([]);
    setParsedQuestions([]);

    try {
      const text = await file.text();
      let jsonData;

      try {
        jsonData = JSON.parse(text);
      } catch (error) {
        setValidationErrors(['Invalid JSON format']);
        return;
      }

      // Handle both single question and array of questions
      const questionsArray = Array.isArray(jsonData) ? jsonData : [jsonData];
      const validQuestions: EnhancedImportQuestionData[] = [];
      const errors: string[] = [];

      questionsArray.forEach((questionData, index) => {
        try {
          const validated = importQuestionSchema.parse(questionData);
          validQuestions.push(validated);
        } catch (error) {
          if (error instanceof z.ZodError) {
            const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
            errors.push(`Question ${index + 1}: ${errorMessages.join(', ')}`);
          } else {
            errors.push(`Question ${index + 1}: Unknown validation error`);
          }
        }
      });

      setParsedQuestions(validQuestions);
      setValidationErrors(errors);
    } catch (error) {
      setValidationErrors(['Error reading file']);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(async (data: EnhancedImportFormData) => {
    if (!user) {
      toast.error('You must be logged in to import questions');
      return;
    }

    if (parsedQuestions.length === 0) {
      toast.error('No valid questions to import');
      return;
    }

    setIsSubmitting(true);
    setImportProgress(0);

    try {
      const totalQuestions = parsedQuestions.length;
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < parsedQuestions.length; i++) {
        const questionData = parsedQuestions[i];
        
        try {
          // Create the question
          const newQuestionData = {
            title: questionData.title,
            stem: questionData.stem,
            difficulty: questionData.difficulty,
            teaching_point: questionData.teaching_point,
            question_references: questionData.question_references || null,
            status: questionData.status,
            created_by: user.id,
            updated_by: user.id,
            question_set_id: data.selectedQuestionSet || null,
            category_id: data.selectedCategory || null,
          };

          const newQuestion = await createQuestion(newQuestionData);

          // Create related records in parallel
          const promises = [];

          // Answer options
          if (questionData.answer_options.length > 0) {
            const answerOptionsData = questionData.answer_options.map(option => ({
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
          }

          // Question images (if any)
          if (questionData.question_images && questionData.question_images.length > 0) {
            const questionImagesData = questionData.question_images
              .filter(img => img.image_id) // Only process images with valid IDs
              .map(img => ({
                question_id: newQuestion.id,
                image_id: img.image_id!,
                question_section: img.question_section,
                order_index: img.order_index,
              }));

            if (questionImagesData.length > 0) {
              promises.push(
                fetch('/api/questions/images', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ questionImages: questionImagesData }),
                })
              );
            }
          }

          // Question tags
          if (questionData.tag_ids && questionData.tag_ids.length > 0) {
            const questionTagsData = questionData.tag_ids.map(tagId => ({
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
          }

          // Wait for all related records
          await Promise.allSettled(promises);
          successCount++;
        } catch (error) {
          errorCount++;
        }

        // Update progress
        setImportProgress(((i + 1) / totalQuestions) * 100);
      }

      // Show results
      if (successCount > 0) {
        toast.success(`Successfully imported ${successCount} question(s)`);
      }
      if (errorCount > 0) {
        toast.error(`Failed to import ${errorCount} question(s)`);
      }

      if (successCount > 0) {
        resetForm();
        onSave();
        onClose();
      }
    } catch (error) {
      toast.error('Failed to import questions');
    } finally {
      setIsSubmitting(false);
      setImportProgress(0);
    }
  }, [user, parsedQuestions, createQuestion, resetForm, onSave, onClose]);

  return {
    // Form
    form,
    
    // State
    isSubmitting,
    isProcessing,
    categories,
    questionSets,
    selectedFile,
    parsedQuestions,
    validationErrors,
    importProgress,
    
    // Handlers
    handleSubmit,
    handleFileSelection,
    resetForm,
    
    // Schemas (for reuse)
    importQuestionSchema,
    questionOptionSchema,
    questionImageSchema,
  };
}
