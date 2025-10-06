// src/lib/images/images.ts
import { createClient } from '@/shared/services/client';
import type { ImageData } from '@/features/images/types/images';


export async function deleteImage(imagePath: string | null, imageId: string) {
  try {
    console.log('🗑️ Deleting image:', { imageId, imagePath });

    const url = '/api/media/images/delete';
    console.log('📡 Making DELETE request to:', url);

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Ensure cookies are sent
      body: JSON.stringify({
        imageId,
        imagePath
      })
    });

    console.log('📥 Delete response:', {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type')
    });

    if (!response.ok) {
      // Check if response is HTML (error page) or JSON
      const contentType = response.headers.get('content-type');
      console.log('❌ Error response content-type:', contentType);

      if (contentType && contentType.includes('text/html')) {
        const htmlText = await response.text();
        console.error('❌ Received HTML error page instead of JSON:', htmlText.substring(0, 500));
        throw new Error(`Server error (${response.status}): Received HTML error page instead of JSON response`);
      }

      try {
        const errorData = await response.json();
        console.log('❌ Error data:', errorData);
        throw new Error(errorData.error || 'Failed to delete image');
      } catch (parseError) {
        console.error('❌ Failed to parse error response as JSON:', parseError);
        const responseText = await response.text();
        console.error('❌ Raw response text:', responseText.substring(0, 500));
        throw new Error(`Server error (${response.status}): ${response.statusText}`);
      }
    }

    // Try to parse success response
    try {
      const result = await response.json();
      console.log('✅ Delete successful:', result);
      return result;
    } catch (parseError) {
      console.error('❌ Failed to parse success response as JSON:', parseError);
      const responseText = await response.text();
      console.error('❌ Raw success response text:', responseText.substring(0, 500));
      throw new Error('Failed to parse server response');
    }
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
      // Return default values instead of throwing to prevent UI crashes
      return {
        data: [],
        total: 0,
        error: `Failed to count images: ${countResult.error.message}`
      };
    }

    if (dataResult.error) {
      console.error('Data query error:', dataResult.error);
      // Return default values instead of throwing to prevent UI crashes
      return {
        data: [],
        total: 0,
        error: `Failed to fetch images: ${dataResult.error.message}`
      };
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
  try {
    // Upload via API endpoint
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', metadata.category);
    formData.append('description', metadata.description);
    if (metadata.source_ref) formData.append('sourceRef', metadata.source_ref);

    const response = await fetch('/api/media/images/upload', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Upload failed');
    }

    const result = await response.json();
    return result.image;
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
  try {
    if (imageIds.length === 0) {
      return { success: true, deleted: 0, errors: [] };
    }

    const response = await fetch('/api/media/images/bulk-delete', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Ensure cookies are sent
      body: JSON.stringify({
        imageIds
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete images');
    }

    const result = await response.json();

    return {
      success: result.success,
      deleted: result.results.deleted.length,
      errors: result.results.storageErrors || []
    };
  } catch (error) {
    console.error('Bulk delete images error:', error);
    return {
      success: false,
      deleted: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error']
    };
  }
}