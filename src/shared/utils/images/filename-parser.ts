// Filename parser for extracting pathology category and magnification from image filenames
// Expected format examples:
// - "BST - Osteoid osteoma @10x.jpg" -> category: Bone & Soft Tissue, title: "Osteoid osteoma", magnification: "10x"
// - "Bone & Soft Tissue - Giant cell tumor @20x.jpg" -> category: Bone & Soft Tissue, title: "Giant cell tumor", magnification: "20x"
// - "GI - Crohn disease.jpg" -> category: Gastrointestinal, title: "Crohn disease", magnification: null

import { CATEGORIES, getCategoryByName } from "@/shared/config/categories";

export interface ParsedFilename {
  title: string;
  categoryId: string | null;
  categoryName: string | null;
  magnification: string | null;
}

// Valid magnification values
const VALID_MAGNIFICATIONS = ["2x", "5x", "10x", "20x", "40x", "50x", "60x"] as const;
export type Magnification = (typeof VALID_MAGNIFICATIONS)[number];

/**
 * Extract magnification from filename (format: @10x, @20x, etc.)
 * @param filename - The filename to parse
 * @returns The magnification string or null if not found
 */
export function extractMagnification(filename: string): Magnification | null {
  // Look for pattern like @10x, @20x, etc.
  const magnificationMatch = filename.match(/@(\d+x)/i);
  if (magnificationMatch) {
    const mag = magnificationMatch[1].toLowerCase() as string;
    // Validate it's a valid magnification
    if (VALID_MAGNIFICATIONS.includes(mag as Magnification)) {
      return mag as Magnification;
    }
  }
  return null;
}

/**
 * Extract category from the beginning of the filename using static category data
 * @param filename - The filename to parse
 * @returns Object with category ID and name, or nulls if not found
 */
export function extractCategory(filename: string): { id: string; name: string } | null {
  // Remove file extension
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");

  // Look for pattern like "BST - " or "Bone & Soft Tissue - " at the start
  const categoryMatch = nameWithoutExt.match(/^([^-@]+?)\s*-/);
  if (categoryMatch) {
    const potentialCategory = categoryMatch[1].trim();

    // Try to find the category by name or short form using the static helper
    const category = getCategoryByName(potentialCategory);
    if (category) {
      return { id: category.id, name: category.name };
    }
  }

  return null;
}

/**
 * Extract the clean title from filename (removes category, magnification, and extension)
 * @param filename - The filename to parse
 * @returns The cleaned title
 */
export function extractTitle(filename: string): string {
  // Remove file extension
  let title = filename.replace(/\.[^/.]+$/, "");

  // Remove magnification (e.g., @10x)
  title = title.replace(/@\d+x/gi, "");

  // Remove category prefix (e.g., "BST - " or "Bone and soft tissue - ")
  title = title.replace(/^[^-@]+?\s*-\s*/, "");

  // Clean up: trim, replace multiple spaces with single space
  title = title.trim().replace(/\s+/g, " ");

  // Convert to sentence case (capitalize first letter, rest lowercase)
  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1).toLowerCase();
  }

  return title || "Untitled";
}

/**
 * Parse filename to extract all components: title, category, and magnification
 * @param filename - The filename to parse
 * @returns ParsedFilename object with extracted components
 */
export function parseImageFilename(filename: string): ParsedFilename {
  const category = extractCategory(filename);

  return {
    title: extractTitle(filename),
    categoryId: category?.id || null,
    categoryName: category?.name || null,
    magnification: extractMagnification(filename),
  };
}

/**
 * Get all available categories for documentation/reference
 * @returns Array of all category configurations
 */
export function getAllCategories() {
  return CATEGORIES;
}
