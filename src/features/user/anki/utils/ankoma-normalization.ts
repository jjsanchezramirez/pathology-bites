// Ankoma parser — category/subcategory name normalization + section merging.
import { AnkomaSection } from "../types/anki-card";

/**
 * Category/Subcategory normalization rules
 * Maps original names to normalized names for consistency
 */
const NAME_NORMALIZATIONS: Record<string, string> = {
  // AP -> Immunohistochemistry: Combine muscle variants
  Muscle: "Muscle",
  "Smooth Muscle": "Muscle",
  "Skeletal Muscle": "Muscle",
  // AP -> Immunohistochemistry: Fix typo
  Myfibroblastic: "Myofibroblastic",
  // AP -> Endocrine: Combine parathyroid variants
  "Parathyroid Adenoma": "Parathyroid",
  // AP -> Forensics: Fix parsing error
  "Natural Deaths#ANKOMA": "Natural Deaths",
  // AP -> Genitourinary: Fix parsing errors
  "Penisand Scrotum": "Penis & Scrotum",
  "Urothelial Tractand Bladder": "Urothelial Tract & Bladder",
  // CP -> Molecular Pathology
  "7.1 7.2": "Molecular Biology & Techniques",
  "7.3": "Non-Neoplastic Molecular Pathology",
  "7.4": "Neoplastic Molecular Pathology",
  // CP -> Medical Directorship
  CLIA88: "CLIA",
  "Professional Component Billing": "Billing",
  "Laboratory Test Panels": "Billing",
  "Billing Regulations": "Billing",
  "Quality Assurance": "Quality Control",
  "Quality Management": "Quality Control",
  "Quality Improvement": "Quality Control",
  "Statistical Quality Control": "Quality Control",
  "Medicareand Medicaid": "Medicare & Medicaid",
  // CP -> Immunology
  BCells: "B Cells",
  TCells: "T Cells",
  NKCells: "NK Cells",
  HLATesting: "HLA Testing",
  APCs: "Antigen Processing Cells",
  COmplement: "Complement System",
  // CP -> Chemistry
  "#techniques": "Techniques",
  proteins: "Protein Analysis",
  "Quick Compendium": "General Principles",
  preanalytical: "General Principles",
  miscellaneous: "General Principles",
  // CP -> Transfusion Medicine
  "QUick Compendium": "General Principles",
  "Special Circumstances": "General Principles",
  Extras: "General Principles",
  "Passenger Lymphocytes Syndrome": "General Principles",
  // CP -> Hemepath Benign
  "#Peripheral Blood Smears": "Peripheral Blood Smears",
  "Methods & misc": "General Principles",
};

/**
 * Parent-specific normalization rules
 * Key format: "parent::child" where parent is the immediate parent category
 */
const PARENT_SPECIFIC_NORMALIZATIONS: Record<string, string> = {
  // These are context-specific to avoid false positives
  "Chemistry::proteins": "Protein Analysis",
  "Chemistry::Quick Compendium": "General Principles",
  "Chemistry::preanalytical": "General Principles",
  "Chemistry::miscellaneous": "General Principles",
  "Transfusion Medicine::Quick Compendium": "General Principles",
  "Transfusion Medicine::QUick Compendium": "General Principles",
  "Transfusion Medicine::Special Circumstances": "General Principles",
  "Transfusion Medicine::Extras": "General Principles",
  "Transfusion Medicine::Passenger Lymphocytes Syndrome": "General Principles",
  "Hemepath Benign::Methods & misc": "General Principles",
};

/**
 * Category merge rules - categories that should be combined
 * Key is the source category path, value is the target category path
 */
const CATEGORY_MERGES: Record<string, string> = {
  // AP -> Pulmonary combine with AP -> Thoracic -> Pulmonary
  "AP::Pulmonary": "AP::Thoracic::Pulmonary",
  // CP -> Benign Heme combine with CP -> Hemepath Benign
  "CP::Benign Heme": "CP::Hemepath Benign",
  // CP -> Hemepath change to CP -> Hemepath Neoplastic
  "CP::Hemepath": "CP::Hemepath Neoplastic",
};

