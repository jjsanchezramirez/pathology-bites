// src/shared/services/r2-storage-metrics.ts

import { createClient } from "@/shared/services/server";

/**
 * Increment storage metrics after successful upload
 *
 * This is a FIRE-AND-FORGET operation - errors are logged but won't fail the upload
 * Runs asynchronously and won't block the response
 */
export async function incrementStorageMetrics(
  bucketName: string,
  sizeBytes: number
): Promise<void> {
  try {
    const supabase = createClient();

    const { error } = await supabase.rpc("increment_r2_metrics", {
      p_bucket_name: bucketName,
      p_size_bytes: sizeBytes,
    });

    if (error) {
      // Log warning but don't throw - metrics are non-critical
      console.warn(`[R2 Metrics] Failed to increment ${bucketName}:`, error.message);
      // TODO: Could send to error monitoring (Sentry, etc.)
    } else {
      console.log(`[R2 Metrics] ✓ Incremented ${bucketName} by ${sizeBytes} bytes`);
    }
  } catch (err) {
    // Catch-all to prevent any metric errors from breaking uploads
    console.error(`[R2 Metrics] Unexpected error incrementing ${bucketName}:`, err);
  }
}

/**
 * Decrement storage metrics after successful deletion
 *
 * This is a FIRE-AND-FORGET operation - errors are logged but won't fail the delete
 */
export async function decrementStorageMetrics(
  bucketName: string,
  sizeBytes: number
): Promise<void> {
  try {
    const supabase = createClient();

    const { error } = await supabase.rpc("decrement_r2_metrics", {
      p_bucket_name: bucketName,
      p_size_bytes: sizeBytes,
    });

    if (error) {
      console.warn(`[R2 Metrics] Failed to decrement ${bucketName}:`, error.message);
    } else {
      console.log(`[R2 Metrics] ✓ Decremented ${bucketName} by ${sizeBytes} bytes`);
    }
  } catch (err) {
    console.error(`[R2 Metrics] Unexpected error decrementing ${bucketName}:`, err);
  }
}

/**
 * Get cached storage metrics from database (FAST - <100ms)
 *
 * Replaces the slow getBucketSize() that scans all R2 objects
 *
 * @param bucketName - Optional bucket name to filter by
 * @param supabaseClient - Optional Supabase client (for service role access)
 */
export async function getCachedStorageMetrics(
  bucketName?: string,
  supabaseClient?: ReturnType<typeof createClient>
): Promise<
  Array<{
    bucketName: string;
    totalSize: number;
    objectCount: number;
    lastUpdated: string;
  }>
> {
  const supabase = supabaseClient || createClient();

  let query = supabase
    .from("r2_storage_metrics")
    .select("bucket_name, total_size_bytes, object_count, last_updated")
    .order("bucket_name");

  if (bucketName) {
    query = query.eq("bucket_name", bucketName);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[R2 Metrics] Failed to fetch cached metrics:", error);
    throw error;
  }

  return (data || []).map((row) => ({
    bucketName: row.bucket_name,
    totalSize: row.total_size_bytes,
    objectCount: row.object_count,
    lastUpdated: row.last_updated,
  }));
}

/**
 * Example usage in upload API:
 *
 * // After successful R2 upload
 * await uploadToR2(file, path);
 *
 * // Update metrics (fire-and-forget - don't await)
 * incrementStorageMetrics('pathology-bites-images', file.size).catch(console.error);
 *
 * // OR if you want to track it:
 * await incrementStorageMetrics('pathology-bites-images', file.size);
 * // (adds ~20-50ms but ensures metric is updated before response)
 */
