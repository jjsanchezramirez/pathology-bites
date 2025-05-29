// src/hooks/use-categories.ts
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CategoryData } from '@/types/questions';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('categories')
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
          .from('categories')
          .select('level')
          .eq('id', parentId)
          .single();
        
        if (parentData) {
          level = parentData.level + 1;
        }
      }

      const { data, error } = await supabase
        .from('categories')
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

      toast({
        title: 'Success',
        description: 'Category created successfully',
      });

      // Refetch categories
      await fetchCategories();

      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create category';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
      });
      throw err;
    }
  }, [supabase, toast, fetchCategories]);

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
