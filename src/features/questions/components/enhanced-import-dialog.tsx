'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import { Button } from '@/shared/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Badge } from '@/shared/components/ui/badge';
import { Progress } from '@/shared/components/ui/progress';
import { 
  Loader2, 
  FileText, 
  AlertCircle, 
  Upload, 
  FolderTree, 
  CheckCircle2,
  X,
  Download
} from 'lucide-react';
import { useQuestions } from '@/features/questions/hooks/use-questions';
import { useAuthStatus } from '@/features/auth/hooks/use-auth-status';

// Enhanced schema that supports external image URLs
const questionOptionSchema = z.object({
  text: z.string().min(1, 'Question option text is required'),
  is_correct: z.boolean(),
  explanation: z.string().optional(),
  order_index: z.number().int().min(0),
});

// Legacy alias for backward compatibility
const answerOptionSchema = questionOptionSchema;

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
  answer_options: z.array(answerOptionSchema).min(2, 'At least 2 answer options required').max(10, 'Maximum 10 answer options allowed'),
  question_images: z.array(questionImageSchema).optional().default([]),
  tag_ids: z.array(z.string().uuid('Invalid tag ID')).optional().default([]),
  category_ids: z.array(z.string().uuid('Invalid category ID')).optional().default([]),
});

const formSchema = z.object({
  selectedCategory: z.string().optional(),
  selectedQuestionSet: z.string().min(1, 'Please select a question set'),
  jsonFile: z.any().optional(),
});

type FormData = z.infer<typeof formSchema>;
type ImportQuestionData = z.infer<typeof importQuestionSchema>;

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

interface EnhancedImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

interface ImportProgress {
  total: number;
  completed: number;
  current: string;
  errors: string[];
}

