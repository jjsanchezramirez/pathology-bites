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

    // Build the base query for data first
    let dataQuery = supabase
      .from(tableName)
      .select('*');

    // Exclude external images from management table (only for regular images table)
    if (!showUnusedOnly) {
      dataQuery = dataQuery.neq('category', 'external');
    }

    // Filter to only microscopic and gross images if requested
    if (includeOnlyMicroscopicAndGross && !showUnusedOnly) {
      dataQuery = dataQuery.in('category', ['microscopic', 'gross']);
    }

    // Apply filters to data query
    if (searchTerm && searchTerm.trim()) {
      const cleanSearchTerm = searchTerm.trim();

      // Use the correct Supabase .or() syntax based on working examples in the codebase
      // This matches the pattern used in other parts of the application
      dataQuery = dataQuery.or(`alt_text.ilike.%${cleanSearchTerm}%,description.ilike.%${cleanSearchTerm}%,source_ref.ilike.%${cleanSearchTerm}%`);
    }

    // Apply category filter (only for regular images, not unused filter)
    if (category && category !== 'all' && !showUnusedOnly) {
      dataQuery = dataQuery.eq('category', category);
    }

    // Calculate pagination
    const from = page * pageSize;
    const to = from + pageSize - 1;

    // Execute data query first
    const dataResult = await dataQuery
      .order('created_at', { ascending: false })
      .range(from, to);

    if (dataResult.error) {
      console.error('Data query error:', {
        error: dataResult.error,
        message: dataResult.error?.message,
        details: dataResult.error?.details,
        hint: dataResult.error?.hint,
        code: dataResult.error?.code,
        params: { page, pageSize, searchTerm, category, showUnusedOnly, includeOnlyMicroscopicAndGross }
      });
      return {
        data: [],
        total: 0,
        error: `Failed to fetch images: ${dataResult.error?.message || 'Unknown error'}`
      };
    }

    // For now, return a simple count based on the data length
    // This is a temporary fix to avoid the count query issues
    const images = dataResult.data || [];
    const estimatedTotal = images.length;

    // If we got a full page, there might be more data
    const hasMoreData = estimatedTotal === pageSize;
    const total = hasMoreData ? (page + 1) * pageSize + 1 : (page * pageSize) + estimatedTotal;

    return {
      data: images,
      total: total,
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