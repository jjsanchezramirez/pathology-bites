// src/shared/config/ankoma.ts
// Public, immutable JSON URL for client-only access.
// Similar to virtual slides approach - avoid Vercel API calls entirely
// Hard-coded R2 data URL - this is a public, static URL that doesn't change
const DATA_BASE = 'https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev'
export const ANKOMA_JSON_URL = `${DATA_BASE}/anki/ankoma.json`