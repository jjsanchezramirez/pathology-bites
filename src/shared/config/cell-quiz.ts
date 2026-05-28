// src/shared/config/cell-quiz.ts
// Public, immutable JSON URLs for client-only cell quiz data.
// Hard-coded R2 data URL - this is a public, static URL that doesn't change.
//
// `.json.br` objects on R2 are stored with `Content-Encoding: br` HTTP metadata
// — browser (and Node 18+ undici fetch) auto-decompress, so callers see plain
// JSON. Same pattern as virtual-slides v8 and ankoma.
const DATA_BASE = "https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev";

export const CELL_QUIZ_IMAGES_URL = `${DATA_BASE}/cell-quiz/cell-quiz-images.json.br?v=1`;
export const CELL_QUIZ_REFERENCES_URL = `${DATA_BASE}/cell-quiz/cell-quiz-references.json.br?v=1`;
