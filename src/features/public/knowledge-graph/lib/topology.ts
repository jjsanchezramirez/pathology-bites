/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck knowledge graph tables are not in the generated Supabase types
/**
 * The knowledge graph's topology, built from the database.
 *
 * Lifted out of the debug API route so that the snapshot generator can build
 * exactly the same graph the explorer does. The route now wraps this in a
 * response; nothing else about it changed. A second implementation of the
 * per-tumour collapse and the edge pooling is the one thing that would let a
 * baked homepage snapshot and the live explorer disagree about the data.
 */
import { createServiceRoleClient } from "@/shared/services/service-role-client";

export type TopologyPart = "all" | "nodes" | "edges";

export interface Topology {
  part: TopologyPart;
  nodes: Record<string, unknown>[];
  edges: Record<string, unknown>[];
  meta: Record<string, number>;
}

const PAGE = 1000;

export type Sb = ReturnType<typeof createServiceRoleClient>;

/** How many page requests for one table are in flight at once. */
const FANOUT = 6;

async function all<T = Record<string, unknown>>(sb: Sb, table: string, cols: string): Promise<T[]> {
  /* The first page also asks for the row count, which turns the rest of the
   * read from a chain into a fan-out. It used to walk the pages one after
   * another: `evidence` alone is 25 pages, so the edges half of the payload
   * spent about seven seconds doing twenty-five sequential round trips while
   * the client sat looking at a cloud it could not do anything with. Knowing
   * the total up front means every remaining page can be asked for at once.
   *
   * Capped at FANOUT in flight rather than all at once -- forty concurrent
   * PostgREST requests is a good way to find out what the connection pool
   * thinks of you, and past a handful there is nothing left to win anyway.
   */
  const first = await sb
    .from(table)
    .select(cols, { count: "exact" })
    .order("id", { ascending: true })
    .range(0, PAGE - 1);
  if (first.error) throw new Error(`${table}: ${first.error.message}`);

  const out = (first.data ?? []) as T[];
  const total = first.count ?? out.length;
  if (out.length < PAGE || out.length >= total) return out;

  const offsets: number[] = [];
  for (let from = PAGE; from < total; from += PAGE) offsets.push(from);

  for (let i = 0; i < offsets.length; i += FANOUT) {
    const batch = await Promise.all(
      offsets.slice(i, i + FANOUT).map((from) =>
        sb
          .from(table)
          .select(cols)
          .order("id", { ascending: true })
          .range(from, from + PAGE - 1)
      )
    );
    for (const page of batch) {
      if (page.error) throw new Error(`${table}: ${page.error.message}`);
      out.push(...((page.data ?? []) as T[]));
    }
  }
  return out;
}

/* ── topology ──────────────────────────────────────────────────────────────
 *
 * Keys are short because edges outnumber nodes 3:1 and the whole set ships in
 * one response:
 *
 *   node  { id, l: label, t: type, o: organ, k: kind, c: compartment, p: parent }
 *   edge  { s: source, t: target, e: edgeType, ...per-type extras }
 *
 *     expression   r result   p percentage   c certainty   v review_status
 *     alteration   f frequency_pct   c certainty   v review_status
 *     surrogate    d direction   sn sensitivity_pct   sp specificity_pct
 *     relation     r relation
 *     gene         r role
 *     subtype      (none -- entity.parent_id, child -> parent)
 */
/**
 * The topology splits in two on request.
 *
 * Nodes are roughly a fifth of the payload and are all the client needs to put
 * something on screen; edges are the other four fifths and are only needed once
 * communities are being computed. Serving them separately is what lets the page
 * show a cloud in well under a second instead of staring at nothing for four.
 */
/* ── topology ──────────────────────────────────────────────────────────────
 *
 * Keys are short because edges outnumber nodes 3:1 and the whole set ships in
 * one response:
 *
 *   node  { id, l: label, t: type, o: organ, w: chapter, k: kind, p: parent }
 *   edge  { s: source, t: target, e: edgeType, ...per-type extras }
 *
 *     expression   r result   p percentage   c certainty   v review_status
 *     alteration   r present/absent   c certainty   v review_status
 *     surrogate    d direction   sn sensitivity_pct   sp specificity_pct
 *     relation     r relation
 *     gene         r role
 *     subtype      (none -- placement.parent_id, child -> parent)
 *
 * ── one node per entity, without help ──
 *
 * `entities` is already canonical: the same tumour described in nine volumes is
 * one row, and `entity_placements` records where each of those descriptions
 * sits. This used to be assembled here, from a `concepts` table and a collapse
 * that rewrote every edge endpoint -- that machinery is gone, along with the
 * pooling of the duplicate edges it created. What is left is a straight read.
 */
