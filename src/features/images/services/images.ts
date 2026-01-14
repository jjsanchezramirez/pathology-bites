// src/lib/images/images.ts
import { createClient } from "@/shared/services/client";
import type { ImageData } from "@/features/images/types/images";
import { apiClient } from "@/shared/utils/api-client";

// Very aggressive client-side cache to reduce Supabase queries
interface CacheEntry {
  data: ImageData[];
  total: number;
  timestamp: number;
}

const imageQueryCache = new Map<string, CacheEntry>();
const CACHE_TTL = 60 * 60 * 1000; // 60 minutes cache (1 hour)

function getCacheKey(params: {
  page: number;
  pageSize: number;
  searchTerm?: string;
  category?: string;
  showUnusedOnly?: boolean;
  showUncategorizedOnly?: boolean;
  includeOnlyMicroscopicAndGross?: boolean;
}): string {
  return JSON.stringify({
    page: params.page,
    pageSize: params.pageSize,
    search: params.searchTerm || "",
    category: params.category || "",
    unused: params.showUnusedOnly || false,
    uncategorized: params.showUncategorizedOnly || false,
    microGross: params.includeOnlyMicroscopicAndGross || false,
  });
}

function cleanExpiredCache() {
  const now = Date.now();
  const keysToDelete: string[] = [];

  imageQueryCache.forEach((entry, key) => {
    if (now - entry.timestamp > CACHE_TTL) {
      keysToDelete.push(key);
    }
  });

  keysToDelete.forEach((key) => imageQueryCache.delete(key));

  // Keep cache size under 500 entries (increased from 100)
  if (imageQueryCache.size > 500) {
    const entries = Array.from(imageQueryCache.entries());
    entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
    const toKeep = entries.slice(0, 500);
    imageQueryCache.clear();
    toKeep.forEach(([key, value]) => imageQueryCache.set(key, value));
  }
}

// Function to invalidate all image cache (call after updates/deletes/uploads)
export function invalidateImageCache() {
  imageQueryCache.clear();
  console.log("[Images] Cache invalidated");
}

export async function deleteImage(imagePath: string | null, imageId: string) {
  try {
    console.log("🗑️ Deleting image:", { imageId, imagePath });

    const url = "/api/media/images/delete";
    console.log("📡 Making DELETE request to:", url);

    const response = await apiClient.delete(url, {
      imageId,
      imagePath,
    });

    console.log("📥 Delete response:", {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get("content-type"),
    });

    if (!response.ok) {
      // Check if response is HTML (error page) or JSON
      const contentType = response.headers.get("content-type");
      console.log("❌ Error response content-type:", contentType);

      if (contentType && contentType.includes("text/html")) {
        const htmlText = await response.text();
        console.error("❌ Received HTML error page instead of JSON:", htmlText.substring(0, 500));
        throw new Error(
          `Server error (${response.status}): Received HTML error page instead of JSON response`
        );
      }

      try {
        const errorData = await response.json();
        console.log("❌ Error data:", errorData);
        throw new Error(errorData.error || "Failed to delete image");
      } catch (parseError) {
        console.error("❌ Failed to parse error response as JSON:", parseError);
        const responseText = await response.text();
        console.error("❌ Raw response text:", responseText.substring(0, 500));
        throw new Error(`Server error (${response.status}): ${response.statusText}`);
      }
    }

    // Try to parse success response
    try {
      const result = await response.json();
      console.log("✅ Delete successful:", result);
      return result;
    } catch (parseError) {
      console.error("❌ Failed to parse success response as JSON:", parseError);
      const responseText = await response.text();
      console.error("❌ Raw success response text:", responseText.substring(0, 500));
      throw new Error("Failed to parse server response");
    }
  } catch (error) {
    console.error("Delete image error:", error);
    throw error;
  }
}

export async function updateImage(
  imageId: string,
  data: {
    description: string;
    alt_text: string;
    category: string;
    source_ref?: string;
    pathology_category_id?: string | null;
    magnification?: string | null;
  }
) {
  const supabase = createClient(); // Remove <Database>

  try {
    const { error } = await supabase.from("images").update(data).eq("id", imageId);

    if (error) {
      console.error("Update image error:", error);
      throw new Error(`Failed to update image: ${error.message}`);
    }

    // Invalidate cache after successful update
    invalidateImageCache();

    return { success: true };
  } catch (error) {
    console.error("Update image error:", error);
    throw error;
  }
}

