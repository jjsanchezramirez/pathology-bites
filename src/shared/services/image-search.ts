import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/shared/services/client";
import { normalizeMedicalSpelling } from "@/shared/utils/text/medical-spelling";

export interface DiagnosisImage {
  id: string;
  url: string;
  description: string | null;
  alt_text: string | null;
  /** Credit line for the image (book, atlas, contributor). */
  source_ref: string | null;
  /** "microscopic" or "gross". */
  category: string | null;
}

/**
 * Find library images for a diagnosis by name (+ optional aliases/acronyms).
 *
 * Unlike `fetchImages`, which does a whole-string `ilike '%term%'` on a few text
 * columns, this uses the `images.search_vector` full-text index via websearch:
 *  - word-order and punctuation independent (WHO names carry commas/parens that
 *    otherwise broke the PostgREST `.or()` filter outright),
 *  - Commonwealth→American spelling normalized ("stromal tumour" finds "tumor"),
 *  - each candidate's words are AND-ed (precise) and candidates are OR-ed, so an
 *    acronym alias ("GIST") catches images the full name misses.
 * Returns [] freely — most WHO entities have no library image, and that's fine.
 */
export async function searchImagesForDiagnosis(
  name: string,
  aliases: string[] = [],
  limit = 6,
  /** The browser client by default; server callers pass their own (the table is public-read). */
  client: SupabaseClient = createClient() as unknown as SupabaseClient
): Promise<DiagnosisImage[]> {
  // One websearch candidate per name/alias. Sanitize to bare words: full-text
  // ignores punctuation anyway, and stray "or"/"and"/quotes would corrupt the
  // OR-join below (a candidate's words are AND-ed; candidates are OR-ed).
  const toCandidate = (s: string): string =>
    normalizeMedicalSpelling(s)
      .replace(/\([^)]*\)/g, " ") // drop parenthetical clone/qualifier
      .split(",")[0] // keep the head, not "…, HPV-associated, of the cervix"
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w && w !== "or" && w !== "and")
      .join(" ")
      .trim();

  const candidates = Array.from(
    new Set([name, ...aliases].map(toCandidate).filter((c) => c.length >= 2))
  ).slice(0, 4);
  if (!candidates.length) return [];

  const query = candidates.join(" OR ");
  try {
    const { data, error } = await client
      .from("images")
      .select("id, url, description, alt_text, source_ref, category")
      .in("category", ["microscopic", "gross"])
      .textSearch("search_vector", query, { type: "websearch", config: "english" })
      .limit(limit);
    if (error || !data) return [];
    return data as DiagnosisImage[];
  } catch {
    return [];
  }
}