export async function buildTopology(sb: Sb, part: TopologyPart): Promise<Topology> {
  const wantNodes = part !== "edges";
  const wantEdges = part !== "nodes";
  const none = async () => [] as Record<string, unknown>[];

  const [entities, placements, markers, genes, findings, surrogates, relations] =
    await Promise.all([
      all(sb, "entities", "id, name, kind, icd_o"),
      // Read either way: it carries the organ and chapter a node is coloured by,
      // and the parent_id the subtype edges are built from.
      all(sb, "entity_placements", "entity_id, organ_system, chapter_name, parent_id, rank"),
      // `markers` absorbed `alterations`: one noun, distinguished by `kind`. The
      // split into two node types below is presentation only.
      all(sb, "markers", "id, name, kind, compartment, rung, gene_symbols"),
      all(sb, "genes", "id, symbol"),
      wantEdges
        ? all(
            sb,
            "evidence",
            "entity_id, marker_id, call, pct_low, certainty, review_status"
          )
        : none(),
      wantEdges
        ? all(
            sb,
            "surrogates",
            "alteration_id, marker_id, direction, sensitivity_pct, specificity_pct"
          )
        : none(),
      wantEdges ? all(sb, "entity_relations", "from_entity, to_entity, relation") : none(),
    ]);

  /* A marker's `kind` says which instrument reaches it, and that is the only
   * difference between what used to be two tables. The cloud still draws them
   * as two families because they read differently to a pathologist -- a stain
   * is not a sequencing result -- but the database has one noun. */
  const GENOMIC = new Set([
    "mutation",
    "fusion",
    "rearrangement",
    "deletion",
    "amplification",
    "methylation",
    "aneuploidy",
  ]);
  const kindByMarker = new Map(
    (markers as { id: string; kind: string }[]).map((m) => [m.id, m.kind])
  );
  const geneIdBySymbol = new Map(
    (genes as { id: string; symbol: string }[]).map((g) => [g.symbol, g.id])
  );

  /* ── where each entity lives ──
   *
   * An entity described in several volumes has several placements and so
   * several organs. It only claims one when a volume STRICTLY dominates --
   * otherwise there is no mode to take and picking the first is the arbitrary
   * tie-break that has already bitten this project twice. Schwannoma has one
   * placement in each of nine volumes; naming any of them its home would be
   * invention. Those come back with no organ, and the UI colours them as what
   * they are: tumours that cut across the whole classification.
   */
  const byEntity = new Map<string, Record<string, unknown>[]>();
  for (const p of placements) {
    const key = p.entity_id as string;
    let list = byEntity.get(key);
    if (!list) byEntity.set(key, (list = []));
    list.push(p);
  }

  const homeOf = (id: string) => {
    const list = byEntity.get(id) ?? [];
    if (!list.length) return { organ: undefined, chapter: undefined, count: 0 };
    const counts = new Map<string, number>();
    for (const p of list) {
      const organ = p.organ_system as string;
      if (organ) counts.set(organ, (counts.get(organ) ?? 0) + 1);
    }
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const dominant =
      ranked.length && !(ranked.length > 1 && ranked[0][1] === ranked[1][1])
        ? ranked[0][0]
        : undefined;
    // The chapter is only meaningful alongside the organ it sits in.
    const chapter = dominant
      ? (list.find((p) => p.organ_system === dominant)?.chapter_name as string | undefined)
      : undefined;
    return { organ: dominant, chapter: chapter?.trim() || undefined, count: list.length };
  };

  const nodes = !wantNodes
    ? []
    : [
        ...entities.map((e) => {
          const home = homeOf(e.id as string);
          return {
            id: e.id,
            l: e.name,
            t: "entity",
            o: home.organ,
            w: home.chapter,
            k: e.kind,
            // How many volumes describe this one tumour, when more than one.
            n: home.count > 1 ? home.count : undefined,
            icd: e.icd_o ?? undefined,
          };
        }),
        ...markers.map((m) => ({
          id: m.id,
          l: m.name,
          t: GENOMIC.has(m.kind as string) ? "alteration" : "marker",
          k: m.kind,
          c: m.compartment ?? undefined,
          rg: m.rung ?? undefined,
        })),
        ...genes.map((g) => ({ id: g.id, l: g.symbol, t: "gene" })),
      ];

  // A parent_id pointing at a row that is not in `entities` would draw an edge
  // into nothing; the force layout then flings the orphan off-screen.
  const entityIds = new Set(entities.map((e) => e.id));

  const rawEdges = !wantEdges
    ? []
    : [
        ...placements
          .filter((p) => p.parent_id && entityIds.has(p.parent_id))
          .map((p) => ({ s: p.entity_id, t: p.parent_id, e: "subtype" })),
        ...findings.map((f) =>
          GENOMIC.has(kindByMarker.get(f.marker_id as string) ?? "")
            ? {
                s: f.entity_id,
                t: f.marker_id,
                e: "alteration",
                c: f.certainty,
                v: f.review_status,
                // A negative call is a real claim ("this tumour does NOT carry
                // X") and must never render the same as a positive one.
                r: f.call === "negative" ? "absent" : "present",
              }
            : {
                s: f.entity_id,
                t: f.marker_id,
                e: "expression",
                r: f.call,
                p: f.pct_low ?? undefined,
                c: f.certainty,
                v: f.review_status,
              }
        ),
        ...surrogates.map((s) => ({
          s: s.alteration_id,
          t: s.marker_id,
          e: "surrogate",
          d: s.direction,
          sn: s.sensitivity_pct ?? undefined,
          sp: s.specificity_pct ?? undefined,
        })),
        ...relations.map((r) => ({
          s: r.from_entity,
          t: r.to_entity,
          e: "relation",
          r: r.relation,
        })),
        // gene_symbols replaced alteration_genes. Array order carries the role
        // that column used to: for a fusion, {5', 3'}.
        ...markers.flatMap((m) =>
          ((m.gene_symbols as string[] | null) ?? []).flatMap((sym, i) => {
            const gid = geneIdBySymbol.get(sym);
            if (!gid) return [];
            return [
              {
                s: m.id,
                t: gid,
                e: "gene",
                r: m.kind === "fusion" ? (i === 0 ? "five_prime" : "three_prime") : "affected",
              },
            ];
          })
        ),
      ];

  /* ── pool the repeats ──
   *
   * Less work than it used to be, but not none. A tumour placed in several
   * volumes has a parent in each, and several sources can report the same
   * finding, so the same pair still arrives more than once. They are pooled
   * into a single edge that counts its attestations; where the reports
   * disagree, the majority wins and the disagreement is carried on the edge,
   * because silently picking one would hide a real conflict in the source.
   */
  const pooled = new Map<string, Record<string, unknown> & { n: number; alt?: number }>();
  for (const e of rawEdges) {
    if (e.s === e.t) continue;
    const key = `${e.s}|${e.t}|${e.e}`;
    const prev = pooled.get(key);
    if (!prev) {
      pooled.set(key, { ...e, n: 1 });
      continue;
    }
    prev.n++;
    if (prev.r !== e.r) prev.alt = (prev.alt ?? 0) + 1;
  }
  const edges = [...pooled.values()];

  return {
    part,
    nodes,
    edges,
    meta: {
      entities: nodes.filter((n) => n.t === "entity").length,
      placements: placements.length,
      multiVolume: [...byEntity.values()].filter((l) => l.length > 1).length,
      markers: markers.filter((m) => !GENOMIC.has(m.kind as string)).length,
      alterations: markers.filter((m) => GENOMIC.has(m.kind as string)).length,
      genes: genes.length,
      subtypeEdges: edges.filter((x) => x.e === "subtype").length,
      expressionEdges: edges.filter((x) => x.e === "expression").length,
      alterationEdges: edges.filter((x) => x.e === "alteration").length,
      surrogateEdges: edges.filter((x) => x.e === "surrogate").length,
      relationEdges: edges.filter((x) => x.e === "relation").length,
      geneEdges: edges.filter((x) => x.e === "gene").length,
      findingsBeforePooling: rawEdges.length,
    },
  };
}
