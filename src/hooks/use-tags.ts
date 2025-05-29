// src/hooks/use-tags.ts
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TagData } from '@/types/questions';
import { useToast } from '@/hooks/use-toast';

export interface UseTagsReturn {
  tags: TagData[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createTag: (name: string) => Promise<TagData>;
}

export function useTags(): UseTagsReturn {
  const [tags, setTags] = useState<TagData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();
  const { toast } = useToast();

  const fetchTags = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('tags')
        .select('*')
        .order('name');

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setTags(data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch tags';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const createTag = useCallback(async (name: string): Promise<TagData> => {
    try {
      const { data, error } = await supabase
        .from('tags')
        .insert({ name })
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      toast({
        title: 'Success',
        description: 'Tag created successfully',
      });

      // Refetch tags
      await fetchTags();

      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create tag';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
      });
      throw err;
    }
  }, [supabase, toast, fetchTags]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  return {
    tags,
    loading,
    error,
    refetch: fetchTags,
    createTag,
  };
}
