'use client';

import React, { useState } from 'react';
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
import { Textarea } from '@/shared/components/ui/textarea';
import { Loader2, FileText, AlertCircle, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { useQuestions } from '@/features/questions/hooks/use-questions';
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
  status: z.enum(['draft', 'approved']).default('draft'),
  question_set_id: z.string().uuid('Invalid question set ID').optional().nullable(),
  question_options: z.array(answerOptionSchema).min(2, 'At least 2 question options required').max(10, 'Maximum 10 question options allowed'),
  question_images: z.array(questionImageSchema).optional().default([]),
  tag_ids: z.array(z.string().uuid('Invalid tag ID')).optional().default([]),
  category_ids: z.array(z.string().uuid('Invalid category ID')).optional().default([]),
});

const formSchema = z.object({
  jsonInput: z.string().min(1, 'JSON input is required'),
});

type FormData = z.infer<typeof formSchema>;
type ImportQuestionData = z.infer<typeof importQuestionSchema>;

interface ImportQuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

const SIMPLE_JSON = `{
  "title": "Sample Question Title",
  "stem": "This is the question stem. What is the correct answer?",
  "difficulty": "medium",
  "teaching_point": "This is the teaching point that explains the concept.",
  "question_options": [
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
  "question_set_id": "12345678-1234-1234-1234-123456789abc",
  "question_options": [
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
  ],
  "question_images": [
    {
      "image_id": "87654321-4321-4321-4321-210987654321",
      "question_section": "stem",
      "order_index": 0
    }
  ],
  "tag_ids": [
    "11111111-1111-1111-1111-111111111111",
    "22222222-2222-2222-2222-222222222222"
  ],
  "category_ids": [
    "33333333-3333-3333-3333-333333333333"
  ]
}`;

