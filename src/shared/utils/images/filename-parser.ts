// Filename parser for extracting metadata from image filenames
// Expected format: Title - Description [ImageCategory][PathologyCategory] magnification.ext
// Examples:
// - "Aerococcus BSA - Small colonies on agar [G][Micro] 40x.jpg"
// - "Osteoid osteoma - Bone tumor showing osteoid matrix [M][BST] 100x.jpg"
// - "Cell diagram [F][Cyto].jpg"

import { CATEGORIES, getCategoryByName } from "@/shared/config/categories";

export interface ParsedFilename {
  title: string;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  magnification: string | null;
  imageCategory: "microscopic" | "gross" | "figure" | "table" | "external" | null;
}

// Valid magnification values
const VALID_MAGNIFICATIONS = ["2x", "5x", "10x", "20x", "40x", "50x", "60x", "100x"] as const;
export type Magnification = (typeof VALID_MAGNIFICATIONS)[number];

// Alternative abbreviations for pathology categories
const CATEGORY_ALIASES: Record<string, string> = {
  Thor: "Thorax",
  HN: "H&N",
  TM: "BB/TM",
  Mol: "MoPath",
  Info: "Informatics",
  Mgmt: "Lab Mgmt",
};

// Image category abbreviations (single letter in brackets)
const IMAGE_CATEGORY_ALIASES: Record<
  string,
  "microscopic" | "gross" | "figure" | "table" | "external"
> = {
  M: "microscopic",
  G: "gross",
  F: "figure",
  T: "table",
  E: "external",
};

/**
 * Extract image category from filename
 * Looks for pattern: [M], [F], [T], [G], [E] (single letter in brackets)
 * @param filename - The filename to parse
 * @returns The image category or null if not found
 */
export function extractImageCategory(
  filename: string
): "microscopic" | "gross" | "figure" | "table" | "external" | null {
  // Look for pattern like [M], [F], [T], [G], [E]
  const imageCategoryMatch = filename.match(/\[([MFGTE])\]/i);
  if (imageCategoryMatch) {
    const letter = imageCategoryMatch[1].toUpperCase();
    return IMAGE_CATEGORY_ALIASES[letter] || null;
  }
  return null;
}

/**
 * Extract magnification from filename
 * Looks for pattern: " ###x" (space followed by digits and 'x')
 * Examples: " 10x", " 40x", " 100x"
 * @param filename - The filename to parse
 * @returns The magnification string or null if not found
 */
export function extractMagnification(filename: string): Magnification | null {
  // Look for pattern like " 10x", " 40x", " 100x" (space before digits)
  const magnificationMatch = filename.match(/\s(\d+x)\b/i);
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
 * Extract pathology category from bracketed notation
 * Only supports: [BST], [GI], [Micro], etc.
 * @param filename - The filename to parse
 * @returns Object with category ID and name, or null if not found
 */
export function extractCategory(filename: string): { id: string; name: string } | null {
  // Look for bracketed pathology categories
  // We need to find brackets that are NOT image categories [M][F][T][G][E]
  const allBrackets = filename.match(/\[([^\]]+)\]/g);

  if (!allBrackets) return null;

  // Filter out image category brackets
  const pathologyBrackets = allBrackets.filter((bracket) => {
    const content = bracket.slice(1, -1); // Remove [ and ]
    return !["M", "F", "T", "G", "E"].includes(content.toUpperCase());
  });

  if (pathologyBrackets.length === 0) return null;

  // Try to find a valid pathology category from the brackets
  for (const bracket of pathologyBrackets) {
    let potentialCategory = bracket.slice(1, -1).trim(); // Remove [ and ]

    // Check for alias (case-insensitive)
    const aliasKey = Object.keys(CATEGORY_ALIASES).find(
      (key) => key.toLowerCase() === potentialCategory.toLowerCase()
    );
    if (aliasKey) {
      potentialCategory = CATEGORY_ALIASES[aliasKey];
    }

    const category = getCategoryByName(potentialCategory);
    if (category) {
      return { id: category.id, name: category.name };
    }
  }

  return null;
}

/**
 * Extract title and description from filename
 * Format: "Title - Description [metadata]"
 * The " - " (space-dash-space) separates title from description
 * @param filename - The filename to parse
 * @returns Object with title and optional description
 */
export function extractTitleAndDescription(filename: string): {
  title: string;
  description: string | null;
} {
  // Remove file extension
  let content = filename.replace(/\.[^/.]+$/, "");

  // Remove magnification (e.g., " 10x", " 40x", " 100x")
  content = content.replace(/\s\d+x\b/gi, "");

  // Remove ALL bracketed content (image category [M], pathology category [BST], etc.)
  content = content.replace(/\[[^\]]+\]/g, "");

  // Clean up whitespace
  content = content.trim().replace(/\s+/g, " ");

  // Split on " - " (space-dash-space) to separate title and description
  const parts = content.split(" - ");

  if (parts.length === 1) {
    // No description, just title
    const title = parts[0].trim() || "Untitled";
    return {
      title,
      description: null,
    };
  }

  // First part is title, rest is description
  const title = parts[0].trim() || "Untitled";
  const description = parts.slice(1).join(" - ").trim() || null; // Rejoin in case description had " - "

  return {
    title,
    description,
  };
}

/**
 * Parse filename to extract all components: title, description, categories, and magnification
 * Format: "Title - Description [ImageCategory][PathologyCategory] magnification.ext"
 * @param filename - The filename to parse
 * @returns ParsedFilename object with extracted components
 */
export function parseImageFilename(filename: string): ParsedFilename {
  const pathologyCategory = extractCategory(filename);
  const imageCategory = extractImageCategory(filename);
  const { title, description } = extractTitleAndDescription(filename);

  return {
    title,
    description,
    categoryId: pathologyCategory?.id || null,
    categoryName: pathologyCategory?.name || null,
    magnification: extractMagnification(filename),
    imageCategory: imageCategory,
  };
}

/**
 * Parse audio filename to extract title, description, and pathology category
 * Format: "Title - Description [PathologyCategory].ext"
 * Note: Audio files don't have image category or magnification
 * @param filename - The filename to parse
 * @returns Object with title, description, and pathology category
 */
export function parseAudioFilename(filename: string): {
  title: string;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
} {
  const pathologyCategory = extractCategory(filename);
  const { title, description } = extractTitleAndDescription(filename);

  return {
    title,
    description,
    categoryId: pathologyCategory?.id || null,
    categoryName: pathologyCategory?.name || null,
  };
}

/**
 * Get all available categories for documentation/reference
 * @returns Array of all category configurations
 */
export function getAllCategories() {
  return CATEGORIES;
}
