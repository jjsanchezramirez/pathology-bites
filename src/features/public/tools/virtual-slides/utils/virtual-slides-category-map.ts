/**
 * Category color and short form mapping specifically for Virtual Slides
 * This ensures consistent display across the virtual slides interface
 */

export interface VirtualSlideCategory {
  name: string;
  shortForm: string;
  color: string;
}

// Comprehensive mapping for all virtual slide categories
export const VIRTUAL_SLIDE_CATEGORIES: Record<string, VirtualSlideCategory> = {
  "Bone and Soft Tissue": {
    name: "Bone and Soft Tissue",
    shortForm: "BST",
    color: "hsl(220 85% 55%)", // Blue
  },
  Breast: {
    name: "Breast",
    shortForm: "Breast",
    color: "hsl(262 75% 55%)", // Purple
  },
  Cardiovascular: {
    name: "Cardiovascular",
    shortForm: "Cardio",
    color: "hsl(5 80% 55%)", // Red
  },
  Cytology: {
    name: "Cytology",
    shortForm: "Cyto",
    color: "hsl(340 75% 50%)", // Pink
  },
  Dermatopathology: {
    name: "Dermatopathology",
    shortForm: "Derm",
    color: "hsl(32 90% 55%)", // Orange
  },
  "Endocrine and Neuroendocrine": {
    name: "Endocrine and Neuroendocrine",
    shortForm: "Endo",
    color: "hsl(142 70% 45%)", // Green
  },
  Gastrointestinal: {
    name: "Gastrointestinal",
    shortForm: "GI",
    color: "hsl(45 85% 50%)", // Yellow
  },
  Genitourinary: {
    name: "Genitourinary",
    shortForm: "GU",
    color: "hsl(200 80% 50%)", // Sky Blue
  },
  Gynecologic: {
    name: "Gynecologic",
    shortForm: "Gyn",
    color: "hsl(5 80% 55%)", // Red
  },
  "Head and Neck": {
    name: "Head and Neck",
    shortForm: "H&N",
    color: "hsl(160 65% 45%)", // Emerald
  },
  Hematopathology: {
    name: "Hematopathology",
    shortForm: "Heme",
    color: "hsl(32 90% 75%)", // Light Orange
  },
  "Hepatobiliary and Pancreas": {
    name: "Hepatobiliary and Pancreas",
    shortForm: "HBP",
    color: "hsl(240 70% 58%)", // Indigo
  },
  Neuropathology: {
    name: "Neuropathology",
    shortForm: "Neuro",
    color: "hsl(60 70% 50%)", // Lime
  },
  Pediatric: {
    name: "Pediatric",
    shortForm: "Peds",
    color: "hsl(180 60% 40%)", // Cyan
  },
  Placental: {
    name: "Placental",
    shortForm: "Placenta",
    color: "hsl(280 70% 50%)", // Magenta
  },
  Thoracic: {
    name: "Thoracic",
    shortForm: "Thorax",
    color: "hsl(120 70% 45%)", // Green
  },
};

/**
 * Get category information for a virtual slide category name
 * Returns the short form and color for display
 */
export function getVirtualSlideCategoryInfo(categoryName: string): VirtualSlideCategory {
  // Try exact match first
  if (VIRTUAL_SLIDE_CATEGORIES[categoryName]) {
    return VIRTUAL_SLIDE_CATEGORIES[categoryName];
  }

  // Try case-insensitive match
  const normalizedName = categoryName.trim();
  const matchedKey = Object.keys(VIRTUAL_SLIDE_CATEGORIES).find(
    (key) => key.toLowerCase() === normalizedName.toLowerCase()
  );

  if (matchedKey) {
    return VIRTUAL_SLIDE_CATEGORIES[matchedKey];
  }

  // Fallback for unknown categories
  return {
    name: categoryName,
    shortForm: categoryName,
    color: "hsl(220 85% 55%)", // Default blue
  };
}
