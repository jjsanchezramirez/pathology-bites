// src/components/questions/create-question-dialog.tsx
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from 'lucide-react';
import { useQuestions } from '@/hooks/use-questions';
import { useQuestionSets } from '@/hooks/use-question-sets';
import { useAuthStatus } from '@/hooks/use-auth-status';
import { AnswerOptions } from './answer-options';
import { ImageSearch } from './image-search';
import { TagsCategoriesSelector } from './tags-categories-selector';
import { QuestionFormData, AnswerOptionFormData, QuestionImageFormData } from '@/types/questions';

const createQuestionSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  stem: z.string().min(10, 'Question stem must be at least 10 characters').max(2000, 'Question stem too long'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  teaching_point: z.string().min(10, 'Teaching point must be at least 10 characters').max(1000, 'Teaching point too long'),
  question_references: z.string().max(500, 'References too long').optional(),
  status: z.enum(['draft', 'published']),
  question_set_id: z.string(),
});

type CreateQuestionFormData = z.infer<typeof createQuestionSchema>;

interface CreateQuestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

export function CreateQuestionDialog({
  open,
  onOpenChange,
  onSave
}: CreateQuestionDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Enhanced form state
  const [answerOptions, setAnswerOptions] = useState<AnswerOptionFormData[]>([
    { text: '', is_correct: true, explanation: '', order_index: 0 },
    { text: '', is_correct: false, explanation: '', order_index: 1 }
  ]);
  const [questionImages, setQuestionImages] = useState<QuestionImageFormData[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);

  const { toast } = useToast();
  const { createQuestion } = useQuestions();
  const { questionSets } = useQuestionSets();
  const { user } = useAuthStatus();

  const form = useForm<CreateQuestionFormData>({
    resolver: zodResolver(createQuestionSchema),
    defaultValues: {
      title: '',
      stem: '',
      difficulty: 'medium',
      teaching_point: '',
      question_references: '',
      status: 'draft',
      question_set_id: 'none',
    },
  });

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      form.reset();
      setAnswerOptions([
        { text: '', is_correct: true, explanation: '', order_index: 0 },
        { text: '', is_correct: false, explanation: '', order_index: 1 }
      ]);
      setQuestionImages([]);
      setSelectedTagIds([]);
      setSelectedCategoryIds([]);
    }
  }, [open, form]);

  // Validation function for answer options
  const validateAnswerOptions = (): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (answerOptions.length < 2) {
      errors.options = 'At least 2 answer options are required';
      return errors;
    }

    const correctAnswers = answerOptions.filter(opt => opt.is_correct);
    if (correctAnswers.length !== 1) {
      errors.options = 'Exactly one correct answer must be selected';
    }

    answerOptions.forEach((option, index) => {
      if (!option.text.trim()) {
        errors[`option_${index}_text`] = 'Option text is required';
      }
      if (!option.is_correct && !option.explanation?.trim()) {
        errors[`option_${index}_explanation`] = 'Explanation is required for incorrect answers';
      }
    });

    return errors;
  };

  const onSubmit = async (data: CreateQuestionFormData) => {
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'You must be logged in to create questions',
      });
      return;
    }

    // Validate answer options
    const optionErrors = validateAnswerOptions();
    if (Object.keys(optionErrors).length > 0) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please fix the answer options errors',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Create the question
      const questionData = {
        ...data,
        created_by: user.id,
        question_set_id: data.question_set_id === 'none' ? null : data.question_set_id,
        question_references: data.question_references || null,
      };

      const newQuestion = await createQuestion(questionData);

      // TODO: Create answer options, question images, tags, and categories
      // This will require additional API calls to:
      // 1. Create answer_options records
      // 2. Create question_images records
      // 3. Create question_tags records
      // 4. Create question_categories records

      toast({
        title: 'Success',
        description: 'Question created successfully',
      });

      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create question:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create question',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!isSubmitting) {
      onOpenChange(open);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Question</DialogTitle>
          <DialogDescription>
            Create a new question for your question bank. You can add images and associate it with a question set.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Question Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter question title..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="stem"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Question Stem</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter the question content..."
                          className="min-h-[120px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="teaching_point"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teaching Point</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter the teaching point or explanation..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="question_references"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>References (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter references or citations..."
                          className="min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="difficulty"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Difficulty</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select difficulty" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="easy">Easy</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="hard">Hard</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="published">Published</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="question_set_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Question Set (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select question set" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">No question set</SelectItem>
                          {questionSets.map((set) => (
                            <SelectItem key={set.id} value={set.id}>
                              {set.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Tags and Categories */}
                <TagsCategoriesSelector
                  selectedTagIds={selectedTagIds}
                  selectedCategoryIds={selectedCategoryIds}
                  onTagsChange={setSelectedTagIds}
                  onCategoriesChange={setSelectedCategoryIds}
                />
              </div>
            </div>

            {/* Answer Options */}
            <AnswerOptions
              options={answerOptions}
              onChange={setAnswerOptions}
              errors={validateAnswerOptions()}
            />

            {/* Question Images */}
            <ImageSearch
              selectedImages={questionImages}
              onSelectionChange={setQuestionImages}
              section="question"
              title="Question Images"
              maxImages={5}
            />

            {/* Explanation Images */}
            <ImageSearch
              selectedImages={questionImages}
              onSelectionChange={setQuestionImages}
              section="explanation"
              title="Explanation Images"
              maxImages={3}
            />

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Question
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