export async function fetchImages(params: {
  page: number;
  pageSize: number;
  searchTerm?: string;
  category?: string;
  showUnusedOnly?: boolean;
  showUncategorizedOnly?: boolean;
  includeOnlyMicroscopicAndGross?: boolean;
  skipCount?: boolean; // New param to skip count query on pagination
}) {
  const {
    page,
    pageSize,
    searchTerm,
    category,
    showUnusedOnly,
    showUncategorizedOnly,
    includeOnlyMicroscopicAndGross,
    skipCount,
  } = params;

  // Check cache first
  const cacheKey = getCacheKey(params);
  const now = Date.now();
  const cachedEntry = imageQueryCache.get(cacheKey);

  if (cachedEntry && now - cachedEntry.timestamp < CACHE_TTL) {
    console.log("[Images] Cache hit:", cacheKey.substring(0, 100));
    return {
      data: cachedEntry.data,
      total: cachedEntry.total,
      error: null,
      cached: true,
    };
  }

  // Clean expired cache entries periodically
  cleanExpiredCache();

  const supabase = createClient(); // Remove <Database>

  try {
    // Choose the appropriate table/view based on filter
    const tableName = showUnusedOnly ? "v_orphaned_images" : "images";

    // Build the base query for data first
    // Include pathology category information via join
    let dataQuery = supabase
      .from(tableName)
      .select("*, pathology_category:categories(id, name, short_form)");

    // Exclude external images from management table (only for regular images table)
    if (!showUnusedOnly) {
      dataQuery = dataQuery.neq("category", "external");
    }

    // Filter to only microscopic and gross images if requested
    if (includeOnlyMicroscopicAndGross && !showUnusedOnly) {
      dataQuery = dataQuery.in("category", ["microscopic", "gross"]);
    }

    // Apply filters to data query
    if (searchTerm && searchTerm.trim()) {
      const cleanSearchTerm = searchTerm.trim();

      // Use the correct Supabase .or() syntax based on working examples in the codebase
      // This matches the pattern used in other parts of the application
      dataQuery = dataQuery.or(
        `alt_text.ilike.%${cleanSearchTerm}%,description.ilike.%${cleanSearchTerm}%,source_ref.ilike.%${cleanSearchTerm}%`
      );
    }

    // Apply category filter (only for regular images, not unused filter)
    if (category && category !== "all" && !showUnusedOnly) {
      dataQuery = dataQuery.eq("category", category);
    }

    // Filter for uncategorized images (images without a pathology_category_id)
    if (showUncategorizedOnly && !showUnusedOnly) {
      dataQuery = dataQuery.is("pathology_category_id", null);
    }

    // Calculate pagination
    const from = page * pageSize;
    const to = from + pageSize - 1;

    // Execute data query first
    const dataResult = await dataQuery.order("created_at", { ascending: false }).range(from, to);

    if (dataResult.error) {
      console.error("Data query error:", {
        error: dataResult.error,
        message: dataResult.error?.message,
        details: dataResult.error?.details,
        hint: dataResult.error?.hint,
        code: dataResult.error?.code,
        params: {
          page,
          pageSize,
          searchTerm,
          category,
          showUnusedOnly,
          includeOnlyMicroscopicAndGross,
        },
      });
      return {
        data: [],
        total: 0,
        error: `Failed to fetch images: ${dataResult.error?.message || "Unknown error"}`,
      };
    }

    const images = dataResult.data || [];

    // Skip count query if requested (for pagination)
    if (skipCount) {
      return {
        data: images,
        total: null, // Caller should use cached count
        error: null,
      };
    }

    // Build count query with same filters (only when filters change)
    let countQuery = supabase.from(tableName).select("*", { count: "exact", head: true });

    // Apply same filters as data query
    if (!showUnusedOnly) {
      countQuery = countQuery.neq("category", "external");
    }

    if (includeOnlyMicroscopicAndGross && !showUnusedOnly) {
      countQuery = countQuery.in("category", ["microscopic", "gross"]);
    }

    if (searchTerm && searchTerm.trim()) {
      const cleanSearchTerm = searchTerm.trim();
      countQuery = countQuery.or(
        `alt_text.ilike.%${cleanSearchTerm}%,description.ilike.%${cleanSearchTerm}%,source_ref.ilike.%${cleanSearchTerm}%`
      );
    }

    if (category && category !== "all" && !showUnusedOnly) {
      countQuery = countQuery.eq("category", category);
    }

    // Filter for uncategorized images in count query
    if (showUncategorizedOnly && !showUnusedOnly) {
      countQuery = countQuery.is("pathology_category_id", null);
    }

    // Execute count query
    const countResult = await countQuery;

    if (countResult.error) {
      console.error("Count query error:", countResult.error);
      // Fall back to estimation if count fails
      const hasMoreData = images.length === pageSize;
      const total = hasMoreData ? (page + 1) * pageSize + 1 : page * pageSize + images.length;

      return {
        data: images,
        total: total,
        error: null,
      };
    }

    const total = countResult.count || 0;

    // Cache the successful result
    imageQueryCache.set(cacheKey, {
      data: images,
      total: total,
      timestamp: Date.now(),
    });
    console.log("[Images] Cached result:", cacheKey.substring(0, 100));

    return {
      data: images,
      total: total,
      error: null,
    };
  } catch (error) {
    console.error("Fetch images error:", error);
    return {
      data: [],
      total: 0,
      error: error instanceof Error ? error.message : "Unknown error occurred",
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
    formData.append("file", file);
    formData.append("category", metadata.category);
    formData.append("description", metadata.description);
    if (metadata.source_ref) formData.append("sourceRef", metadata.source_ref);

    const response = await fetch("/api/media/images/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Upload failed");
    }

    const result = await response.json();
    return result.image;
  } catch (error) {
    console.error("Upload image error:", error);
    throw error;
  }
}

