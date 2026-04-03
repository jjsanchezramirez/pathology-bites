import { createClient } from "@/shared/services/client";
import type { Audio, AudioListFilters } from "../types";

/**
 * Fetch audio files with optional filters and server-side pagination
 */
export async function fetchAudio(
  filters?: AudioListFilters
): Promise<{ data: Audio[]; total: number; error: string | null }> {
  const supabase = createClient();

  const page = filters?.page ?? 0;
  const pageSize = filters?.pageSize ?? 10;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("audio")
    .select("*")
    .order("created_at", { ascending: false })
    .range(from, to);

  // Apply filters
  if (filters?.pathology_category_id) {
    query = query.eq("pathology_category_id", filters.pathology_category_id);
  }

  if (filters?.search) {
    query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching audio:", error);
    return { data: [], total: 0, error: error.message };
  }

  // Separate count query with same filters
  let countQuery = supabase.from("audio").select("*", { count: "exact", head: true });

  if (filters?.pathology_category_id) {
    countQuery = countQuery.eq("pathology_category_id", filters.pathology_category_id);
  }

  if (filters?.search) {
    countQuery = countQuery.or(
      `title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
    );
  }

  const { count, error: countError } = await countQuery;

  if (countError) {
    console.error("Error fetching audio count:", countError);
  }

  return { data: data || [], total: count ?? 0, error: null };
}

/**
 * Fetch a single audio file by ID
 */
export async function fetchAudioById(id: string): Promise<Audio | null> {
  const supabase = createClient();

  const { data, error } = await supabase.from("audio").select("*").eq("id", id).single();

  if (error) {
    console.error("Error fetching audio by ID:", error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Update audio metadata
 */
export async function updateAudio(
  id: string,
  updates: Partial<Omit<Audio, "id" | "created_at" | "updated_at">>
): Promise<Audio> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("audio")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating audio:", error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Delete audio file from database
 * Note: This does not delete from R2 storage
 */
export async function softDeleteAudio(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from("audio").delete().eq("id", id);

  if (error) {
    console.error("Error deleting audio:", error);
    throw new Error(error.message);
  }
}

/**
 * Get audio statistics
 * Uses database aggregate function for optimal performance (~10-50ms)
 */
export async function getAudioStats(): Promise<{
  total: number;
  totalSizeBytes: number;
}> {
  const supabase = createClient();

  // Use database function for server-side aggregation
  const { data, error } = await supabase.rpc("get_audio_aggregate_stats").single();

  if (error) {
    console.error("Error fetching audio stats:", error);
    throw new Error(error.message);
  }

  // Type assertion for RPC function return
  const result = data as { total_count: number; total_size_bytes: number } | null;

  return {
    total: Number(result?.total_count) || 0,
    totalSizeBytes: Number(result?.total_size_bytes) || 0,
  };
}
