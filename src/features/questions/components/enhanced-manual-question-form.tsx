'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Icons } from '@/shared/components/common/icons';
import { toast } from 'sonner';

// Import existing components
import { CompactAnswerOptions } from './compact-answer-options';
import { TagAutocomplete } from '../../../app/(admin)/admin/create-question/components/tag-autocomplete';
import { ImageAttachmentsTab } from '../../../app/(admin)/admin/create-question/components/image-attachments-tab';

// Import types
import { 
  QuestionFormData, 
  QuestionOptionFormData, 
  QuestionImageFormData 
} from '@/features/questions/types/questions';

// Import hooks
import { useQuestionSets } from '@/features/questions/hooks/use-question-sets';

// Define the enhanced form schema
const enhancedQuestionSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  stem: z.string().min(10, 'Question stem must be at least 10 characters').max(2000, 'Question stem too long'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  teaching_point: z.string().min(10, 'Teaching point must be at least 10 characters').max(1000, 'Teaching point too long'),
  question_references: z.string().max(500, 'References too long').optional(),
  status: z.enum(['draft', 'pending_review', 'approved', 'flagged']),
  question_set_id: z.string(),
  category_id: z.string().nullable().optional(),
});

type EnhancedQuestionFormData = z.infer<typeof enhancedQuestionSchema>;

interface EnhancedManualQuestionFormProps {
  onSubmit: (data: QuestionFormData) => Promise<void>;
  isEdit?: boolean;
  initialData?: Partial<QuestionFormData>;
}

export function EnhancedManualQuestionForm({ 
  onSubmit, 
  isEdit = false, 
  initialData 
}: EnhancedManualQuestionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');

  // Form state for complex fields
  const [answerOptions, setAnswerOptions] = useState<QuestionOptionFormData[]>([
    { text: '', is_correct: true, explanation: '', order_index: 0 },
    { text: '', is_correct: false, explanation: '', order_index: 1 },
    { text: '', is_correct: false, explanation: '', order_index: 2 },
    { text: '', is_correct: false, explanation: '', order_index: 3 },
    { text: '', is_correct: false, explanation: '', order_index: 4 }
  ]);
  
  const [questionImages, setQuestionImages] = useState<QuestionImageFormData[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [availableCategories, setAvailableCategories] = useState<any[]>([]);

  // Load question sets
  const { questionSets } = useQuestionSets();

  const form = useForm<EnhancedQuestionFormData>({
    resolver: zodResolver(enhancedQuestionSchema),
    defaultValues: {
      title: initialData?.title || '',
      stem: initialData?.stem || '',
      difficulty: (initialData?.difficulty as 'easy' | 'medium' | 'hard') || 'medium',
      teaching_point: initialData?.teaching_point || '',
      question_references: initialData?.question_references || '',
      status: (initialData?.status as 'draft' | 'pending_review' | 'approved' | 'flagged') || 'draft',
      question_set_id: initialData?.question_set_id || 'none',
      category_id: initialData?.category_id || null,
    },
  });

  // Load tags and categories on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load tags (latest 10 created)
        const tagsResponse = await fetch('/api/admin/tags?page=0&pageSize=10&sortBy=created_at&sortOrder=desc');
        const tagsData = await tagsResponse.json();
        setAvailableTags(tagsData.tags || []);

        // Load categories
        const categoriesResponse = await fetch('/api/admin/categories?page=0&pageSize=1000');
        const categoriesData = await categoriesResponse.json();
        setAvailableCategories(categoriesData.categories || []);
      } catch (error) {
        console.error('Failed to load tags/categories:', error);
      }
    };

    loadData();
  }, []);

  // Initialize form data for edit mode
  useEffect(() => {
    if (isEdit && initialData) {
      // Set answer options
      if (initialData.question_options) {
        setAnswerOptions(initialData.question_options.map((opt, index) => ({
          id: opt.id,
          text: opt.text,
          is_correct: opt.is_correct,
          explanation: opt.explanation || '',
          order_index: index,
        })));
      }

      // Set question images
      if (initialData.question_images) {
        setQuestionImages(initialData.question_images.map((img, index) => ({
          image_id: img.image_id,
          question_section: img.question_section,
          order_index: index,
        })));
      }

      // Set selected tags and category
      setSelectedTagIds(initialData.tag_ids || []);
      setSelectedCategoryId(initialData.category_id || '');
    }
  }, [isEdit, initialData]);

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

  const handleSubmit = async (data: EnhancedQuestionFormData) => {
    setHasAttemptedSubmit(true);
    
    // Validate answer options
    const optionErrors = validateAnswerOptions();
    if (Object.keys(optionErrors).length > 0) {
      toast.error('Please fix the answer options errors');
      setActiveTab('options');
      return;
    }

    setIsSubmitting(true);
    try {
      // Prepare the complete question data for the API
      const questionData: QuestionFormData = {
        title: data.title,
        stem: data.stem,
        difficulty: data.difficulty,
        teaching_point: data.teaching_point,
        question_references: data.question_references || '',
        status: data.status,
        question_set_id: data.question_set_id === 'none' ? '' : data.question_set_id,
        category_id: selectedCategoryId || '',
        question_options: answerOptions.map((option, index) => ({
          text: option.text,
          is_correct: option.is_correct,
          explanation: option.explanation || '',
          order_index: index,
        })),
        question_images: questionImages.map(img => ({
          image_id: img.image_id,
          question_section: img.question_section,
          order_index: img.order_index,
        })),
        tag_ids: selectedTagIds,
      };

      await onSubmit(questionData);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEdit ? 'Edit Question' : 'Create New Question'}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="options">Answer Options</TabsTrigger>
                <TabsTrigger value="images">Images</TabsTrigger>
                <TabsTrigger value="tags">Tags & Category</TabsTrigger>
              </TabsList>

              {/* Basic Information Tab */}
              <TabsContent value="basic" className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Question Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter question title..." {...field} />
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
                          placeholder="Enter the question stem..."
                          className="min-h-[120px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                    name="question_set_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Question Set</FormLabel>
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
                </div>

                <FormField
                  control={form.control}
                  name="teaching_point"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teaching Point</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter the key learning point..."
                          className="min-h-[80px]"
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
                        <Input placeholder="Enter references..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              {/* Answer Options Tab */}
              <TabsContent value="options" className="space-y-4">
                <CompactAnswerOptions
                  options={answerOptions}
                  onChange={setAnswerOptions}
                  errors={hasAttemptedSubmit ? validateAnswerOptions() : undefined}
                />
              </TabsContent>

              {/* Images Tab */}
              <TabsContent value="images" className="space-y-4">
                <ImageAttachmentsTab
                  attachedImages={questionImages}
                  onImagesChange={setQuestionImages}
                />
              </TabsContent>

              {/* Tags & Category Tab */}
              <TabsContent value="tags" className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Category</label>
                    <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select category..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No category</SelectItem>
                        {availableCategories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Tags</label>
                    <TagAutocomplete
                      allTags={availableTags}
                      selectedTags={selectedTagIds}
                      onTagsChange={setSelectedTagIds}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting && (
                <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isSubmitting
                ? isEdit ? 'Saving...' : 'Creating...'
                : isEdit ? 'Save Changes' : 'Create Question'
              }
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
