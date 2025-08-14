// src/shared/config/cell-quiz.ts
// Public, immutable JSON URLs for client-only cell quiz data.
// Replace with your Cloudflare R2 public domain or Worker route.
const DATA_BASE = process.env.CLOUDFLARE_R2_DATA_PUBLIC_URL || 'https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev'

export const CELL_QUIZ_IMAGES_URL = `${DATA_BASE}/cell-quiz/cell-quiz-images.json`
export const CELL_QUIZ_REFERENCES_URL = `${DATA_BASE}/cell-quiz/cell-quiz-references.json`