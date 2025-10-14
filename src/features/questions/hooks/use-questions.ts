// src/hooks/use-questions.ts
import { useState, useCallback } from 'react';
import { createClient } from '@/shared/services/client';
import { toast } from 'sonner';
import { QuestionData, QuestionInsert, QuestionUpdate, QuestionWithDetails } from '@/features/questions/types/questions';
import { QuestionSetData } from '@/features/questions/types/question-sets';
import { TABLE_NAMES } from '@/shared/constants/database-types';

export interface UseQuestionsParams {
  page?: number;
  pageSize?: number;
  searchTerm?: string;
  difficulty?: string;
  status?: string;
  questionSetId?: string;
}

export interface UseQuestionsReturn {
  questions: QuestionWithDetails[];
  total: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  deleteQuestion: (questionId: string) => Promise<void>;
  updateQuestion: (
    questionId: string,
    data: QuestionUpdate,
    options?: {
      updateType?: 'patch' | 'minor' | 'major';
      changeSummary?: string;
      answerOptions?: any[];
      questionImages?: any[];
      tagIds?: string[];
      categoryId?: string;
    }
  ) => Promise<any>;
  createQuestion: (data: QuestionInsert) => Promise<QuestionData>;
}

export function useQuestions(params: UseQuestionsParams = {}): UseQuestionsReturn {
  const {
    page = 0,
    pageSize = 10,
    searchTerm = '',
    difficulty = 'all',
    status = 'all',
    questionSetId = 'all'
  } = params;

  const [questions, setQuestions] = useState<QuestionWithDetails[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Build the base query - SELECT only needed fields
      let query = supabase
        .from(TABLE_NAMES.QUESTIONS)
        .select(`
          id,
          title,
          stem,
          difficulty,
          teaching_point,
          question_references,
          status,
          question_set_id,
          category_id,
          created_by,
          updated_by,
          created_at,
          updated_at,
          published_at,
          version,
          question_set:question_sets!questions_set_id_fkey(
            id,
            name,
            source_type,
            short_form
          ),
          created_by_user:users!questions_created_by_fkey(
            first_name,
            last_name
          ),
          question_images(count),
          question_options(
            id,
            text,
            is_correct,
            explanation,
            order_index
          ),
          question_tags(
            tag:tags(
              id,
              name
            )
          )
        `, { count: 'exact' });

      // Apply filters
      if (searchTerm && searchTerm.trim()) {
        const searchPattern = `%${searchTerm.trim()}%`;
        query = query.or(`title.ilike.${searchPattern},stem.ilike.${searchPattern}`);
      }

      if (difficulty !== 'all') {
        query = query.eq('difficulty', difficulty);
      }

      if (status !== 'all') {
        query = query.eq('status', status);
      }

      if (questionSetId !== 'all') {
        query = query.eq('question_set_id', questionSetId);
      }

      // Apply pagination
      const from = page * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      // Order by created_at desc
      query = query.order('created_at', { ascending: false });

      const { data, error: fetchError, count } = await query;

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      // Fetch categories for all questions that have category_id
      const questionIds = (data || []).map(q => q.id);
      const categoryIds = [...new Set((data || []).map(q => q.category_id).filter(Boolean))];
      let categoriesData: any[] = [];
      let latestVersionsData: any[] = [];

      if (categoryIds.length > 0) {
        const { data: categoriesResult } = await supabase
          .from(TABLE_NAMES.CATEGORIES)
          .select(`
            id,
            name,
            color,
            level,
            parent_id,
            short_form
          `)
          .in('id', categoryIds);

        categoriesData = categoriesResult || [];
      }

      // Fetch latest versions for all questions
      if (questionIds.length > 0) {
        const { data: versionsResult } = await supabase
          .from('question_versions')
          .select(`
            question_id,
            version_string,
            created_at
          `)
          .in('question_id', questionIds)
          .order('created_at', { ascending: false });

        // Group by question_id and get the latest version for each
        const versionsByQuestion = (versionsResult || []).reduce((acc: any, version: any) => {
          if (!acc[version.question_id]) {
            acc[version.question_id] = version.version_string;
          }
          return acc;
        }, {});

        latestVersionsData = versionsByQuestion;
      }

      // Transform the data
      const transformedQuestions: QuestionWithDetails[] = (data || []).map(question => {
        // Find the category for this question
        const questionCategory = question.category_id
          ? categoriesData.find(cat => cat.id === question.category_id)
          : null;

        // Get the latest version for this question
        const latestVersion = latestVersionsData[question.id] || question.version || '1.0.0';

        return {
          ...question,
          created_by_name: question.created_by_user
            ? `${question.created_by_user.first_name || ''} ${question.created_by_user.last_name || ''}`.trim()
            : 'Unknown',
          image_count: question.question_images?.[0]?.count || 0,
          categories: questionCategory ? [questionCategory] : [],
          tags: question.question_tags?.map((qt: any) => qt.tag).filter(Boolean) || [],
          version_string: latestVersion,
          version: latestVersion // Update the version field with the latest version
        };
      });

      setQuestions(transformedQuestions);
      setTotal(count || 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch questions';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchTerm, difficulty, status, questionSetId, supabase]);

  const deleteQuestion = useCallback(async (questionId: string) => {
    try {
      const response = await fetch(`/api/admin/questions/${questionId}/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      let data;

      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        // If not JSON, get text for debugging
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error(`Server returned non-JSON response (${response.status})`);
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete question');
      }

      toast.success(data.message || 'Question deleted successfully');

      // Refetch questions
      await fetchQuestions();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete question';
      toast.error(message);
      throw err;
    }
  }, [fetchQuestions]);

  const updateQuestion = useCallback(async (
    questionId: string,
    data: QuestionUpdate,
    options?: {
      updateType?: 'patch' | 'minor' | 'major';
      changeSummary?: string;
      answerOptions?: any[];
      questionImages?: any[];
      tagIds?: string[];
      categoryId?: string;
    }
  ) => {
    try {
      // Use the new versioning API for comprehensive updates
      const response = await fetch(`/api/admin/questions/${questionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          questionData: data,
          updateType: options?.updateType,
          changeSummary: options?.changeSummary,
          answerOptions: options?.answerOptions,
          questionImages: options?.questionImages,
          tagIds: options?.tagIds,
          categoryId: options?.categoryId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update question');
      }

      const result = await response.json();

      // Refetch questions to update the list
      await fetchQuestions();

      return result;
    } catch (error) {
      throw error;
    }
  }, [fetchQuestions]);

  const createQuestion = useCallback(async (data: QuestionInsert): Promise<QuestionData> => {
    try {
      const { data: newQuestion, error } = await supabase
        .from(TABLE_NAMES.QUESTIONS)
        .insert(data)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      toast.success('Question created successfully');

      // Refetch questions
      await fetchQuestions();

      return newQuestion;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create question';
      toast.error(message);
      throw err;
    }
  }, [supabase, fetchQuestions]);

  return {
    questions,
    total,
    loading,
    error,
    refetch: fetchQuestions,
    deleteQuestion,
    updateQuestion,
    createQuestion,
  };
}
