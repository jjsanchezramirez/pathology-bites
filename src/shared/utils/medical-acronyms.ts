/**
 * Medical acronym expansions for search functionality
 *
 * This file contains common medical abbreviations used in pathology.
 * Acronyms can have single or multiple meanings (array).
 *
 * Usage:
 * - Single meaning: 'rcc': 'renal cell carcinoma'
 * - Multiple meanings: 'aml': ['angiomyolipoma', 'acute myeloid leukemia']
 *
 * When searching "renal aml", it will expand to:
 * - "renal aml" (original)
 * - "renal angiomyolipoma"
 * - "renal acute myeloid leukemia"
 */

export const MEDICAL_ACRONYMS: Record<string, string | string[]> = {
  // Carcinomas
  rcc: "renal cell carcinoma",
  scc: "squamous cell carcinoma",
  bcc: "basal cell carcinoma",
  hcc: "hepatocellular carcinoma",
  nsclc: "non small cell lung carcinoma",
  sclc: "small cell lung carcinoma",

  // Thyroid
  ptc: "papillary thyroid carcinoma",
  ftc: "follicular thyroid carcinoma",
  mtc: "medullary thyroid carcinoma",

  // Hematologic
  dlbcl: "diffuse large b cell lymphoma",
  aml: ["angiomyolipoma", "acute myeloid leukemia"], // Multiple meanings
  all: "acute lymphoblastic leukemia",
  cml: "chronic myeloid leukemia",
  cll: "chronic lymphocytic leukemia",

  // Sarcomas
  gist: "gastrointestinal stromal tumor",
  mpnst: "malignant peripheral nerve sheath tumor",
  pnet: "primitive neuroectodermal tumor",
  rms: "rhabdomyosarcoma",
  arms: "alveolar rhabdomyosarcoma",
};

/**
 * Common medical terms that are too generic to match alone in multi-word queries.
 * These terms are filtered out when determining the "specific word" in a search.
 *
 * For example:
 * - "renal cell carcinoma" → all words are common, no Bucket 3 match
 * - "renal angiomyolipoma" → "angiomyolipoma" is specific, enables Bucket 3 match
 */
export const COMMON_MEDICAL_TERMS = new Set([
  // Generic tumor types
  "tumor",
  "tumour",
  "neoplasm",
  "lesion",
  "mass",
  "growth",
  "carcinoma",
  "adenocarcinoma",
  "sarcoma",
  "melanoma",
  "lymphoma",
  "leukemia",
  "adenoma",
  "lipoma",
  "fibroma",
  "papilloma",
  "neuroma",
  "cell",
  "cells",
  "tissue",
  "cancer",
  "malignancy",
  "benign",
  "disease",
  "syndrome",
  "disorder",
  "condition",
  "inflammation",
  "infection",
  "hyperplasia",
  "dysplasia",
  "metaplasia",
  "cyst",
  "polyp",
  "nodule",
  "plaque",

  // Common organ/anatomical terms (too generic alone)
  "renal",
  "hepatic",
  "gastric",
  "colonic",
  "pulmonary",
  "cardiac",
  "ovarian",
  "uterine",
  "prostatic",
  "thyroid",
  "adrenal",
  "cutaneous",
  "dermal",
  "osseous",
  "lymphatic",
  "splenic",
]);
