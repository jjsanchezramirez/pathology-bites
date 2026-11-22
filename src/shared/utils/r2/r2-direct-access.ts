import { R2_DATA_PUBLIC_URL } from "@/shared/config/r2-public-urls";

// src/shared/utils/r2/r2-direct-access.ts
/**
 * Public R2 URLs for app datasets served from data.pathologybites.com.
 *
 * Only app-owned datasets belong here. Scraped third-party corpora (PathPrimer,
 * ExpertPath, PathologyOutlines, WHO) live in the private bucket
 * pathology-bites-scraped and are never fetched by the app.
 */
const DATA_BASE = R2_DATA_PUBLIC_URL;

export const R2_PUBLIC_URLS = {
  ABPATH_CONTENT_SPECS_JSON: `${DATA_BASE}/ab-path/content-specs.json`,
  CELL_QUIZ_IMAGES_JSON: `${DATA_BASE}/cell-quiz/cell-quiz-images.json`,
  CELL_QUIZ_REFERENCES_JSON: `${DATA_BASE}/cell-quiz/cell-quiz-references.json`,
  NLM_JOURNAL_ABBREVIATIONS_JSON: `${DATA_BASE}/citations/nlm-journal-abbreviations.json`,
} as const;