/**
 * Microbiology subcategories that are valid - everything else goes to General Principles
 */
const MICROBIOLOGY_VALID_SUBCATEGORIES = [
  "Bacteriology",
  "Mycology",
  "Parasitology",
  "Virology",
  "General Principles",
];

/**
 * Normalize a category/subcategory name
 */
export function normalizeName(name: string, parentPath: string[] = []): string {
  const originalName = name.trim();
  let normalized = originalName;

  // Check direct name normalizations FIRST (before any modifications)
  // This handles cases like '#techniques', '#Peripheral Blood Smears', etc.
  if (NAME_NORMALIZATIONS[originalName]) {
    return NAME_NORMALIZATIONS[originalName];
  }

  // Check parent-specific normalizations with original name
  if (parentPath.length > 0) {
    const parent = parentPath[parentPath.length - 1];
    const parentKey = `${parent}::${originalName}`;
    if (PARENT_SPECIFIC_NORMALIZATIONS[parentKey]) {
      return PARENT_SPECIFIC_NORMALIZATIONS[parentKey];
    }
  }

  // Remove leading # characters
  if (normalized.startsWith("#")) {
    normalized = normalized.substring(1).trim();
  }

  // Check normalizations again after stripping #
  if (NAME_NORMALIZATIONS[normalized]) {
    normalized = NAME_NORMALIZATIONS[normalized];
  }

  // Check parent-specific normalizations with stripped name
  if (parentPath.length > 0) {
    const parent = parentPath[parentPath.length - 1];
    const parentKey = `${parent}::${normalized}`;
    if (PARENT_SPECIFIC_NORMALIZATIONS[parentKey]) {
      normalized = PARENT_SPECIFIC_NORMALIZATIONS[parentKey];
    }
  }

  // Fix parsing errors (missing spaces before 'and')
  normalized = normalized.replace(/(\w)and(\s)/g, "$1 And$2");
  normalized = normalized.replace(/(\w)and$/g, "$1 And");

  // Replace 'and' with '&' (case insensitive, whole word)
  normalized = normalized.replace(/\band\b/gi, "&");

  // Ensure sentence case (capitalize first letter, rest as-is for proper nouns)
  if (normalized.length > 0) {
    normalized = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  // Special handling for Microbiology subcategories
  if (parentPath.some((p) => p.includes("Microbiology"))) {
    if (!MICROBIOLOGY_VALID_SUBCATEGORIES.includes(normalized)) {
      normalized = "General Principles";
    }
  }

  return normalized;
}

/**
 * Check if a category path should be merged into another
 */
export function getMergeTarget(path: string[]): string[] | null {
  const pathStr = path.join("::");
  for (const [source, target] of Object.entries(CATEGORY_MERGES)) {
    if (pathStr === source || pathStr.startsWith(source + "::")) {
      const targetParts = target.split("::");
      if (pathStr.startsWith(source + "::")) {
        // Preserve subcategories under the merged path
        const remainder = pathStr.substring(source.length + 2);
        return [...targetParts, ...remainder.split("::")];
      }
      return targetParts;
    }
  }
  return null;
}

/**
 * Merge subsections with the same normalized name
 */
export function mergeSubsections(subsections: AnkomaSection[]): AnkomaSection[] {
  const merged = new Map<string, AnkomaSection>();

  for (const section of subsections) {
    const existing = merged.get(section.name);
    if (existing) {
      // Merge cards and subsections
      existing.cards.push(...section.cards);
      existing.cardCount += section.cardCount;
      existing.subsections.push(...section.subsections);
      // Recursively merge the combined subsections
      existing.subsections = mergeSubsections(existing.subsections);
    } else {
      // Recursively merge this section's subsections first
      const mergedSection = { ...section, subsections: mergeSubsections(section.subsections) };
      merged.set(section.name, mergedSection);
    }
  }

  return Array.from(merged.values());
}
