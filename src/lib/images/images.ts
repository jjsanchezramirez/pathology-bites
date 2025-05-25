// src/lib/images/images.ts
import { type Database } from '@/types/supabase';
import { createClient } from '@/lib/supabase/client';

export type ImageData = Database['public']['Tables']['images']['Row'];
export type ImageInsert = Database['public']['Tables']['images']['Insert'];
export type ImageUpdate = Database['public']['Tables']['images']['Update'];

export async function deleteImage(imagePath: string, imageId: string) {
  const supabase = createClient(); // Remove <Database>

  try {
    // First, delete the file from storage
    const { error: storageError } = await supabase.storage
      .from('images')
      .remove([imagePath]);

    if (storageError) {
      console.error('Storage deletion error:', storageError);
      throw new Error(`Failed to delete image from storage: ${storageError.message}`);
    }

    // Then, delete the database record
    const { error: dbError } = await supabase
      .from('images')
      .delete()
      .eq('id', imageId);

    if (dbError) {
      console.error('Database deletion error:', dbError);
      throw new Error(`Failed to delete image from database: ${dbError.message}`);
    }

    return { success: true };
  } catch (error) {
    console.error('Delete image error:', error);
    throw error;
  }
}

export async function updateImage(
  imageId: string, 
  data: { description: string; alt_text: string; category: string }
) {
  const supabase = createClient(); // Remove <Database>
  
  try {
    const { error } = await supabase
      .from('images')
      .update(data)
      .eq('id', imageId);

    if (error) {
      console.error('Update image error:', error);
      throw new Error(`Failed to update image: ${error.message}`);
    }

    return { success: true };
  } catch (error) {
    console.error('Update image error:', error);
    throw error;
  }
}

export async function fetchImages(params: {
  page: number;
  pageSize: number;
  searchTerm?: string;
  category?: string;
}) {
  const { page, pageSize, searchTerm, category } = params;
  const supabase = createClient(); // Remove <Database>

  try {
    // Build the base query for counting
    let countQuery = supabase
      .from('images')
      .select('*', { count: 'exact', head: true });

    // Build the base query for data
    let dataQuery = supabase
      .from('images')
      .select('*');

    // Apply filters to both queries
    if (searchTerm && searchTerm.trim()) {
      const searchPattern = `%${searchTerm.trim()}%`;
      countQuery = countQuery.or(`alt_text.ilike.${searchPattern},description.ilike.${searchPattern}`);
      dataQuery = dataQuery.or(`alt_text.ilike.${searchPattern},description.ilike.${searchPattern}`);
    }

    if (category && category !== 'all') {
      countQuery = countQuery.eq('category', category);
      dataQuery = dataQuery.eq('category', category);
    }

    // Calculate pagination
    const from = page * pageSize;
    const to = from + pageSize - 1;

    // Execute queries
    const [countResult, dataResult] = await Promise.all([
      countQuery,
      dataQuery
        .order('created_at', { ascending: false })
        .range(from, to)
    ]);

    if (countResult.error) {
      console.error('Count query error:', countResult.error);
      throw new Error(`Failed to count images: ${countResult.error.message}`);
    }

    if (dataResult.error) {
      console.error('Data query error:', dataResult.error);
      throw new Error(`Failed to fetch images: ${dataResult.error.message}`);
    }

    return {
      data: dataResult.data || [],
      total: countResult.count || 0,
      error: null
    };
  } catch (error) {
    console.error('Fetch images error:', error);
    return {
      data: [],
      total: 0,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

export async function uploadImage(
  file: File, 
  metadata: {
    description: string;
    alt_text: string;
    category: string;
    file_type: string;
    created_by: string;
    source_ref?: string;
  }
): Promise<ImageData> {
  const supabase = createClient(); // Remove <Database>

  try {
    // Generate unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${fileName}`;

    // Upload file to storage
    const { error: uploadError } = await supabase.storage
      .from('images')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('images')
      .getPublicUrl(filePath);

    // Save metadata to database
    const { data: imageData, error: dbError } = await supabase
      .from('images')
      .insert({
        url: publicUrl,
        storage_path: filePath,
        description: metadata.description,
        alt_text: metadata.alt_text,
        category: metadata.category,
        file_type: metadata.file_type,
        source_ref: metadata.source_ref || null,
        created_by: metadata.created_by,
      })
      .select()
      .single();

    if (dbError) {
      // If database insertion fails, clean up the uploaded file
      await supabase.storage.from('images').remove([filePath]);
      console.error('Database insert error:', dbError);
      throw new Error(`Failed to save image metadata: ${dbError.message}`);
    }

    return imageData;
  } catch (error) {
    console.error('Upload image error:', error);
    throw error;
  }
}

export async function getImageById(imageId: string): Promise<ImageData | null> {
  const supabase = createClient(); // Remove <Database>

  try {
    const { data, error } = await supabase
      .from('images')
      .select('*')
      .eq('id', imageId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      console.error('Get image by ID error:', error);
      throw new Error(`Failed to fetch image: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Get image by ID error:', error);
    throw error;
  }
}