/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck knowledge graph tables are not in the generated Supabase types --
// same reason topology.ts carries this. The suppression stops HERE: every export
// below declares its own return type, so the pages that consume them are fully
// checked. Regenerating types would lift it; until then one untyped file beats
// a @ts-nocheck in each page.
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

export interface Finding {
  marker: { slug: string; name: string; kind: string };
  call: string | null;
  certainty: string | null;
  pct_low: number | null;
  pct_high: number | null;
  quote: string | null;
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
  findings: (Finding & { sources: number })[];
  differentials: { other: { slug: string; name: string }; evidence: string | null }[];
  children: { slug: string; name: string }[];
}

export async function entityDetail(entity: EntityRow): Promise<EntityDetail> {
  const sb = await createClient();

  const [placementsRaw, synonyms, evidenceRaw, diffOut, diffIn] = await Promise.all([
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
    all<{ marker_id: string; call: string | null; certainty: string | null; pct_low: number | null; pct_high: number | null; quote: string | null; review_status: string | null }>(
      () => sb.from("evidence")
        .select("marker_id, call, certainty, pct_low, pct_high, quote, review_status")
        .eq("entity_id", entity.id) as never
    ),
    all<{ to_entity: string; evidence: string | null }>(
      () => sb.from("entity_differentials").select("to_entity, evidence").eq("from_entity", entity.id) as never
    ),
    all<{ from_entity: string; evidence: string | null }>(
      () => sb.from("entity_differentials").select("from_entity, evidence").eq("to_entity", entity.id) as never
    ),
  ]);

  // Resolve every referenced entity and marker in one round trip each.
  const entityIds = [
    ...new Set([
      ...placementsRaw.map((p) => p.parent_id).filter(Boolean) as string[],
      ...diffOut.map((d) => d.to_entity),
      ...diffIn.map((d) => d.from_entity),
    ]),
  ];
  const markerIds = [...new Set(evidenceRaw.map((e) => e.marker_id).filter(Boolean))];

  const [ents, marks] = await Promise.all([
    entityIds.length
      ? sb.from("entities").select("id, slug, name").in("id", entityIds)
      : Promise.resolve({ data: [] as { id: string; slug: string; name: string }[] }),
    markerIds.length
      ? sb.from("markers").select("id, slug, name, kind").in("id", markerIds)
      : Promise.resolve({ data: [] as { id: string; slug: string; name: string; kind: string }[] }),
  ]);
  const eById = new Map((ents.data ?? []).map((e) => [e.id, e]));
  const mById = new Map((marks.data ?? []).map((m) => [m.id, m]));

  /* The unique key is (term_normalized, entity_id), and normalisation has
   * changed over time — so "Burkitt cell leukaemia" can sit alongside an
   * identically-spelled row that normalised differently. Fold them for display;
   * the rows themselves are harmless. */
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

  /* One row per (marker, source) — two books reporting the same thing are two
   * attestations, not a duplicate. Collapse to one line per marker for reading,
   * keeping the strongest call and counting the rest. Rejected rows never
   * surface: they failed review and asserting them would be worse than silence. */
  const byMarker = new Map<string, { f: Finding; n: number }>();
  for (const e of evidenceRaw) {
    if (e.review_status === "rejected") continue;
    const m = mById.get(e.marker_id);
    if (!m) continue;
    const prev = byMarker.get(m.slug);
    if (prev) {
      prev.n += 1;
      if (!prev.f.quote && e.quote) prev.f.quote = e.quote;
      continue;
    }
    byMarker.set(m.slug, {
      n: 1,
      f: {
        marker: { slug: m.slug, name: m.name, kind: m.kind },
        call: e.call,
        certainty: e.certainty,
        pct_low: e.pct_low,
        pct_high: e.pct_high,
        quote: e.quote,
      },
    });
  }

  const findings = [...byMarker.values()]
    .map((v) => ({ ...v.f, sources: v.n }))
    .sort((a, b) => b.sources - a.sources || a.marker.name.localeCompare(b.marker.name));

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
    findings,
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
  entities: { slug: string; name: string; kind: string; call: string | null; sources: number }[];
}

export async function markerDetail(slug: string): Promise<MarkerDetail | null> {
  const sb = await createClient();
  const { data: marker } = await sb
    .from("markers")
    .select("id, slug, name, kind, compartment, gene_symbols, definition")
    .eq("slug", slug)
    .maybeSingle();
  if (!marker) return null;

  const [synonyms, ev] = await Promise.all([
    all<{ term: string }>(() => sb.from("marker_synonyms").select("term").eq("marker_id", marker.id).order("term") as never),
    all<{ entity_id: string; call: string | null; certainty: string | null; review_status: string | null }>(
      () => sb.from("evidence").select("entity_id, call, certainty, review_status").eq("marker_id", marker.id) as never
    ),
  ]);

  const ids = [...new Set(ev.filter((e) => e.review_status !== "rejected").map((e) => e.entity_id))];
  const { data: ents } = ids.length
    ? await sb.from("entities").select("id, slug, name, kind").in("id", ids)
    : { data: [] as { id: string; slug: string; name: string; kind: string }[] };
  const byId = new Map((ents ?? []).map((e) => [e.id, e]));

  const seen = new Map<string, { slug: string; name: string; kind: string; call: string | null; sources: number }>();
  for (const e of ev) {
    if (e.review_status === "rejected") continue;
    const ent = byId.get(e.entity_id);
    if (!ent) continue;
    const prev = seen.get(ent.slug);
    if (prev) prev.sources += 1;
    else seen.set(ent.slug, { slug: ent.slug, name: ent.name, kind: ent.kind, call: e.call, sources: 1 });
  }

  return {
    marker,
    synonyms,
    entities: [...seen.values()].sort((a, b) => b.sources - a.sources || a.name.localeCompare(b.name)),
  };
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
