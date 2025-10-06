// src/hooks/use-categories.ts
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/shared/services/client';
import { CategoryData } from '@/features/questions/types/questions';
import { toast } from 'sonner';
import { TABLE_NAMES } from '@/shared/constants/database-types';

export interface UseCategoriesReturn {
  categories: CategoryData[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createCategory: (name: string, description?: string, parentId?: string) => Promise<CategoryData>;
}

export function useCategories(): UseCategoriesReturn {
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from(TABLE_NAMES.CATEGORIES)
        .select('*')
        .order('level, name');

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setCategories(data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch categories';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const createCategory = useCallback(async (
    name: string, 
    description?: string, 
    parentId?: string
  ): Promise<CategoryData> => {
    try {
      // Calculate level based on parent
      let level = 1;
      if (parentId) {
        const { data: parentData } = await supabase
          .from(TABLE_NAMES.CATEGORIES)
          .select('level')
          .eq('id', parentId)
          .single();
        
        if (parentData) {
          level = parentData.level + 1;
        }
      }

      const { data, error } = await supabase
        .from(TABLE_NAMES.CATEGORIES)
        .insert({
          name, 
          description: description || null,
          parent_id: parentId || null,
          level 
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      toast.success('Category created successfully');

      // Refetch categories
      await fetchCategories();

      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create category';
      toast.error(message);
      throw err;
    }
  }, [supabase, fetchCategories]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return {
    categories,
    loading,
    error,
    refetch: fetchCategories,
    createCategory,
  };
}
