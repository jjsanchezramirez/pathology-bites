// Image usage analytics service
import { createClient } from '@/shared/services/client';
import { formatSize } from './image-upload';

export interface ImageUsageStats {
  id: string;
  url: string;
  alt_text: string | null;
  description: string | null;
  category: string;
  file_size_bytes: number | null;
  width: number | null;
  height: number | null;
  created_at: string;
  usage_count: number;
  used_in_questions: string[];
  is_orphaned: boolean;
  formatted_size: string;
  dimensions_text: string;
}

export interface StorageStats {
  total_images: number;
  total_size_bytes: number;
  formatted_total_size: string;
  by_category: {
    category: string;
    count: number;
    size_bytes: number;
    formatted_size: string;
  }[];
  orphaned_count: number;
  orphaned_size_bytes: number;
  formatted_orphaned_size: string;
}

export async function getImageUsageStats(): Promise<ImageUsageStats[]> {
  const supabase = createClient();

  try {
    // Use the standardized view with v_ prefix
    const { data, error } = await supabase
      .from('v_image_usage_stats')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error fetching v_image_usage_stats:', error);
      throw error;
    }

    // Process the data to add formatted fields
    const usageStats: ImageUsageStats[] = (data || []).map(image => ({
      id: image.id,
      url: image.url,
      alt_text: image.alt_text,
      description: image.description,
      category: image.category,
      file_size_bytes: image.file_size_bytes,
      width: image.width,
      height: image.height,
      created_at: image.created_at,
      usage_count: image.usage_count,
      used_in_questions: image.question_ids || [],
      is_orphaned: image.is_orphaned,
      formatted_size: image.file_size_bytes ? formatSize(image.file_size_bytes) : 'Unknown',
      dimensions_text: image.width && image.height ? `${image.width} × ${image.height}` : 'Unknown'
    }));

    return usageStats;
  } catch (error) {
    console.error('Get image usage stats error:', error);
    // Return empty array instead of throwing to prevent UI crashes
    return [];
  }
}

export async function getOrphanedImages(): Promise<ImageUsageStats[]> {
  try {
    const stats = await getImageUsageStats();
    return stats.filter(stat => stat.is_orphaned);
  } catch (error) {
    console.error('Get orphaned images error:', error);
    // Return empty array instead of throwing to prevent UI crashes
    return [];
  }
}

export async function getStorageStats(): Promise<StorageStats> {
  const supabase = createClient();

  try {
    // Use the standardized view with v_ prefix
    const { data, error } = await supabase
      .from('v_storage_stats')
      .select('*')
      .single();

    if (error) {
      console.error('Supabase error fetching v_storage_stats:', error);
      throw error;
    }

    // Format the category stats
    const categoryStats = [
      {
        category: 'microscopic',
        count: data.microscopic_count,
        size_bytes: data.microscopic_size_bytes,
        formatted_size: formatSize(data.microscopic_size_bytes)
      },
      {
        category: 'gross',
        count: data.gross_count,
        size_bytes: data.gross_size_bytes,
        formatted_size: formatSize(data.gross_size_bytes)
      },
      {
        category: 'figure',
        count: data.figure_count,
        size_bytes: data.figure_size_bytes,
        formatted_size: formatSize(data.figure_size_bytes)
      },
      {
        category: 'table',
        count: data.table_count,
        size_bytes: data.table_size_bytes,
        formatted_size: formatSize(data.table_size_bytes)
      }
    ].filter(stat => stat.count > 0); // Only include categories with images

    return {
      total_images: data.total_images,
      total_size_bytes: data.total_size_bytes,
      formatted_total_size: formatSize(data.total_size_bytes),
      by_category: categoryStats,
      orphaned_count: data.orphaned_count,
      orphaned_size_bytes: data.orphaned_size_bytes,
      formatted_orphaned_size: formatSize(data.orphaned_size_bytes)
    };
  } catch (error) {
    console.error('Get storage stats error:', error);
    // Return default stats instead of throwing to prevent UI crashes
    return {
      total_images: 0,
      total_size_bytes: 0,
      formatted_total_size: '0 Bytes',
      by_category: [],
      orphaned_count: 0,
      orphaned_size_bytes: 0,
      formatted_orphaned_size: '0 Bytes'
    };
  }
}
