// src/features/questions/hooks/use-universal-tags.ts
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/shared/services/client';
import { TagData } from '@/features/questions/types/questions';
import { toast } from 'sonner';

export interface UseUniversalTagsReturn {
  recentTags: TagData[];
  searchTags: (query: string) => Promise<TagData[]>;
  createTag: (name: string) => Promise<TagData>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useUniversalTags(): UseUniversalTagsReturn {
  const [recentTags, setRecentTags] = useState<TagData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  // Fetch 15 most recently created tags
  const fetchRecentTags = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('tags')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(15);

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setRecentTags(data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch recent tags';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // Search all tags in database
  const searchTags = useCallback(async (query: string): Promise<TagData[]> => {
    if (!query.trim()) {
      return recentTags;
    }

    try {
      const { data, error: searchError } = await supabase
        .from('tags')
        .select('*')
        .ilike('name', `%${query.trim()}%`)
        .order('name');

      if (searchError) {
        throw new Error(searchError.message);
      }

      return data || [];
    } catch (err) {
      console.error('Error searching tags:', err);
      return [];
    }
  }, [supabase, recentTags]);

  // Create a new tag
  const createTag = useCallback(async (name: string): Promise<TagData> => {
    try {
      const { data, error } = await supabase
        .from('tags')
        .insert({ name: name.trim() })
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      toast.success('Tag created successfully');

      // Refetch recent tags to include the new one
      await fetchRecentTags();

      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create tag';
      toast.error(message);
      throw err;
    }
  }, [supabase, fetchRecentTags]);

  // Initialize by fetching recent tags
  useEffect(() => {
    fetchRecentTags();
  }, [fetchRecentTags]);

  return {
    recentTags,
    searchTags,
    createTag,
    loading,
    error,
    refetch: fetchRecentTags,
  };
}
