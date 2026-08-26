/**
 * THE canonical `term_normalized` rule, for entity AND marker synonyms.
 *
 * Mirrors `entity_synonyms_term_normalized_is_canonical` and
 * `marker_synonyms_term_normalized_is_canonical` byte for byte:
 *
 *     btrim(regexp_replace(lower(term), '[^a-z0-9]+', ' ', 'g'))
 *
 * There must be exactly ONE of these in TypeScript. A second is the bug that
 * stored 1,061 aliases twice under a unique index, with `term` saying
 * "leukaemia" while the key said "leukemia" — and a THIRD was found inside
 * `kg_merge_entity` during this rebuild, where a whitespace-only normaliser
 * silently aborted 34.7% of entity merges against the CHECK constraint.
 *
 * It lives in `shared/` rather than beside the ops because both the write path
 * and the browser need it, and a client component importing from `app/api/**`
 * to reach it would be one refactor away from pulling a Supabase client into
 * the browser bundle.
 */
export const normalizeTerm = (t: string) =>
  t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
