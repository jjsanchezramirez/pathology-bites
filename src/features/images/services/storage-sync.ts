// Storage synchronization utilities
import { createClient } from '@/shared/services/client';

export interface StorageFileInfo {
  name: string;
  size: number;
  mimetype: string;
  lastModified: string;
}

export interface SyncResult {
  success: boolean;
  updated: number;
  errors: string[];
  skipped: number;
  totalProcessed: number;
}

/**
 * Get file metadata from Supabase Storage
 */
export async function getStorageFileInfo(fileName: string): Promise<StorageFileInfo | null> {
  const supabase = createClient();

  try {
    // List the specific file to get metadata
    const { data: files, error } = await supabase.storage
      .from('images')
      .list('', {
        search: fileName
      });

    if (error) {
      console.error('Storage list error:', error);
      return null;
    }

    const file = files?.find(f => f.name === fileName);
    if (!file || !file.metadata) {
      return null;
    }

    return {
      name: file.name,
      size: file.metadata.size || file.metadata.contentLength || 0,
      mimetype: file.metadata.mimetype || 'unknown',
      lastModified: file.metadata.lastModified || file.updated_at
    };
  } catch (error) {
    console.error('Get storage file info error:', error);
    return null;
  }
}

/**
 * Sync file sizes from storage to database for images missing metadata
 */
export async function syncFileSizesFromStorage(): Promise<SyncResult> {
  const supabase = createClient();
  const result: SyncResult = {
    success: true,
    updated: 0,
    errors: [],
    skipped: 0,
    totalProcessed: 0
  };

  try {
    // Get images that are missing file size data
    const { data: images, error: fetchError } = await supabase
      .from('images')
      .select('id, storage_path, file_size_bytes')
      .neq('category', 'external')
      .is('file_size_bytes', null);

    if (fetchError) {
      result.success = false;
      result.errors.push(`Failed to fetch images: ${fetchError.message}`);
      return result;
    }

    if (!images || images.length === 0) {
      console.log('No images need file size sync');
      return result;
    }

    console.log(`Syncing file sizes for ${images.length} images...`);

    // Process images in batches to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < images.length; i += batchSize) {
      const batch = images.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (image) => {
        try {
          if (!image.storage_path) {
            result.skipped++;
            return;
          }

          const fileInfo = await getStorageFileInfo(image.storage_path);
          
          if (!fileInfo) {
            result.errors.push(`Could not get file info for ${image.storage_path}`);
            return;
          }

          // Update database with file size
          const { error: updateError } = await supabase
            .from('images')
            .update({ 
              file_size_bytes: fileInfo.size,
              // Also update file_type if it's missing
              file_type: fileInfo.mimetype
            })
            .eq('id', image.id);

          if (updateError) {
            result.errors.push(`Failed to update ${image.id}: ${updateError.message}`);
          } else {
            result.updated++;
            console.log(`Updated ${image.storage_path}: ${fileInfo.size} bytes`);
          }
        } catch (error) {
          result.errors.push(`Error processing ${image.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }));

      // Small delay between batches to be nice to the API
      if (i + batchSize < images.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    if (result.errors.length > 0) {
      result.success = false;
    }

    result.totalProcessed = result.updated + result.skipped + result.errors.length;

    console.log(`Sync complete: ${result.updated} updated, ${result.skipped} skipped, ${result.errors.length} errors`);
    return result;

  } catch (error) {
    result.success = false;
    result.errors.push(`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return result;
  }
}

/**
 * Validate that database file sizes match storage
 */
export async function validateFileSizes(): Promise<{ matches: number; mismatches: Array<{ id: string; dbSize: number; storageSize: number }> }> {
  const supabase = createClient();
  const result = {
    matches: 0,
    mismatches: [] as Array<{ id: string; dbSize: number; storageSize: number }>
  };

  try {
    // Get a sample of images with file sizes
    const { data: images, error } = await supabase
      .from('images')
      .select('id, storage_path, file_size_bytes')
      .neq('category', 'external')
      .not('file_size_bytes', 'is', null)
      .limit(20);

    if (error || !images) {
      console.error('Failed to fetch images for validation:', error);
      return result;
    }

    for (const image of images) {
      if (!image.storage_path) continue;

      const fileInfo = await getStorageFileInfo(image.storage_path);
      if (!fileInfo) continue;

      if (fileInfo.size === image.file_size_bytes) {
        result.matches++;
      } else {
        result.mismatches.push({
          id: image.id,
          dbSize: image.file_size_bytes,
          storageSize: fileInfo.size
        });
      }
    }

    return result;
  } catch (error) {
    console.error('Validation failed:', error);
    return result;
  }
}