export function ImportQuestionDialog({ open, onOpenChange, onSave }: ImportQuestionDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ImportQuestionData | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showAdvancedExample, setShowAdvancedExample] = useState(false);

  const { createQuestion } = useQuestions();
  const { user } = useAuthStatus();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      jsonInput: '',
    },
  });

  const validateJson = (jsonString: string): ImportQuestionData | null => {
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
  };

  const handleJsonChange = (value: string) => {
    if (value.trim()) {
      const validated = validateJson(value);
      setParsedData(validated);
    } else {
      setValidationError(null);
      setParsedData(null);
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!user) {
      toast.error('You must be logged in to import questions');
      return;
    }

    if (!parsedData) {
      toast.error('Please provide valid JSON data');
      return;
    }

    // Additional validation
    const validationErrors = [];

    // Check if at least one question option is correct
    const hasCorrectAnswer = parsedData.question_options.some(option => option.is_correct);
    if (!hasCorrectAnswer) {
      validationErrors.push('At least one question option must be marked as correct (is_correct: true)');
    }

    // Check for duplicate order indices in question options
    const orderIndices = parsedData.question_options.map(option => option.order_index);
    const uniqueIndices = new Set(orderIndices);
    if (orderIndices.length !== uniqueIndices.size) {
      validationErrors.push('Question options must have unique order_index values');
    }

    // Check for duplicate order indices in question images
    if (parsedData.question_images && parsedData.question_images.length > 0) {
      const imageOrderIndices = parsedData.question_images.map(img => img.order_index);
      const uniqueImageIndices = new Set(imageOrderIndices);
      if (imageOrderIndices.length !== uniqueImageIndices.size) {
        validationErrors.push('Question images must have unique order_index values');
      }
    }

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

      // 1. Create question options
      if (parsedData.question_options.length > 0) {
        const answerOptionsData = parsedData.question_options.map(option => ({
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

      // 2. Create question images
      if (parsedData.question_images && parsedData.question_images.length > 0) {
        const questionImagesData = parsedData.question_images.map(img => ({
          question_id: newQuestion.id,
          image_id: img.image_id,
          question_section: img.question_section,
          order_index: img.order_index,
        }));

        promises.push(
          fetch('/api/question-images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questionImages: questionImagesData }),
          })
        );
        promiseLabels.push('Question Images');
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
        promiseLabels.push('Question Tags');
      }

      // 4. Create question categories
      if (parsedData.category_ids && parsedData.category_ids.length > 0) {
        const questionCategoriesData = parsedData.category_ids.map(categoryId => ({
          question_id: newQuestion.id,
          category_id: categoryId,
        }));

        promises.push(
          fetch('/api/question-categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questionCategories: questionCategoriesData }),
          })
        );
        promiseLabels.push('Question Categories');
      }

      // Execute all promises
      const results = await Promise.allSettled(promises);
      
      // Check for errors
      const errors: string[] = [];
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const apiName = promiseLabels[i] || `API ${i + 1}`;

        if (result.status === 'rejected') {
          errors.push(`${apiName}: ${result.reason?.message || 'Network error'}`);
        } else if (!result.value.ok) {
          try {
            const errorData = await result.value.json();
            errors.push(`${apiName}: ${errorData.error || 'Unknown error'}`);
          } catch {
            errors.push(`${apiName}: Failed to parse error response`);
          }
        }
      }

      if (errors.length > 0) {
        console.error('Some related records failed to create:', errors);
        toast.warning(`Question imported but some related data failed: ${errors.join(', ')}`);
      } else {
        toast.success('Question imported successfully with all related data');
      }

      // Reset form and close dialog
      form.reset();
      setParsedData(null);
      setValidationError(null);
      onOpenChange(false);
      onSave();

    } catch (error) {
      console.error('Error importing question:', error);

      // Provide more specific error messages
      let errorMessage = 'Failed to import question';

      if (error instanceof Error) {
        const errorText = error.message.toLowerCase();

        if (errorText.includes('foreign key constraint') && errorText.includes('question_set_id')) {
          errorMessage = 'Invalid question_set_id: The specified question set does not exist. Please check the Question Sets management page for valid UUIDs.';
        } else if (errorText.includes('foreign key constraint') && errorText.includes('created_by')) {
          errorMessage = 'Authentication error: Invalid user. Please refresh the page and try again.';
        } else if (errorText.includes('foreign key constraint')) {
          errorMessage = 'Invalid reference: One or more UUIDs reference non-existent records. Please verify all UUIDs exist in the database.';
        } else if (errorText.includes('violates check constraint')) {
          errorMessage = 'Invalid data: One or more fields contain invalid values. Please check the format requirements.';
        } else if (errorText.includes('duplicate key')) {
          errorMessage = 'Duplicate data: A record with this information already exists.';
        } else if (errorText.includes('not null constraint')) {
          errorMessage = 'Missing required data: One or more required fields are missing or null.';
        } else {
          errorMessage = `Import failed: ${error.message}`;
        }
      }

      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
      setParsedData(null);
      setValidationError(null);
      setShowHelp(false);
      setShowAdvancedExample(false);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogOverlay className="backdrop-blur-md bg-black/20" />
        <DialogContent className="w-full max-w-[min(85vw,800px)] sm:max-w-[min(85vw,800px)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Import Question from JSON
            </DialogTitle>
            <DialogDescription>
              Import a question by providing JSON data. The JSON should include all question details, answer options, and related data.
            </DialogDescription>
          </DialogHeader>

        <div className="mb-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setShowHelp(!showHelp)}
          >
            <HelpCircle className="h-4 w-4 mr-2" />
            {showHelp ? 'Hide' : 'Show'} JSON Format Help
            {showHelp ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
          </Button>

          {showHelp && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold">Expected JSON Format:</h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAdvancedExample(!showAdvancedExample)}
                >
                  {showAdvancedExample ? 'Show Simple Example' : 'Show Advanced Example'}
                </Button>
              </div>
              <pre className="text-xs bg-background p-3 rounded border overflow-x-auto">
                <code>{showAdvancedExample ? FULL_JSON : SIMPLE_JSON}</code>
              </pre>
              <p className="text-xs text-muted-foreground mt-2">
                {showAdvancedExample
                  ? '⚠️ Advanced example with all optional fields - requires existing UUIDs in database'
                  : '✅ Simple example with only required fields - safe to test first'
                }
              </p>
              <div className="mt-3 text-sm text-muted-foreground space-y-3">
                <div>
                  <p className="font-semibold text-foreground mb-1">Required Fields:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li><strong>title:</strong> Question title (1-200 characters)</li>
                    <li><strong>stem:</strong> Main question text (10-2000 characters)</li>
                    <li><strong>difficulty:</strong> "easy", "medium", or "hard"</li>
                    <li><strong>teaching_point:</strong> Educational explanation (10-1000 characters)</li>
                    <li><strong>question_options:</strong> Array of 2-10 question options</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-foreground mb-1">Answer Options Format:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li><strong>text:</strong> Answer option text (required)</li>
                    <li><strong>is_correct:</strong> true/false (required)</li>
                    <li><strong>explanation:</strong> Why this option is correct/incorrect (optional)</li>
                    <li><strong>order_index:</strong> Display order starting from 0 (required)</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-foreground mb-1">Optional Fields:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li><strong>question_references:</strong> Citation text (max 500 characters)</li>
                    <li><strong>status:</strong> "draft" or "approved" (defaults to "draft")</li>
                    <li><strong>question_set_id:</strong> UUID of existing question set</li>
                    <li><strong>question_images:</strong> Array of image associations</li>
                    <li><strong>tag_ids:</strong> Array of existing tag UUIDs</li>
                    <li><strong>category_ids:</strong> Array of existing category UUIDs</li>
                  </ul>
                </div>

                <div>
                  <p className="font-semibold text-foreground mb-1">Question Images Format:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li><strong>image_id:</strong> UUID of existing image in database</li>
                    <li><strong>question_section:</strong> "stem" or "explanation"</li>
                    <li><strong>order_index:</strong> Display order starting from 0</li>
                  </ul>
                </div>

                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
                  <p className="font-semibold text-yellow-800 dark:text-yellow-200 mb-1">Important Notes:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2 text-yellow-700 dark:text-yellow-300">
                    <li><strong>All UUIDs must reference existing records in the database</strong></li>
                    <li>To find UUIDs, check the respective management pages (Question Sets, Tags, Categories, Images)</li>
                    <li>If optional arrays are empty, you can omit them or use empty arrays []</li>
                    <li>At least one answer option must have is_correct: true</li>
                    <li>Answer options and question images must have unique order_index values</li>
                  </ul>
                </div>

                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                  <p className="font-semibold text-blue-800 dark:text-blue-200 mb-1">💡 Testing Tip:</p>
                  <p className="text-blue-700 dark:text-blue-300">
                    Start with a simple question using only required fields (title, stem, difficulty, teaching_point, question_options).
                    Once that works, add optional fields like question_set_id, tags, and categories.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="jsonInput"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>JSON Data</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Paste your question JSON data here..."
                      className="min-h-[300px] font-mono text-sm"
                      onChange={(e) => {
                        field.onChange(e);
                        handleJsonChange(e.target.value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {validationError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{validationError}</AlertDescription>
              </Alert>
            )}

            {parsedData && !validationError && (
              <Alert>
                <FileText className="h-4 w-4" />
                <AlertDescription>
                  JSON is valid! Question "{parsedData.title}" with {parsedData.question_options.length} question options ready to import.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !parsedData || !!validationError}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  'Import Question'
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
