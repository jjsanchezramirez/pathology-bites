// src/shared/config/ankoma.ts
// Public, immutable JSON URL for client-only access.
// Similar to virtual slides approach - avoid Vercel API calls entirely.
// Hard-coded R2 data URL - this is a public, static URL that doesn't change.
//
// `.json.br` object on R2 is stored with HTTP metadata
// `Content-Encoding: br` — browser (and Node 18+ undici fetch) auto-decompress,
// so callers see plain JSON. No DecompressionStream needed.
// 3 MB raw → ~300-400 KB brotli. Same pattern as virtual-slides v8.
const DATA_BASE = "https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev";
export const ANKOMA_JSON_URL = `${DATA_BASE}/anki/ankoma.json.br?v=1`;
