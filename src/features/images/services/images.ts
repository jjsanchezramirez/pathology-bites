// src/lib/images/images.ts
import { createClient } from '@/shared/services/client';
import { deleteFromR2, bulkDeleteFromR2, extractR2KeyFromUrl } from '@/shared/services/r2-storage';
import type { ImageData } from '@/features/images/types/images';

export async function deleteImage(imagePath: string | null, imageId: string) {
  const supabase = createClient();

  try {
    // Get image details to determine storage location
    const { data: imageData, error: fetchError } = await supabase
      .from('images')
      .select('url, storage_path, category')
      .eq('id', imageId)
      .single();

    if (fetchError) {
      console.error('Failed to fetch image details:', fetchError);
      throw new Error(`Failed to fetch image details: ${fetchError.message}`);
    }

    // Only delete from storage if it's not an external image
    if (imageData && imageData.category !== 'external') {
      try {
        // Try to extract R2 key from URL first (for migrated images)
        const r2Key = extractR2KeyFromUrl(imageData.url);
        if (r2Key) {
          await deleteFromR2(r2Key);
        } else if (imagePath || imageData.storage_path) {
          // Fallback: use storage_path or imagePath for legacy images
          const keyToDelete = imagePath || imageData.storage_path;
          if (keyToDelete) {
            await deleteFromR2(keyToDelete);
          }
        }
      } catch (storageError) {
        console.warn('R2 deletion error (continuing with database deletion):', storageError);
        // Continue with database deletion even if R2 deletion fails
      }
    }

    // Delete the database record
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
  data: { description: string; alt_text: string; category: string; source_ref?: string }
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
  showUnusedOnly?: boolean;
  includeOnlyMicroscopicAndGross?: boolean;
}) {
  const { page, pageSize, searchTerm, category, showUnusedOnly, includeOnlyMicroscopicAndGross } = params;
  const supabase = createClient(); // Remove <Database>

  try {
    // Choose the appropriate table/view based on filter
    const tableName = showUnusedOnly ? 'v_orphaned_images' : 'images';

    // Build the base query for counting
    let countQuery = supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    // Build the base query for data
    let dataQuery = supabase
      .from(tableName)
      .select('*');

    // Exclude external images from management table (only for regular images table)
    if (!showUnusedOnly) {
      countQuery = countQuery.neq('category', 'external');
      dataQuery = dataQuery.neq('category', 'external');
    }

    // Filter to only microscopic and gross images if requested
    if (includeOnlyMicroscopicAndGross && !showUnusedOnly) {
      countQuery = countQuery.in('category', ['microscopic', 'gross']);
      dataQuery = dataQuery.in('category', ['microscopic', 'gross']);
    }

    // Apply filters to both queries
    if (searchTerm && searchTerm.trim()) {
      const cleanSearchTerm = searchTerm.trim();

      // Smart search strategy: combine full-text search with partial matching
      const words = cleanSearchTerm.split(/\s+/);
      const searchPattern = `%${cleanSearchTerm}%`;

      if (words.length === 1 && words[0].length >= 3) {
        // Single word search: use prefix matching for better partial results
        // This handles "castle" -> "castleman"
        try {
          const prefixQuery = `${words[0]}:*`;
          countQuery = countQuery.textSearch('search_vector', prefixQuery);
          dataQuery = dataQuery.textSearch('search_vector', prefixQuery);
        } catch (error) {
          // Fallback to ILIKE if prefix search fails
          countQuery = countQuery.or(`alt_text.ilike.${searchPattern},description.ilike.${searchPattern},source_ref.ilike.${searchPattern},category.ilike.${searchPattern}`);
          dataQuery = dataQuery.or(`alt_text.ilike.${searchPattern},description.ilike.${searchPattern},source_ref.ilike.${searchPattern},category.ilike.${searchPattern}`);
        }
      } else {
        // Multi-word or short search: use ILIKE for maximum flexibility
        // This handles "castleman d" -> "castleman disease" and short terms
        countQuery = countQuery.or(`alt_text.ilike.${searchPattern},description.ilike.${searchPattern},source_ref.ilike.${searchPattern},category.ilike.${searchPattern}`);
        dataQuery = dataQuery.or(`alt_text.ilike.${searchPattern},description.ilike.${searchPattern},source_ref.ilike.${searchPattern},category.ilike.${searchPattern}`);
      }
    }

    // Apply category filter (only for regular images, not unused filter)
    if (category && category !== 'all' && !showUnusedOnly) {
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
  const supabase = createClient();

  try {
    // Import R2 functions
    const { uploadToR2, generateImageStoragePath } = await import('@/shared/services/r2-storage');

    // Generate R2 storage path
    const storagePath = generateImageStoragePath(file.name, metadata.category);

    // Upload file to R2
    const uploadResult = await uploadToR2(file, storagePath, {
      contentType: metadata.file_type,
      metadata: {
        originalName: file.name,
        category: metadata.category,
        uploadedBy: metadata.created_by,
        uploadedAt: new Date().toISOString()
      }
    });

    // R2 upload result contains the public URL
    const publicUrl = uploadResult.url;

    // Save metadata to database
    const { data: imageData, error: dbError } = await supabase
      .from('images')
      .insert({
        url: publicUrl,
        storage_path: storagePath, // Use R2 storage path
        description: metadata.description,
        alt_text: metadata.alt_text,
        category: metadata.category,
        file_type: metadata.file_type,
        file_size_bytes: uploadResult.size,
        source_ref: metadata.source_ref || null,
        created_by: metadata.created_by,
      })
      .select()
      .single();

    if (dbError) {
      // If database insertion fails, clean up the R2 uploaded file
      try {
        const { deleteFromR2 } = await import('@/shared/services/r2-storage');
        await deleteFromR2(storagePath);
      } catch (cleanupError) {
        console.warn('Failed to cleanup R2 file after database error:', cleanupError);
      }
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

export async function createExternalImage(
  url: string,
  createdBy?: string
): Promise<ImageData> {
  const supabase = createClient();

  try {
    const { data: imageData, error: dbError } = await supabase
      .from('images')
      .insert({
        url,
        category: 'external',
        created_by: createdBy || null,
        // All other fields (storage_path, file_type, alt_text, description, source_ref) will be null
      })
      .select()
      .single();

    if (dbError) {
      console.error('Create external image error:', dbError);
      throw new Error(`Failed to create external image: ${dbError.message}`);
    }

    return imageData;
  } catch (error) {
    console.error('Create external image error:', error);
    throw error;
  }
}

export async function createExternalImageIfNotExists(
  url: string,
  createdBy?: string
): Promise<ImageData> {
  const supabase = createClient();

  try {
    // First, check if an external image with this URL already exists
    const { data: existingImage, error: selectError } = await supabase
      .from('images')
      .select('*')
      .eq('url', url)
      .eq('category', 'external')
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      // Error other than "no rows returned"
      throw selectError;
    }

    if (existingImage) {
      // Image already exists, return it
      return existingImage;
    }

    // Image doesn't exist, create it
    return await createExternalImage(url, createdBy);
  } catch (error) {
    console.error('Create external image if not exists error:', error);
    throw error;
  }
}

export async function bulkDeleteImages(imageIds: string[]): Promise<{ success: boolean; deleted: number; errors: string[] }> {
  const supabase = createClient();
  const errors: string[] = [];
  let deleted = 0;

  try {
    // Get image details for storage cleanup
    const { data: images, error: fetchError } = await supabase
      .from('images')
      .select('id, storage_path, url, category')
      .in('id', imageIds)
      .neq('category', 'external'); // Don't try to delete storage for external images

    if (fetchError) {
      throw fetchError;
    }

    // Delete from R2 storage first (for uploaded images)
    const r2Keys: string[] = [];

    for (const image of images) {
      if (image.category !== 'external') {
        // Try to extract R2 key from URL first (for migrated images)
        const r2Key = extractR2KeyFromUrl(image.url);
        if (r2Key) {
          r2Keys.push(r2Key);
        } else if (image.storage_path) {
          // Fallback: use storage_path for legacy images
          r2Keys.push(image.storage_path);
        }
      }
    }

    if (r2Keys.length > 0) {
      try {
        const deleteResult = await bulkDeleteFromR2(r2Keys);
        if (deleteResult.errors.length > 0) {
          console.warn('Some R2 deletions failed:', deleteResult.errors);
          // Continue with database deletion even if some R2 deletions fail
        }
      } catch (storageError) {
        console.warn('R2 bulk deletion error:', storageError);
        // Continue with database deletion even if R2 deletion fails
      }
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('images')
      .delete()
      .in('id', imageIds);

    if (dbError) {
      throw dbError;
    }

    deleted = imageIds.length;

    return {
      success: true,
      deleted,
      errors
    };
  } catch (error) {
    console.error('Bulk delete images error:', error);
    errors.push(error instanceof Error ? error.message : 'Unknown error');

    return {
      success: false,
      deleted,
      errors
    };
  }
}