// src/hooks/use-questions.ts
import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { QuestionData, QuestionInsert, QuestionUpdate } from '@/types/questions';
import { QuestionSetData } from '@/types/question-sets';

export interface QuestionWithDetails extends QuestionData {
  question_set?: QuestionSetData;
  created_by_name?: string;
  image_count?: number;
}

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
  const { toast } = useToast();

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
            source_type
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

      // Transform the data
      const transformedQuestions: QuestionWithDetails[] = (data || []).map(question => ({
        ...question,
        created_by_name: question.created_by_user 
          ? `${question.created_by_user.first_name || ''} ${question.created_by_user.last_name || ''}`.trim()
          : 'Unknown',
        image_count: question.question_images?.[0]?.count || 0
      }));

      setQuestions(transformedQuestions);
      setTotal(count || 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch questions';
      setError(message);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
      });
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchTerm, difficulty, status, questionSetId, supabase, toast]);

  const deleteQuestion = useCallback(async (questionId: string) => {
    try {
      const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', questionId);

      if (error) {
        throw new Error(error.message);
      }

      toast({
        title: 'Success',
        description: 'Question deleted successfully',
      });

      // Refetch questions
      await fetchQuestions();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete question';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
      });
      throw err;
    }
  }, [supabase, toast, fetchQuestions]);

  const updateQuestion = useCallback(async (questionId: string, data: QuestionUpdate) => {
    try {
      const { error } = await supabase
        .from('questions')
        .update(data)
        .eq('id', questionId);

      if (error) {
        throw new Error(error.message);
      }

      toast({
        title: 'Success',
        description: 'Question updated successfully',
      });

      // Refetch questions
      await fetchQuestions();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update question';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
      });
      throw err;
    }
  }, [supabase, toast, fetchQuestions]);

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

      toast({
        title: 'Success',
        description: 'Question created successfully',
      });

      // Refetch questions
      await fetchQuestions();

      return newQuestion;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create question';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
      });
      throw err;
    }
  }, [supabase, toast, fetchQuestions]);

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
