import { type Database } from '@/types/supabase';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export async function deleteImage(imagePath: string, imageId: string) {
  const supabase = createClientComponentClient<Database>();

  // First, delete the file from storage
  const { error: storageError } = await supabase.storage
    .from('images')
    .remove([imagePath]);

  if (storageError) throw storageError;

  // Then, delete the database record
  const { error: dbError } = await supabase
    .from('images')
    .delete()
    .eq('id', imageId);

  if (dbError) throw dbError;
}

export async function updateImage(
  imageId: string, 
  data: { description: string; alt_text: string; category: string }
) {
  const supabase = createClientComponentClient<Database>();
  
  const { error } = await supabase
    .from('images')
    .update(data)
    .eq('id', imageId);

  if (error) throw error;
}

export async function fetchImages(params: {
  page: number;
  pageSize: number;
  searchTerm?: string;
  category?: string;
}) {
  const { page, pageSize, searchTerm, category } = params;
  const supabase = createClientComponentClient<Database>();

  let query = supabase
    .from('images')
    .select('*', { count: 'exact' });

  if (searchTerm) {
    query = query.ilike('alt_text', `%${searchTerm}%`);
  }

  if (category && category !== 'all') {
    query = query.eq('category', category);
  }

  const [countResult, dataResult] = await Promise.all([
    query,
    query
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1)
  ]);

  return {
    data: dataResult.data || [],
    total: countResult.count || 0,
    error: dataResult.error || countResult.error
  };
}