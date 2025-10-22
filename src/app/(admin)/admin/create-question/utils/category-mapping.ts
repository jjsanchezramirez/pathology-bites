// Utility to map educational content categories and subjects to database category IDs

interface CategoryMapping {
  [key: string]: {
    [subject: string]: string; // category ID
  };
}

/**
 * Maps educational content category + subject combinations to database category IDs
 * Based on the actual categories in the database
 */
export const CONTENT_TO_CATEGORY_MAPPING: CategoryMapping = {
  "Anatomic Pathology": {
    "Bone": "fdaf44b9-b8e7-4f33-ad04-0c005aaafe4d", // Bone & Soft Tissue
    "Breast": "e9032a40-2d26-43b0-965b-2188e949b76e", // Breast
    "Cardiovascular and Thoracic": "48d30f10-68ef-49b9-91b0-1be2d231c2e4", // Thoracic
    "Cytopathology": "eb03af9c-fbd2-48a8-bd31-be7cbfc16094", // Cytopathology
    "Dermatopathology": "620f5a8c-1d48-4477-beb7-3b2d1d47adf0", // Dermatopathology
    "Forensics and Autopsy": "5ce89145-b75b-416e-a838-febe567844a1", // Forensics & Autopsy
    "Gastrointestinal": "410cb8d0-b12b-4e9a-a1e8-e596f7018346", // Gastrointestinal
    "General Topics": "410cb8d0-b12b-4e9a-a1e8-e596f7018346", // Default to Gastrointestinal for general topics
    "Genitourinary": "8f33b1ec-56c2-419e-aa6c-a048c02090f5", // Genitourinary
    "Gynecological": "c28dd904-aa6d-439c-a946-ac0bc0a6a64e", // Gynecologic
    "Head and Neck / Endocrine": "fe2aab09-86ed-4c3d-a200-107dd95a9ab8", // Head & Neck
    "Hematopathology": "ff6d727c-62b6-47b8-bbda-7f71b3111a3c", // Hematopathology (from Clinical Pathology)
    "Molecular": "d6d64892-2e17-4596-be2e-8ae27a41551e", // Molecular Pathology & Cytogenetics
    "Neuropathology": "9779afa6-3773-49f6-8ca9-f112e4b59a9b", // Neuropathology
    "Pancreas Biliary Liver": "85adf114-3e76-4a4f-af3b-7c64e03576e3", // Pancreatobiliary
    "Pediatrics": "37443ebb-d4c0-4789-82be-6d9e02655af5", // Pediatric
    "Soft Tissue": "fdaf44b9-b8e7-4f33-ad04-0c005aaafe4d", // Bone & Soft Tissue
  },
  "Clinical Pathology": {
    "Clinical Chemistry": "fc9d881d-f0fb-4f53-91f3-1a2f145d9156", // Clinical Chemistry
    "Hematology Hemostasis and Thrombosis": "7c1c342a-3fba-474e-9a07-630d3cd09465", // Coagulation
    "Hematopathology": "ff6d727c-62b6-47b8-bbda-7f71b3111a3c", // Hematopathology
    "Immunology": "58d5f402-3344-42da-b63e-610b0d05a7ca", // Immunology
    "Laboratory Management and Clinical Laboratory Informatics": "b9cd1729-189e-4774-b1f3-5b2df86ca687", // Laboratory Management & Medical Directorship
    "Medical Microbiology": "b4aed7d4-e1ba-4450-addc-c0c8e353a465", // Medical Microbiology
    "Molecular Pathology and Cytogenetics": "d6d64892-2e17-4596-be2e-8ae27a41551e", // Molecular Pathology & Cytogenetics
    "Toxicology Body Fluids and Special Techniques": "b4aed7d4-e1ba-4450-addc-c0c8e353a465", // Medical Microbiology (closest match)
    "Transfusion Medicine": "2f0c7425-5c0e-4c2d-a373-34d32021a362", // Blood Banking/Transfusion Medicine
  }
};

/**
 * Get the database category ID for an educational content category and subject combination
 */
export function getCategoryIdFromContent(category: string, subject: string): string | null {
  const categoryMapping = CONTENT_TO_CATEGORY_MAPPING[category];
  if (!categoryMapping) {
    console.warn(`No mapping found for educational content category: ${category}`);
    return null;
  }

  const categoryId = categoryMapping[subject];
  if (!categoryId) {
    console.warn(`No mapping found for educational content subject: ${subject} in category: ${category}`);
    return null;
  }

  return categoryId;
}

/**
 * Get category information for display purposes
 */
export function getCategoryDisplayInfo(category: string, subject: string): {
  categoryId: string | null;
  displayName: string;
  hasMapping: boolean;
} {
  const categoryId = getCategoryIdFromContent(category, subject);
  
  return {
    categoryId,
    displayName: subject,
    hasMapping: categoryId !== null
  };
}
