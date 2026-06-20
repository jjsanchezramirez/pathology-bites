import { createClient } from "@/shared/services/client";
import type { SvgAsset, SvgListFilters } from "../types";
import { log } from "@/shared/utils/logging";

/**
 * Fetch SVG assets with optional filters and server-side pagination
 */
export async function fetchSvgAssets(
  filters?: SvgListFilters
): Promise<{ data: SvgAsset[]; total: number; error: string | null }> {
  const supabase = createClient();

  const page = filters?.page ?? 0;
  const pageSize = filters?.pageSize ?? 10;
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("svg_assets")
    .select("*")
    .order("created_at", { ascending: false })
    .range(from, to);

  // Apply filters
  if (filters?.category) {
    query = query.eq("category", filters.category);
  }

  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;

  if (error) {
    log.error("Error fetching SVG assets:", error);
    return { data: [], total: 0, error: error.message };
  }

  // Separate count query with same filters
  let countQuery = supabase.from("svg_assets").select("*", { count: "exact", head: true });

  if (filters?.category) {
    countQuery = countQuery.eq("category", filters.category);
  }

  if (filters?.search) {
    countQuery = countQuery.or(
      `name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
    );
  }

  const { count, error: countError } = await countQuery;

  if (countError) {
    log.error("Error fetching SVG assets count:", countError);
  }

  return { data: data || [], total: count ?? 0, error: null };
}

/**
 * Update SVG asset metadata
 */
export async function updateSvgAsset(
  id: string,
  updates: Partial<Omit<SvgAsset, "id" | "created_at" | "updated_at">>
): Promise<SvgAsset> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("svg_assets")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    log.error("Error updating SVG asset:", error);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Delete SVG asset from database
 * Note: This does not delete from R2 storage
 */
export async function deleteSvgAsset(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from("svg_assets").delete().eq("id", id);

  if (error) {
    log.error("Error deleting SVG asset:", error);
    throw new Error(error.message);
  }
}
