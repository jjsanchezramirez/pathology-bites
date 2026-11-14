/**
 * Reads behind the public /e, /m and /g pages.
 *
 * These use the ANON server client, not the service role: every table below
 * carries a public `*_select_all` policy, and a page that renders nothing but
 * world-readable curation has no business holding a key that bypasses RLS.
 *
 * `entity_placements` and `evidence` only became readable this way in migration
 * `kg_public_read_placements_and_evidence` — they had RLS on with no policy at
 * all, which PostgREST reports as an empty result rather than an error. If a
 * page here ever renders "no data" for something you can see in the admin, check
 * for a missing SELECT policy before anything else.
 */
import "server-only";

import { cache } from "react";

import { createClient } from "@/shared/services/server";

export interface EntityRow {
  id: string;
  slug: string;
  name: string;
  kind: string;
  icd_o: string | null;
  definition: string | null;
}

export interface Placement {
  volume: string;
  organ_system: string | null;
  rank: string;
  chapter_name: string | null;
  parent: { slug: string; name: string } | null;
}

const PAGE = 1000;

/** Page through a filtered read; PostgREST caps a single response at 1,000. */
async function all<T>(
  build: () => { range: (a: number, b: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }> }
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}

/**
 * Resolve a slug to an entity, following a merge redirect if the slug is one we
 * used to use. Returns the redirect target separately so the page can answer
 * with a permanent redirect rather than quietly serving a different tumour under
 * the old address.
 */
export async function resolveEntity(
  slug: string
): Promise<{ entity: EntityRow } | { redirectTo: string } | null> {
  const sb = await createClient();

  const { data: hit } = await sb
    .from("entities")
    .select("id, slug, name, kind, icd_o, definition")
    .eq("slug", slug)
    .maybeSingle();
  if (hit) return { entity: hit as EntityRow };

  const { data: red } = await sb
    .from("entity_merge_redirects")
    .select("entity_id")
    .eq("from_slug", slug)
    .maybeSingle();
  // A NULL entity_id means the slug was deleted as a non-entity, never merged:
  // there is nothing to redirect to and 404 is the honest answer.
  if (!red?.entity_id) return null;

  const { data: target } = await sb
    .from("entities")
    .select("slug")
    .eq("id", red.entity_id)
    .maybeSingle();
  return target?.slug ? { redirectTo: target.slug } : null;
}

export interface EntityDetail {
  placements: Placement[];
  synonyms: { term: string; kind: string }[];
  differentials: { other: { slug: string; name: string }; evidence: string | null }[];
  children: { slug: string; name: string }[];
}

/**
 * Placements, aliases, differentials and subtype pages for one entity.
 *
 * Marker findings are NOT read here any more. They used to be pooled from the
 * `evidence` table into one line per marker; the /e page now asks
 * `entityMarkerRollup` instead, which keeps every attestation separate and
 * attributed. Nothing on the entity page should blend sources.
 */
