// src/shared/config/cell-quiz.ts
// Public, immutable JSON URLs for client-only cell quiz data.
// Hard-coded R2 data URL - this is a public, static URL that doesn't change.
//
// `.json.br` objects on R2 are stored with `Content-Encoding: br` HTTP metadata
// — browser (and Node 18+ undici fetch) auto-decompress, so callers see plain
// JSON. Same pattern as virtual-slides v8 and ankoma.
import { createManifestResolver } from "@/shared/config/r2-manifest";

const DATA_BASE = "https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev";

export const CELL_QUIZ_MANIFEST_URL = `${DATA_BASE}/cell-quiz/manifest.json`;

// FALLBACKS: used only when the manifest is unreachable. See CLAUDE.md "Caching".
export const CELL_QUIZ_IMAGES_URL = `${DATA_BASE}/cell-quiz/cell-quiz-images.json.br`;
export const CELL_QUIZ_REFERENCES_URL = `${DATA_BASE}/cell-quiz/cell-quiz-references.json.br`;

const resolver = createManifestResolver(CELL_QUIZ_MANIFEST_URL, {
  images: CELL_QUIZ_IMAGES_URL,
  references: CELL_QUIZ_REFERENCES_URL,
});
export const resolveCellQuizImagesUrl = async () => (await resolver()).urls.images;
export const resolveCellQuizReferencesUrl = async () => (await resolver()).urls.references;