export async function getImageById(imageId: string): Promise<ImageData | null> {
  const supabase = createClient(); // Remove <Database>

  try {
    const { data, error } = await supabase.from("images").select("*").eq("id", imageId).single();

    if (error) {
      if (error.code === "PGRST116") {
        // No rows returned
        return null;
      }
      console.error("Get image by ID error:", error);
      throw new Error(`Failed to fetch image: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error("Get image by ID error:", error);
    throw error;
  }
}

export async function createExternalImage(url: string, createdBy?: string): Promise<ImageData> {
  const supabase = createClient();

  try {
    const { data: imageData, error: dbError } = await supabase
      .from("images")
      .insert({
        url,
        category: "external",
        created_by: createdBy || null,
        // All other fields (storage_path, file_type, alt_text, description, source_ref) will be null
      })
      .select()
      .single();

    if (dbError) {
      console.error("Create external image error:", dbError);
      throw new Error(`Failed to create external image: ${dbError.message}`);
    }

    return imageData;
  } catch (error) {
    console.error("Create external image error:", error);
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
      .from("images")
      .select("*")
      .eq("url", url)
      .eq("category", "external")
      .single();

    if (selectError && selectError.code !== "PGRST116") {
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
    console.error("Create external image if not exists error:", error);
    throw error;
  }
}

export async function bulkDeleteImages(
  imageIds: string[]
): Promise<{ success: boolean; deleted: number; errors: string[] }> {
  try {
    if (imageIds.length === 0) {
      return { success: true, deleted: 0, errors: [] };
    }

    const response = await fetch("/api/media/images/bulk-delete", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // Ensure cookies are sent
      body: JSON.stringify({
        imageIds,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to delete images");
    }

    const result = await response.json();

    return {
      success: result.success,
      deleted: result.results.deleted.length,
      errors: result.results.storageErrors || [],
    };
  } catch (error) {
    console.error("Bulk delete images error:", error);
    return {
      success: false,
      deleted: 0,
      errors: [error instanceof Error ? error.message : "Unknown error"],
    };
  }
}