export async function entityDetail(entity: EntityRow): Promise<EntityDetail> {
  const sb = await createClient();

  const [placementsRaw, synonyms, diffOut, diffIn] = await Promise.all([
    all<{ volume: string; organ_system: string | null; rank: string; chapter_name: string | null; parent_id: string | null }>(
      () => sb.from("entity_placements")
        .select("volume, organ_system, rank, chapter_name, parent_id")
        .eq("entity_id", entity.id)
        .order("volume") as never
    ),
    all<{ term: string; kind: string }>(
      () =>
        sb
          .from("entity_synonyms")
          .select("term, kind")
          .eq("entity_id", entity.id)
          .order("term") as never
    ),
    all<{ to_entity: string; evidence: string | null }>(
      () => sb.from("entity_differentials").select("to_entity, evidence").eq("from_entity", entity.id) as never
    ),
    all<{ from_entity: string; evidence: string | null }>(
      () => sb.from("entity_differentials").select("from_entity, evidence").eq("to_entity", entity.id) as never
    ),
  ]);

  // Resolve every referenced entity in one round trip.
  const entityIds = [
    ...new Set([
      ...(placementsRaw.map((p) => p.parent_id).filter(Boolean) as string[]),
      ...diffOut.map((d) => d.to_entity),
      ...diffIn.map((d) => d.from_entity),
    ]),
  ];

  const ents = entityIds.length
    ? await sb.from("entities").select("id, slug, name").in("id", entityIds)
    : { data: [] as { id: string; slug: string; name: string }[] };
  const eById = new Map((ents.data ?? []).map((e) => [e.id, e]));

  /* Two spellings of one alias can still differ only by punctuation, so fold
   * for display.
   *
   * This used to work around something worse: two normalisers had written
   * term_normalized, so "Canale-Smith syndrome" and "Canale–Smith syndrome"
   * held different keys under a unique index and both came back. That is fixed
   * at the source — one rule now, enforced by
   * entity_synonyms_term_normalized_is_canonical — and the 1,061 duplicate rows
   * are gone. What remains is presentation: a term that differs only in
   * whitespace should be shown once. */
  const seenTerm = new Set<string>();
  const uniqueSynonyms = synonyms.filter((s) => {
    const k = s.term.toLowerCase().replace(/\s+/g, " ").trim();
    if (seenTerm.has(k)) return false;
    seenTerm.add(k);
    return true;
  });

  const placements: Placement[] = placementsRaw.map((p) => ({
    volume: p.volume,
    organ_system: p.organ_system,
    rank: p.rank,
    chapter_name: p.chapter_name,
    parent: p.parent_id && eById.has(p.parent_id)
      ? { slug: eById.get(p.parent_id)!.slug, name: eById.get(p.parent_id)!.name }
      : null,
  }));

  const differentials = [
    ...diffOut.map((d) => ({ other: eById.get(d.to_entity), evidence: d.evidence })),
    ...diffIn.map((d) => ({ other: eById.get(d.from_entity), evidence: d.evidence })),
  ]
    .filter((d): d is { other: { id: string; slug: string; name: string }; evidence: string | null } => !!d.other)
    .filter((d, i, arr) => arr.findIndex((x) => x.other.slug === d.other.slug) === i);

  const { data: children } = await sb
    .from("entity_placements")
    .select("volume, entity_id")
    .eq("parent_id", entity.id);
  const childIds = [...new Set((children ?? []).map((c) => c.entity_id))];
  const { data: childEnts } = childIds.length
    ? await sb.from("entities").select("slug, name").in("id", childIds)
    : { data: [] as { slug: string; name: string }[] };

  return {
    placements,
    synonyms: uniqueSynonyms,
    differentials,
    children: (childEnts ?? []).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export interface MarkerDetail {
  marker: {
    id: string; slug: string; name: string; kind: string;
    compartment: string | null; gene_symbols: string[] | null; definition: string | null;
  };
  synonyms: { term: string }[];
}

/**
 * The marker's own record and its synonyms. The entities it is reported in
 * come from `markerEntityRollup`, per source — this used to read `evidence`
 * and keep the first row's call per entity, which is the first-row-wins
 * defect the 2026-08-29 audit filed (D4).
 */
export async function markerDetail(slug: string): Promise<MarkerDetail | null> {
  const sb = await createClient();
  const { data: marker } = await sb
    .from("markers")
    .select("id, slug, name, kind, compartment, gene_symbols, definition")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (!marker) return null;

  const synonyms = await all<{ term: string }>(
    () => sb.from("marker_synonyms").select("term").eq("marker_id", marker.id).order("term") as never
  );
  return { marker, synonyms };
}

export interface GeneDetail {
  gene: { symbol: string; name: string | null; locus: string | null };
  markers: { slug: string; name: string; kind: string; gene_symbols: string[] | null }[];
}

export async function geneDetail(symbol: string): Promise<GeneDetail | null> {
  const sb = await createClient();
  const { data: gene } = await sb
    .from("genes")
    .select("symbol, name, locus")
    .ilike("symbol", symbol)
    .maybeSingle();
  if (!gene) return null;

  // gene_symbols is a text[]; ORDER carries the 5'/3' roles for a fusion.
  const { data: markers } = await sb
    .from("markers")
    .select("slug, name, kind, gene_symbols")
    .contains("gene_symbols", [gene.symbol])
    .order("name");

  return { gene, markers: markers ?? [] };
}

/* ------------------------------------------------------------------ M3 --- */

/**
 * One source document's contribution to one axis, reduced to an attributed
 * excerpt. The chapter text itself never leaves the database: `excerpt` is the
 * first sentence, capped at 240 characters, and `n_passages` / `n_chars` say how
 * much sits behind the link. It may still carry the inline `{12345678}` PMID
 * markers, which `ProseText` turns into links.
 */
export interface Excerpt {
  /** Source slug, e.g. `who-digestive-ed6`. */
  authority: string;
  /** e.g. "Digestive System Tumours (6th ed.)". */
  authority_name: string;
  edition: number | null;
  year: number | null;
  /** Document ref within the authority, e.g. "72/123". */
  ref: string;
  /** Chapter URL at the publisher, when known. */
  url: string | null;
  /** The publisher's own section heading. */
  heading: string;
  /** First sentence, <= 240 chars, may end in "…". */
  excerpt: string;
  n_passages: number;
  n_chars: number;
  n_citations: number;
}

export interface MonographClaimDissent {
  authority: string;
  polarity: string | null;
  code: string | null;
  text: string | null;
  quote: string | null;
}

/** One resolved claim from the verdicts matview. */
export interface MonographClaim {
  predicate: string;
  object_key: string | null;
  scope: string | null;
  agreement: string;
  polarity: "present" | "absent" | "indeterminate" | null;
  nuance: string | null;
  code: string | null;
  code_system: string | null;
  text: string | null;
  marker_id: string | null;
  /** [low, high, unit] as the source printed it; all three may be null. */
  qty: [number | null, number | null, string | null] | null;
  authority: string;
  quote: string | null;
  dissent: MonographClaimDissent[];
}

export type AxisCoverage =
  | "asserted"
  | "declared_absent"
  | "section_empty"
  | "section_missing"
  | "not_extracted";

export interface MonographAxis {
  ord: number;
  axis: string;
  label: string;
  /** full | partial | delegated | none — how well any source covers this axis. */
  holds: "full" | "partial" | "delegated" | "none";
  /** Whether the axis is running text (Epidemiology) rather than a list or code (ICD-O). */
  is_prose: boolean;
  /** One per source document. */
  excerpts: Excerpt[];
  claims: MonographClaim[];
  coverage: AxisCoverage[];
}

interface Monograph {
  entity:
    | (EntityRow & { created_at: string; updated_at: string; sites_curated: boolean })
    | null;
  axes: MonographAxis[];
  verdicts_computed_at: string | null;
}

/**
 * The whole monograph in ONE request.
 *
 * `kb_entity_monograph` returns a single scalar jsonb row, so the number of axes
 * is a SQL detail rather than a client one — PostgREST's 1,000-row cap cannot
 * truncate it, and there is no N+1 to tune. It also resolves merged slugs
 * internally, so a retired slug is a hit rather than a 404; the page still
 * prefers `resolveEntity` first so it can answer with a real 308 instead.
 *
 * Returns null when the slug matches nothing, which the page turns into a 404.
 */
export const entityMonograph = cache(async (slug: string): Promise<Monograph | null> => {
  const sb = await createClient();
  const { data, error } = await sb.rpc("kb_entity_monograph", { p_slug: slug });
  if (error) throw new Error(error.message);
  const m = data as unknown as Monograph | null;
  if (!m || !m.entity) return null;
  return {
    ...m,
    axes: (m.axes ?? []).map((a) => ({
      ...a,
      excerpts: a.excerpts ?? [],
      claims: a.claims ?? [],
      coverage: a.coverage ?? [],
    })),
  };
});

/* ------------------------------------------------------------------ M4 --- */

/**
 * One source saying one thing about one marker in this entity.
 *
 * `claim` is a verified character span in the source document; `legacy` is an
 * older evidence row whose quote is stored but has not yet been re-found as a
 * span (`quote_located` says whether a later pass managed to). Every figure is
 * as PRINTED by that source — `pct_bound: "upper"` with `pct_high: 5` is the
 * source's "<5%", not ours — and nothing here is pooled.
 */
export interface MarkerAttestation {
  kind: "claim" | "legacy";
  claim_id?: string;
  evidence_id?: string;
  /** Source slug (`who-digestive-ed6`) or, for legacy rows, the source kind (`pubmed`, `who_chapter`, `pathoutlines`). */
  authority: string;
  /** "Digestive System Tumours (6th ed.)", or a journal name for PubMed rows. */
  authority_name: string;
  tier: number | null;
  eff_rank: number | null;
  edition: number | null;
  year: number | null;
  /** "72/123" for a chapter, or a PMID. */
  document_ref: string;
  url: string | null;
  /** Legacy only. */
  pmid?: string | null;
  /** Legacy only. */
  title?: string | null;
  polarity: "present" | "absent" | "indeterminate";
  nuance: "loss" | "retained" | "wildtype" | "index" | "aberrant" | null;
  modality: "asserted" | "typical" | "frequent" | "occasional" | "rare" | "reported" | "disputed";
  pct_low: number | null;
  pct_high: number | null;
  /** "upper" = the source printed "<x%"; "lower" = ">x%"; "approx" = "~x%". */
  pct_bound: "upper" | "lower" | "approx" | null;
  n_positive: number | null;
  n_total: number | null;
  denominator: "cases" | "cells" | null;
  /** e.g. "dot-like". */
  pattern: string | null;
  /** e.g. "clone_epitope=cytoplasmic domain". */
  scope: string | null;
  /** The sentence, verbatim, inline PMID markers included. */
  quote: string;
  /** PMIDs the source cites IN that sentence. */
  pmids: string[];
  support: "ex_cathedra" | "cited_primary" | "cited_textbook" | null;
  runs: string[];
  /** The same source states both polarities for this marker/scope. Show both; flag it. */
  contested: boolean;
  /** Legacy only. */
  quote_located?: "verified" | "unverified";
}

export interface MarkerRollupRow {
  marker: { id: string; slug: string; name: string; kind: string; compartment: string | null };
  /** none | single | unanimous | split — the only aggregate the page is allowed. */
  agreement: "none" | "single" | "unanimous" | "split";
  /** Claims first, then legacy; then eff_rank asc, edition desc, year desc. */
  attestations: MarkerAttestation[];
}

export interface MarkerRollup {
  entity: { id: string; slug: string; name: string; kind: string };
  generated_at: string;
  counts: { claims: number; attestations: number; legacy: number };
  /** Ordered by number of sources desc, then name. */
  markers: MarkerRollupRow[];
}

/**
 * Every marker statement attributed to one entity, per source, in ONE request.
 *
 * Like `entityMonograph` this is a single scalar jsonb row from a SECURITY
 * DEFINER function granted to anon, so the anon cookie client can call it and
 * PostgREST's row cap cannot truncate it. Returns null when the slug matches
 * nothing.
 */
export const entityMarkerRollup = cache(async (slug: string): Promise<MarkerRollup | null> => {
  const sb = await createClient();
  const { data, error } = await sb.rpc("kb_entity_marker_rollup", { p_slug: slug });
  if (error) throw new Error(error.message);
  const r = data as unknown as MarkerRollup | null;
  if (!r || !r.entity) return null;
  return {
    ...r,
    markers: (r.markers ?? []).map((m) => ({ ...m, attestations: m.attestations ?? [] })),
  };
});

/* ------------------------------------------------------ marker side --- */

export interface MarkerEntityRollupRow {
  entity: { id: string; slug: string; name: string; kind: string };
  agreement: "none" | "single" | "unanimous" | "split";
  attestations: MarkerAttestation[];
}

export interface MarkerEntityRollup {
  marker: { id: string; slug: string; name: string; kind: string; compartment: string | null };
  generated_at: string;
  counts: { claims: number; attestations: number; legacy: number };
  /** Ordered by number of sources desc, then entity name. */
  entities: MarkerEntityRollupRow[];
}

/**
 * The inverse of `entityMarkerRollup`: every entity one marker is reported in,
 * each source's own statement, same rules (never pooled, disagreement shown).
 */
export const markerEntityRollup = cache(async (slug: string): Promise<MarkerEntityRollup | null> => {
  const sb = await createClient();
  const { data, error } = await sb.rpc("kb_marker_entity_rollup", { p_slug: slug });
  if (error) throw new Error(error.message);
  const r = data as unknown as MarkerEntityRollup | null;
  if (!r || !r.marker) return null;
  return {
    ...r,
    entities: (r.entities ?? []).map((e) => ({ ...e, attestations: e.attestations ?? [] })),
  };
});
