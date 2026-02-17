import { createClient } from "@/shared/services/client";
import type { Audio, AudioListFilters } from "../types";

/**
 * Fetch all audio files with optional filters
 */
export async function fetchAudio(filters?: AudioListFilters): Promise<Audio[]> {
  const supabase = createClient();

  let query = supabase.from("audio").select("*").order("created_at", { ascending: false });

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
    throw new Error(error.message);
  }

  return data || [];
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
 */
export async function getAudioStats(): Promise<{
  total: number;
  totalSizeBytes: number;
}> {
  const supabase = createClient();

  const { data, error } = await supabase.from("audio").select("file_size_bytes");

  if (error) {
    console.error("Error fetching audio stats:", error);
    throw new Error(error.message);
  }

  const stats = {
    total: data.length,
    totalSizeBytes: data.reduce((sum, audio) => sum + (audio.file_size_bytes || 0), 0),
  };

  return stats;
}
