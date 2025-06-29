// src/hooks/use-questions.ts
import { useState, useCallback } from 'react';
import { createClient } from '@/shared/services/client';
import { toast } from 'sonner';
import { QuestionData, QuestionInsert, QuestionUpdate, QuestionWithDetails } from '@/features/questions/types/questions';
import { QuestionSetData } from '@/features/questions/types/question-sets';

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
  updateQuestion: (questionId: string, data: QuestionUpdate) => Promise<void>;
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
      // Build the base query
      let query = supabase
        .from('questions')
        .select(`
          *,
          question_set:question_sets(
            id,
            name,
            source_type,
            short_form
          ),
          created_by_user:users!questions_created_by_fkey(
            first_name,
            last_name
          ),
          question_images(count)
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

      // Fetch categories for all questions
      const questionIds = (data || []).map(q => q.id);
      let categoriesData: any[] = [];

      if (questionIds.length > 0) {
        const { data: categoriesResult } = await supabase
          .from('question_categories')
          .select(`
            question_id,
            categories!inner(
              id,
              name,
              color,
              level,
              parent_id,
              short_form
            )
          `)
          .in('question_id', questionIds);

        categoriesData = categoriesResult || [];
      }

      // Transform the data
      const transformedQuestions: QuestionWithDetails[] = (data || []).map(question => {
        const questionCategories = categoriesData
          .filter(qc => qc.question_id === question.id)
          .map(qc => qc.categories)
          .filter(Boolean);

        return {
          ...question,
          created_by_name: question.created_by_user
            ? `${question.created_by_user.first_name || ''} ${question.created_by_user.last_name || ''}`.trim()
            : 'Unknown',
          image_count: question.question_images?.[0]?.count || 0,
          categories: questionCategories
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
      const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', questionId);

      if (error) {
        throw new Error(error.message);
      }

      toast.success('Question deleted successfully');

      // Refetch questions
      await fetchQuestions();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete question';
      toast.error(message);
      throw err;
    }
  }, [supabase, fetchQuestions]);

  const updateQuestion = useCallback(async (questionId: string, data: QuestionUpdate) => {
    try {
      const { error } = await supabase
        .from('questions')
        .update(data)
        .eq('id', questionId);

      if (error) {
        throw new Error(error.message);
      }

      toast.success('Question updated successfully');

      // Refetch questions
      await fetchQuestions();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update question';
      toast.error(message);
      throw err;
    }
  }, [supabase, fetchQuestions]);

  const createQuestion = useCallback(async (data: QuestionInsert): Promise<QuestionData> => {
    try {
      const { data: newQuestion, error } = await supabase
        .from('questions')
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
