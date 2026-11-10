// src/shared/config/ankoma.ts
//
// The Anki page loads the Ankoma deck per category (see
// src/app/(dashboard)/dashboard/anki/anki-sections.ts): a small index first,
// then one content-addressed file per category on demand. Every live URL comes
// from anki/manifest.json, so a republish needs no redeploy (CLAUDE.md
// "Caching").
//
// `.json.br` objects on R2 carry `Content-Encoding: br`; browsers (and Node's
// fetch) decompress them transparently.
import { createManifestResolver } from "@/shared/config/r2-manifest";
import { R2_DATA_PUBLIC_URL } from "@/shared/config/r2-public-urls";

const DATA_BASE = R2_DATA_PUBLIC_URL;

export const ANKOMA_MANIFEST_URL = `${DATA_BASE}/anki/manifest.json`;
// FALLBACKS: fixed, short-TTL keys used only when the manifest is unreachable.
export const ANKOMA_INDEX_URL = `${DATA_BASE}/anki/index.json.br`;
// The whole deck in one file (not read by the app any more; kept for tooling).
export const ANKOMA_JSON_URL = `${DATA_BASE}/anki/ankoma.json.br`;

const resolver = createManifestResolver(ANKOMA_MANIFEST_URL, {
  index: ANKOMA_INDEX_URL,
  ankoma: ANKOMA_JSON_URL,
});
export const resolveAnkomaIndexUrl = async () => (await resolver()).urls.index;
