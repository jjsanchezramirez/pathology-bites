import { createClient } from "@/shared/services/client";
import type {
  InteractiveSequence,
  InteractiveSequenceListFilters,
  CreateInteractiveSequenceParams,
  UpdateInteractiveSequenceParams,
} from "../types";

/**
 * Fetch all interactive sequences with optional filters
 */
export async function fetchInteractiveSequences(
  filters?: InteractiveSequenceListFilters
): Promise<InteractiveSequence[]> {
  const supabase = createClient();

  let query = supabase
    .from("interactive_sequences")
    .select("*")
    .order("created_at", { ascending: false });

  // Apply filters
  if (filters?.category_id) {
    query = query.eq("category_id", filters.category_id);
  }

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  if (filters?.created_by) {
    query = query.eq("created_by", filters.created_by);
  }

  if (filters?.search) {
    // Use full-text search vector for better performance
    query = query.textSearch("search_vector", filters.search);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching interactive sequences:", error);
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Fetch a single interactive sequence by ID
 */
export async function fetchInteractiveSequenceById(
  id: string
): Promise<InteractiveSequence | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("interactive_sequences")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching interactive sequence by ID:", error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Create a new interactive sequence
 */
export async function createInteractiveSequence(
  params: CreateInteractiveSequenceParams
): Promise<InteractiveSequence> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("interactive_sequences")
    .insert({
      title: params.title,
      description: params.description || null,
      sequence_data: params.sequence_data,
      category_id: params.category_id || null,
      status: params.status || "draft",
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating interactive sequence:", error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Update an existing interactive sequence
 */
export async function updateInteractiveSequence(
  params: UpdateInteractiveSequenceParams
): Promise<InteractiveSequence> {
  const supabase = createClient();

  const updates: Partial<InteractiveSequence> = {};

  if (params.title !== undefined) updates.title = params.title;
  if (params.description !== undefined) updates.description = params.description;
  if (params.sequence_data !== undefined) updates.sequence_data = params.sequence_data;
  if (params.category_id !== undefined) updates.category_id = params.category_id;
  if (params.status !== undefined) updates.status = params.status;

  const { data, error } = await supabase
    .from("interactive_sequences")
    .update(updates)
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    console.error("Error updating interactive sequence:", error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Delete an interactive sequence
 */
export async function deleteInteractiveSequence(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from("interactive_sequences").delete().eq("id", id);

  if (error) {
    console.error("Error deleting interactive sequence:", error);
    throw new Error(error.message);
  }
}

/**
 * Get interactive sequence statistics
 */
export async function getInteractiveSequenceStats(): Promise<{
  total: number;
  byStatus: { draft: number; published: number; archived: number };
}> {
  const supabase = createClient();

  const { data, error } = await supabase.from("interactive_sequences").select("status");

  if (error) {
    console.error("Error fetching interactive sequence stats:", error);
    throw new Error(error.message);
  }

  const stats = {
    total: data.length,
    byStatus: {
      draft: data.filter((s) => s.status === "draft").length,
      published: data.filter((s) => s.status === "published").length,
      archived: data.filter((s) => s.status === "archived").length,
    },
  };

  return stats;
}
