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
export async function buildTopology(sb: Sb, part: TopologyPart): Promise<Topology> {
  const wantNodes = part !== "edges";
  const wantEdges = part !== "nodes";
  const none = async () => [] as Record<string, unknown>[];

  const [entities, placements, markers, genes, findings, surrogates, relations] = await Promise.all([
    // Entities are read either way: the nodes half draws them, and the edges
    // half needs their ids to reject edges that point outside the graph.
    // entities is now ONE ROW PER TUMOUR. Everything volume-specific — organ,
    // rank, parent, chapter — moved to entity_placements, which is why the
    // concept layer below is gone: `concepts` existed to collapse per-volume
    // duplicate rows into one node, and the rows are no longer duplicated.
    all(sb, "entities", "id, name, kind, icd_o"),
    all(sb, "entity_placements", "entity_id, volume, organ_system, rank, parent_id, chapter_name"),
    // `markers` absorbed `alterations`: one noun, distinguished by `kind`. The
    // split into two node types below is presentation only.
    // Read either way: the nodes half draws them, and the edges half needs
    // gene_symbols to rebuild what alteration_genes used to hold.
    all(sb, "markers", "id, name, kind, compartment, rung, gene_symbols"),
    // Genes are needed by both halves now -- as nodes, and to resolve the
    // symbols in markers.gene_symbols back to gene ids for the gene edges.
    all(sb, "genes", "id, symbol"),
    // One table now. Which family an edge belongs to is the marker's `kind`,
    // not which of two tables it was read from.
    wantEdges
      ? all(
          sb,
          "evidence",
          "entity_id, marker_id, call, pct_low, certainty, review_status, quote_located"
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

  /* ── one node per tumour ──
   *
   * WHO repeats the same tumour across volumes -- Schwannoma has nine chapter
   * rows, DLBCL ten -- and drawing each as its own node put the same disease in
   * ten places on the graph. `concepts` groups them; this collapses each group
   * to a single node and rewrites every edge endpoint onto it.
   *
   * The chapter rows are untouched in the database. Only the graph collapses,
   * and the detail endpoint opens each concept back up per chapter.
   */
  /* A tumour spans several volumes, so it usually has no single organ system.
   * It only claims one when a volume STRICTLY dominates -- otherwise there is no
   * mode to take and picking the first is the arbitrary tie-break that has
   * already bitten this project twice. Schwannoma is placed in nine volumes;
   * naming any of them its home would be invention. Those come back with no
   * organ, and the UI colours them as what they are: tumours that cut across the
   * whole classification. */
  const placeOf = new Map<string, Record<string, unknown>[]>();
  for (const p of placements) {
    const k = p.entity_id as string;
    placeOf.set(k, [...(placeOf.get(k) ?? []), p]);
  }
  const modalOrgan = (id: string) => {
    const counts = new Map<string, number>();
    for (const p of placeOf.get(id) ?? []) {
      const o = p.organ_system as string;
      if (o) counts.set(o, (counts.get(o) ?? 0) + 1);
    }
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    if (!ranked.length) return undefined;
    if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) return undefined;
    return ranked[0][0];
  };
  /* The chapter shown is the one from the volume that owns the entity, and a
   * tumour placed in several volumes has several. Show one only when it is
   * unambiguous, for the same reason the organ is withheld on a tie. */
  const soleChapter = (id: string) => {
    const names = new Set(
      (placeOf.get(id) ?? []).map((p) => (p.chapter_name as string)?.trim()).filter(Boolean)
    );
    return names.size === 1 ? [...names][0] : undefined;
  };

  const nodes = !wantNodes
    ? []
    : [
        // One node per tumour. No concept indirection: the rows are canonical.
        ...entities.map((e) => ({
          id: e.id,
          l: e.name,
          t: "entity",
          o: modalOrgan(e.id as string),
          w: soleChapter(e.id as string),
          k: e.kind,
          n: (placeOf.get(e.id as string) ?? []).length,
          icd: e.icd_o ?? undefined,
        })),
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
        // Subtype edges come from placements: a tumour can sit under a different
        // parent in each volume, and every one of those is a real WHO statement.
        // Deduped so two volumes agreeing draw one edge, not two.
        ...[
          ...new Map(
            placements
              .filter((p) => p.parent_id && entityIds.has(p.parent_id as string) && p.entity_id !== p.parent_id)
              .map((p) => [`${p.entity_id}|${p.parent_id}`, { s: p.entity_id, t: p.parent_id, e: "subtype" }])
          ).values(),
        ],
        // `v` stays review_status: the client filters edges against that
        // vocabulary, and handing it verification values instead would match
        // nothing and hide the entire graph. Verification rides along as `vf`.
        ...findings.map((f) =>
          GENOMIC.has(kindByMarker.get(f.marker_id as string) ?? "")
            ? {
                s: f.entity_id,
                t: f.marker_id,
                e: "alteration",
                c: f.certainty,
                v: f.review_status,
                vf: f.quote_located,
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
                vf: f.quote_located,
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

  /* ── pool the edges the collapse just made identical ──
   *
   * Ten DLBCL chapter rows each carrying a CD20 finding become ten copies of one
   * edge once they all point at the same concept. They are pooled into a single
   * edge that counts its attestations, so the graph can say CD20 was called
   * positive in 7 of 10 chapters rather than drawing the same line ten times.
   * Where chapters disagree -- positive in some, negative in others -- the
   * majority call wins the edge and the disagreement is carried on it, because
   * silently picking one would hide a real conflict in the source material.
   */
  const pooled = new Map<string, Record<string, unknown> & { n: number; alt?: number }>();
  for (const e of rawEdges) {
    const s2 = resolve(e.s as string);
    const t2 = resolve(e.t as string);
    if (s2 === t2) continue; // a subtype edge inside one concept is now a self-loop
    const key = `${s2}|${t2}|${e.e}`;
    const prev = pooled.get(key);
    if (!prev) {
      pooled.set(key, { ...e, s: s2, t: t2, n: 1 });
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
      entityRows: entities.length,
      concepts: concepts.length,
      // One table now; these two count the halves the cloud draws separately.
      markers: markers.filter((m) => !GENOMIC.has(m.kind as string)).length,
      alterations: markers.filter((m) => GENOMIC.has(m.kind as string)).length,
      genes: genes.length,
      subtypeEdges: edges.filter((x) => x.e === "subtype").length,
      expressionEdges: edges.filter((x) => x.e === "expression").length,
      verifiedFindings: findings.filter((f) => f.quote_located === "verified").length,
      failedFindings: findings.filter((f) => f.quote_located === "failed").length,
      alterationEdges: edges.filter((x) => x.e === "alteration").length,
      surrogateEdges: edges.filter((x) => x.e === "surrogate").length,
      relationEdges: edges.filter((x) => x.e === "relation").length,
      geneEdges: edges.filter((x) => x.e === "gene").length,
      findingsBeforePooling: rawEdges.length,
    },
  };
}
