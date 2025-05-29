// src/hooks/use-question-sets.ts
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { QuestionSetData } from '@/types/question-sets';

export interface UseQuestionSetsReturn {
  questionSets: QuestionSetData[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useQuestionSets(): UseQuestionSetsReturn {
  const [questionSets, setQuestionSets] = useState<QuestionSetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchQuestionSets = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('question_sets')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setQuestionSets(data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch question sets';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchQuestionSets();
  }, [fetchQuestionSets]);

  return {
    questionSets,
    loading,
    error,
    refetch: fetchQuestionSets,
  };
}
