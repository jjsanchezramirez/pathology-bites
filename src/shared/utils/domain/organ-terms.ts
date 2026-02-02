// Organ and anatomical terms for context-aware search
// These terms are extracted from search queries and used to boost results
// where the slide's category or subcategory matches

export interface OrganTerm {
  term: string;
  aliases: string[];
  category?: string; // Maps to broad organ system category
  subcategory?: string; // Maps to specific organ system/subcategory
}

// Common organ and anatomical system terms
// Matches categories from virtual-slides.json (organ system categories)
export const ORGAN_TERMS: OrganTerm[] = [
  // Hepatobiliary and Pancreas
  {
    term: "liver",
    aliases: ["hepatic"],
    category: "Hepatobiliary and Pancreas",
    subcategory: "hepatobiliary and pancreas",
  },
  {
    term: "pancreas",
    aliases: ["pancreatic"],
    category: "Hepatobiliary and Pancreas",
    subcategory: "hepatobiliary and pancreas",
  },
  {
    term: "gallbladder",
    aliases: ["biliary"],
    category: "Hepatobiliary and Pancreas",
    subcategory: "hepatobiliary and pancreas",
  },
  {
    term: "bile duct",
    aliases: ["biliary", "cholangiocarcinoma"],
    category: "Hepatobiliary and Pancreas",
    subcategory: "hepatobiliary and pancreas",
  },

  // Gastrointestinal
  {
    term: "stomach",
    aliases: ["gastric"],
    category: "Gastrointestinal",
    subcategory: "gastrointestinal",
  },
  {
    term: "esophagus",
    aliases: ["esophageal"],
    category: "Gastrointestinal",
    subcategory: "gastrointestinal",
  },
  {
    term: "colon",
    aliases: ["colonic", "colorectal"],
    category: "Gastrointestinal",
    subcategory: "gastrointestinal",
  },
  {
    term: "rectum",
    aliases: ["rectal", "colorectal"],
    category: "Gastrointestinal",
    subcategory: "gastrointestinal",
  },
  {
    term: "small bowel",
    aliases: ["small intestine", "duodenum", "jejunum", "ileum"],
    category: "Gastrointestinal",
    subcategory: "gastrointestinal",
  },
  {
    term: "appendix",
    aliases: ["appendiceal"],
    category: "Gastrointestinal",
    subcategory: "gastrointestinal",
  },

  // Cytology
  { term: "cytology", aliases: ["cyto", "cytopathology", "cytopath"], category: "Cytology" },

  // Thoracic (Lung and Pleura)
  {
    term: "lung",
    aliases: ["pulmonary", "bronchial"],
    category: "Thoracic",
    subcategory: "lung and pleura",
  },
  { term: "pleura", aliases: ["pleural"], category: "Thoracic", subcategory: "lung and pleura" },
  {
    term: "bronchus",
    aliases: ["bronchial"],
    category: "Thoracic",
    subcategory: "lung and pleura",
  },
  { term: "mediastinum", aliases: ["mediastinal"], category: "Thoracic", subcategory: "thoracic" },

  // Genitourinary
  {
    term: "kidney",
    aliases: ["renal"],
    category: "Genitourinary",
    subcategory: "kidney and urinary tract",
  },
  {
    term: "bladder",
    aliases: ["urinary bladder", "vesical"],
    category: "Genitourinary",
    subcategory: "kidney and urinary tract",
  },
  {
    term: "ureter",
    aliases: ["ureteral"],
    category: "Genitourinary",
    subcategory: "kidney and urinary tract",
  },
  {
    term: "urethra",
    aliases: ["urethral"],
    category: "Genitourinary",
    subcategory: "kidney and urinary tract",
  },
  {
    term: "prostate",
    aliases: ["prostatic"],
    category: "Genitourinary",
    subcategory: "male genital",
  },
  {
    term: "testis",
    aliases: ["testicular", "testes"],
    category: "Genitourinary",
    subcategory: "male genital",
  },
  { term: "penis", aliases: ["penile"], category: "Genitourinary", subcategory: "male genital" },

  // Gynecologic
  { term: "ovary", aliases: ["ovarian"], category: "Gynecologic", subcategory: "female genital" },
  { term: "uterus", aliases: ["uterine"], category: "Gynecologic", subcategory: "female genital" },
  { term: "cervix", aliases: ["cervical"], category: "Gynecologic", subcategory: "female genital" },
  {
    term: "endometrium",
    aliases: ["endometrial"],
    category: "Gynecologic",
    subcategory: "female genital",
  },
  {
    term: "fallopian tube",
    aliases: ["tubal"],
    category: "Gynecologic",
    subcategory: "female genital",
  },
  { term: "vulva", aliases: ["vulvar"], category: "Gynecologic", subcategory: "female genital" },
  { term: "vagina", aliases: ["vaginal"], category: "Gynecologic", subcategory: "female genital" },

  // Breast
  { term: "breast", aliases: ["mammary"], category: "Breast", subcategory: "breast" },

  // Endocrine and Neuroendocrine
  {
    term: "thyroid",
    aliases: ["thyroid gland"],
    category: "Endocrine and Neuroendocrine",
    subcategory: "endocrine",
  },
  {
    term: "parathyroid",
    aliases: ["parathyroid gland"],
    category: "Endocrine and Neuroendocrine",
    subcategory: "endocrine",
  },
  {
    term: "adrenal",
    aliases: ["adrenal gland", "suprarenal"],
    category: "Endocrine and Neuroendocrine",
    subcategory: "endocrine",
  },
  {
    term: "pituitary",
    aliases: ["pituitary gland", "hypophysis"],
    category: "Endocrine and Neuroendocrine",
    subcategory: "endocrine",
  },

  // Head and Neck
  {
    term: "salivary gland",
    aliases: ["parotid", "submandibular", "sublingual"],
    category: "Head and Neck",
    subcategory: "head and neck",
  },
  {
    term: "oral cavity",
    aliases: ["mouth", "tongue", "oral"],
    category: "Head and Neck",
    subcategory: "head and neck",
  },
  {
    term: "pharynx",
    aliases: ["pharyngeal", "nasopharynx", "oropharynx"],
    category: "Head and Neck",
    subcategory: "head and neck",
  },
  {
    term: "larynx",
    aliases: ["laryngeal"],
    category: "Head and Neck",
    subcategory: "head and neck",
  },
  {
    term: "nasal",
    aliases: ["nose", "sinonasal"],
    category: "Head and Neck",
    subcategory: "head and neck",
  },

  // Dermatopathology
  {
    term: "skin",
    aliases: ["cutaneous", "dermal", "derm", "dermatopathology", "dermpath"],
    category: "Dermatopathology",
    subcategory: "skin",
  },

  // Bone and Soft Tissue
  {
    term: "soft tissue",
    aliases: ["sarcoma"],
    category: "Bone and Soft Tissue",
    subcategory: "soft tissue",
  },
  {
    term: "bone",
    aliases: ["osseous", "skeletal"],
    category: "Bone and Soft Tissue",
    subcategory: "bone and joint",
  },

  // Hematopathology
  {
    term: "lymph node",
    aliases: ["lymphatic", "nodal"],
    category: "Hematopathology",
    subcategory: "lymphoma",
  },
  { term: "spleen", aliases: ["splenic"], category: "Hematopathology", subcategory: "lymphoma" },
  {
    term: "bone marrow",
    aliases: ["marrow"],
    category: "Hematopathology",
    subcategory: "hematologic",
  },
  {
    term: "blood",
    aliases: ["hematologic", "hematopoietic"],
    category: "Hematopathology",
    subcategory: "hematologic",
  },

  // Neuropathology
  {
    term: "brain",
    aliases: ["cerebral", "cerebrum", "intracranial"],
    category: "Neuropathology",
    subcategory: "central nervous system",
  },
  {
    term: "spinal cord",
    aliases: ["spine", "spinal"],
    category: "Neuropathology",
    subcategory: "central nervous system",
  },
  {
    term: "meninges",
    aliases: ["meningeal"],
    category: "Neuropathology",
    subcategory: "central nervous system",
  },

  // Eye (may fall under Head and Neck or its own)
  { term: "eye", aliases: ["ocular", "ophthalmic"], subcategory: "eye" },
  { term: "retina", aliases: ["retinal"], subcategory: "eye" },

  // Cardiovascular
  {
    term: "heart",
    aliases: ["cardiac"],
    category: "Cardiovascular",
    subcategory: "cardiovascular",
  },

  // Placental
  { term: "placenta", aliases: ["placental"], category: "Placental" },

  // Peritoneum
  { term: "peritoneum", aliases: ["peritoneal"], subcategory: "peritoneum and retroperitoneum" },
  {
    term: "retroperitoneum",
    aliases: ["retroperitoneal"],
    subcategory: "peritoneum and retroperitoneum",
  },
];