export function EnhancedImportDialog({ open, onOpenChange, onSave }: EnhancedImportDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingQuestionSets, setLoadingQuestionSets] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedQuestions, setParsedQuestions] = useState<ImportQuestionData[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const { createQuestion } = useQuestions();
  const { user } = useAuthStatus();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      selectedCategory: 'none',
      selectedQuestionSet: '',
    },
  });

  // Load categories and question sets on mount
  useEffect(() => {
    if (open) {
      loadCategories();
      loadQuestionSets();
    }
  }, [open]);

  const loadCategories = async () => {
    setLoadingCategories(true);
    try {
      const response = await fetch('/api/admin/categories?page=0&pageSize=1000', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to load categories');

      const data = await response.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Error loading categories:', error);
      toast.error('Failed to load categories');
    } finally {
      setLoadingCategories(false);
    }
  };

  const loadQuestionSets = async () => {
    setLoadingQuestionSets(true);
    try {
      const response = await fetch('/api/admin/question-sets?page=0&pageSize=1000');
      if (!response.ok) throw new Error('Failed to load question sets');

      const data = await response.json();
      setQuestionSets(data.questionSets || []);
    } catch (error) {
      console.error('Error loading question sets:', error);
      toast.error('Failed to load question sets');
    } finally {
      setLoadingQuestionSets(false);
    }
  };

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelection(file);
    }
  }, []);

  const handleFileSelection = useCallback((file: File) => {
    if (!file.name.endsWith('.json')) {
      toast.error('Please select a JSON file');
      return;
    }

    setSelectedFile(file);
    setValidationError(null);

    // Read and parse the file
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const jsonData = JSON.parse(content);
        
        // Validate if it's an array of questions
        if (!Array.isArray(jsonData)) {
          throw new Error('JSON file must contain an array of questions');
        }

        // Validate each question
        const validatedQuestions: ImportQuestionData[] = [];
        const errors: string[] = [];

        jsonData.forEach((questionData, index) => {
          try {
            const validated = importQuestionSchema.parse(questionData);
            validatedQuestions.push(validated);
          } catch (error) {
            if (error instanceof z.ZodError) {
              errors.push(`Question ${index + 1}: ${error.errors.map(e => e.message).join(', ')}`);
            } else {
              errors.push(`Question ${index + 1}: Invalid format`);
            }
          }
        });

        if (errors.length > 0) {
          setValidationError(`Validation errors:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n... and ${errors.length - 5} more errors` : ''}`);
          setParsedQuestions([]);
        } else {
          setParsedQuestions(validatedQuestions);
          toast.success(`Successfully parsed ${validatedQuestions.length} questions`);
        }
      } catch (error) {
        setValidationError('Invalid JSON file format');
        setParsedQuestions([]);
      }
    };

    reader.readAsText(file);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    const jsonFile = files.find(file => file.name.endsWith('.json'));
    
    if (jsonFile) {
      handleFileSelection(jsonFile);
    } else {
      toast.error('Please drop a JSON file');
    }
  }, [handleFileSelection]);

  const formatCategoryName = (category: Category) => {
    const indent = '  '.repeat(category.level - 1);
    return `${indent}${category.name}`;
  };

  const onSubmit = async (data: FormData) => {
    if (!user) {
      toast.error('You must be logged in to import questions');
      return;
    }

    if (parsedQuestions.length === 0) {
      toast.error('Please select a valid JSON file with questions');
      return;
    }

    setIsSubmitting(true);
    setImportProgress({
      total: parsedQuestions.length,
      completed: 0,
      current: '',
      errors: []
    });

    try {
      const selectedCategoryId = data.selectedCategory === 'none' ? null : data.selectedCategory;
      const selectedQuestionSetId = data.selectedQuestionSet;

      for (let i = 0; i < parsedQuestions.length; i++) {
        const questionData = parsedQuestions[i];

        setImportProgress(prev => prev ? {
          ...prev,
          current: questionData.title,
          completed: i
        } : null);

        try {
          // Create the core question data
          const coreQuestionData = {
            title: questionData.title,
            stem: questionData.stem,
            difficulty: questionData.difficulty,
            teaching_point: questionData.teaching_point,
            question_references: questionData.question_references || null,
            status: questionData.status,
            created_by: user.id,
            updated_by: user.id,
            question_set_id: selectedQuestionSetId || questionData.question_set_id || null,
          };

          // Create the question first
          const newQuestion = await createQuestion(coreQuestionData);

          // Create all related records in parallel
          const promises: Promise<Response>[] = [];
          const promiseLabels: string[] = [];

          // 1. Create answer options
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
            promiseLabels.push('Answer Options');
          }

          // 2. Create question categories (JSON category takes precedence over selected category)
          const categoriesToUse = questionData.category_ids && questionData.category_ids.length > 0
            ? questionData.category_ids
            : (selectedCategoryId ? [selectedCategoryId] : []);

          if (categoriesToUse.length > 0) {
            const categoryData = categoriesToUse.map(categoryId => ({
              question_id: newQuestion.id,
              category_id: categoryId,
            }));

            promises.push(
              fetch('/api/question-categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ questionCategories: categoryData }),
              })
            );
            promiseLabels.push('Categories');
          }

          // 3. Handle images (if any) - for now we'll skip external image download
          // TODO: Implement image download and upload functionality
          if (questionData.question_images && questionData.question_images.length > 0) {
            console.log(`Skipping ${questionData.question_images.length} images for question: ${questionData.title}`);
            // This will be implemented in the next phase
          }

          // 4. Create tags (if any)
          if (questionData.tag_ids && questionData.tag_ids.length > 0) {
            const tagData = questionData.tag_ids.map(tagId => ({
              question_id: newQuestion.id,
              tag_id: tagId,
            }));

            promises.push(
              fetch('/api/questions/tags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ questionTags: tagData }),
              })
            );
            promiseLabels.push('Tags');
          }

          // Execute all promises
          const results = await Promise.allSettled(promises);

          // Check for any failures in related data creation
          results.forEach((result, index) => {
            if (result.status === 'rejected') {
              console.warn(`Failed to create ${promiseLabels[index]} for question ${newQuestion.id}:`, result.reason);
            }
          });

        } catch (error) {
          console.error(`Error importing question ${i + 1}:`, error);
          setImportProgress(prev => prev ? {
            ...prev,
            errors: [...prev.errors, `Question ${i + 1} (${questionData.title}): ${error instanceof Error ? error.message : 'Unknown error'}`]
          } : null);
        }
      }

      setImportProgress(prev => prev ? {
        ...prev,
        completed: parsedQuestions.length,
        current: 'Complete'
      } : null);

      const successCount = parsedQuestions.length - (importProgress?.errors.length || 0);
      toast.success(`Successfully imported ${successCount} of ${parsedQuestions.length} questions`);
      
      if (importProgress?.errors.length === 0) {
        onSave();
        onOpenChange(false);
      }
      
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to import questions');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setSelectedFile(null);
      setParsedQuestions([]);
      setValidationError(null);
      setImportProgress(null);
      form.reset({
        selectedCategory: 'none',
        selectedQuestionSet: '',
      });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogPortal>
        <DialogOverlay className="backdrop-blur-md bg-black/20" />
        <DialogContent className="w-full max-w-[min(90vw,600px)] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Questions from JSON
          </DialogTitle>
          <DialogDescription>
            Upload a JSON file containing questions and select a category to organize them.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Category Selection */}
            <FormField
              control={form.control}
              name="selectedCategory"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <FolderTree className="h-4 w-4" />
                    Category (Optional)
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={loadingCategories}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={loadingCategories ? "Loading categories..." : "Select a category (optional)"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No category</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {formatCategoryName(category)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Question Set Selection */}
            <FormField
              control={form.control}
              name="selectedQuestionSet"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Question Set *
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={loadingQuestionSets}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={loadingQuestionSets ? "Loading question sets..." : "Select a question set"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {questionSets.map((questionSet) => (
                        <SelectItem key={questionSet.id} value={questionSet.id}>
                          {questionSet.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* File Upload Area */}
            <div className="space-y-4">
              <label className="text-sm font-medium">JSON File</label>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
                  relative flex flex-col items-center justify-center w-full h-32
                  border-2 border-dashed rounded-lg cursor-pointer
                  transition-colors duration-200
                  ${isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:bg-muted/50'
                  }
                `}
              >
                <input
                  type="file"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  accept=".json"
                  onChange={handleFileChange}
                  disabled={isSubmitting}
                />
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  {isSubmitting ? (
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <FileText className="h-8 w-8 mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        {isDragging
                          ? 'Drop JSON file here'
                          : 'Drag & drop JSON file or click to select'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        JSON files containing question arrays
                      </p>
                    </>
                  )}
                </div>
              </div>

              {selectedFile && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{selectedFile.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{parsedQuestions.length} questions</Badge>
                    {!isSubmitting && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedFile(null);
                          setParsedQuestions([]);
                          setValidationError(null);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {validationError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="whitespace-pre-line">
                  {validationError}
                </AlertDescription>
              </Alert>
            )}

            {/* Import Progress */}
            {importProgress && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span>Importing questions...</span>
                  <span>{importProgress.completed} / {importProgress.total}</span>
                </div>
                <Progress 
                  value={(importProgress.completed / importProgress.total) * 100} 
                  className="w-full"
                />
                {importProgress.current && (
                  <p className="text-sm text-muted-foreground">
                    Current: {importProgress.current}
                  </p>
                )}
                {importProgress.errors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {importProgress.errors.length} error(s) occurred during import
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || parsedQuestions.length === 0 || !form.watch('selectedQuestionSet')}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Import {parsedQuestions.length} Questions
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
