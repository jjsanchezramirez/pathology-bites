// src/shared/config/ankoma.ts
// Public, immutable JSON URL for client-only access.
// Similar to virtual slides approach - avoid Vercel API calls entirely
const DATA_BASE = process.env.CLOUDFLARE_R2_DATA_PUBLIC_URL || 'https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev'
export const ANKOMA_JSON_URL = `${DATA_BASE}/anki/ankoma.json`