// Create lookup maps for efficient searching
const organTermsLowercase = ORGAN_TERMS.map((o) => ({
  ...o,
  term: o.term.toLowerCase(),
  aliases: o.aliases.map((a) => a.toLowerCase()),
}));

const organLookupMap = new Map<string, OrganTerm>();
organTermsLowercase.forEach((organ) => {
  organLookupMap.set(organ.term, organ);
  organ.aliases.forEach((alias) => {
    organLookupMap.set(alias, organ);
  });
});

/**
 * Extract organ/anatomical terms from a search query
 * Returns the matched organs and the remaining search terms
 */
export function extractOrganTerms(query: string): {
  organs: OrganTerm[];
  remainingQuery: string;
} {
  const queryLower = query.toLowerCase().trim();
  const words = queryLower.split(/\s+/);

  const matchedOrgans: OrganTerm[] = [];
  const matchedWords = new Set<number>();

  // Check for multi-word organ terms first (e.g., "bile duct", "lymph node")
  for (let i = 0; i < words.length; i++) {
    // Try 3-word combinations
    if (i + 2 < words.length) {
      const threeWord = words.slice(i, i + 3).join(" ");
      const organ = organLookupMap.get(threeWord);
      if (organ) {
        matchedOrgans.push(organ);
        matchedWords.add(i);
        matchedWords.add(i + 1);
        matchedWords.add(i + 2);
        continue;
      }
    }

    // Try 2-word combinations
    if (i + 1 < words.length) {
      const twoWord = words.slice(i, i + 2).join(" ");
      const organ = organLookupMap.get(twoWord);
      if (organ) {
        matchedOrgans.push(organ);
        matchedWords.add(i);
        matchedWords.add(i + 1);
        continue;
      }
    }

    // Try single word
    const organ = organLookupMap.get(words[i]);
    if (organ) {
      matchedOrgans.push(organ);
      matchedWords.add(i);
    }
  }

  // Build remaining query from unmatched words
  const remainingWords = words.filter((_, i) => !matchedWords.has(i));
  const remainingQuery = remainingWords.join(" ").trim();

  // Deduplicate organs (same organ might match via term and alias)
  const uniqueOrgans = Array.from(new Map(matchedOrgans.map((o) => [o.term, o])).values());

  return {
    organs: uniqueOrgans,
    remainingQuery,
  };
}

