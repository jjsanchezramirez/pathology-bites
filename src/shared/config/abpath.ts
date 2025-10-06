// src/shared/config/abpath.ts
// Public, immutable JSON URL for client-only ABPath content specifications data.
// Uses Cloudflare R2 public domain for direct access without Vercel API involvement.

// Hard-coded R2 data URL - this is a public, static URL that doesn't change
const DATA_BASE = 'https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev'

export const ABPATH_CONTENT_SPECS_URL = `${DATA_BASE}/ab-path/content-specs.json`