/**
 * Check if a slide matches the organ context
 * Returns a boost score multiplier (1.0 = no boost, >1.0 = boost)
 * Category = organ system category (Gastrointestinal, Breast, etc.)
 * Subcategory = specific organ system (hepatobiliary, lung and pleura, etc.)
 */
export function getOrganBoostScore(
  slide: { category?: string; subcategory?: string },
  organs: OrganTerm[]
): number {
  if (organs.length === 0) return 1.0;

  const slideCategory = (slide.category || "").toLowerCase();
  const slideSubcategory = (slide.subcategory || "").toLowerCase();

  let maxBoost = 1.0;

  for (const organ of organs) {
    // Exact subcategory match (strongest signal)
    if (organ.subcategory && slideSubcategory === organ.subcategory.toLowerCase()) {
      maxBoost = Math.max(maxBoost, 2.5);
    }
    // Partial subcategory match
    else if (organ.subcategory && slideSubcategory.includes(organ.subcategory.toLowerCase())) {
      maxBoost = Math.max(maxBoost, 2.0);
    }
    // Exact category match (good signal)
    else if (organ.category && slideCategory === organ.category.toLowerCase()) {
      maxBoost = Math.max(maxBoost, 1.75);
    }
    // Partial category match
    else if (organ.category && slideCategory.includes(organ.category.toLowerCase())) {
      maxBoost = Math.max(maxBoost, 1.5);
    }
    // Check if organ term appears in subcategory
    else if (slideSubcategory.includes(organ.term)) {
      maxBoost = Math.max(maxBoost, 1.3);
    }
  }

  return maxBoost;
}
