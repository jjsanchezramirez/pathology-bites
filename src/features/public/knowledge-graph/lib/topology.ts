/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck knowledge graph tables are not in the generated Supabase types
/**
 * The knowledge graph's topology, built from the database.
 *
 * Lifted out of the debug API route so that the snapshot generator can build
 * exactly the same graph the explorer does. The route now wraps this in a
 * response; nothing else about it changed. A second implementation of the
 * concept collapse and the edge pooling is the one thing that would let a
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

  const [entities, concepts, markers, genes, findings, surrogates, relations] = await Promise.all([
    // Entities are read either way: the subtype edges are their parent_id, and
    // the concept mapping has to be applied to both halves of the payload.
    all(sb, "entities", "id, name, organ_system, kind, parent_id, chapter_name, concept_id"),
    all(sb, "concepts", "id, name, kind, icd_o, member_count, method"),
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

  /* ── one node per concept ──
   *
   * WHO repeats the same tumour across volumes -- Schwannoma has nine chapter
   * rows, DLBCL ten -- and drawing each as its own node put the same disease in
   * ten places on the graph. `concepts` groups them; this collapses each group
   * to a single node and rewrites every edge endpoint onto it.
   *
   * The chapter rows are untouched in the database. Only the graph collapses,
   * and the detail endpoint opens each concept back up per chapter.
   */
  const conceptOf = new Map<string, string>();
  for (const e of entities) if (e.concept_id) conceptOf.set(e.id, e.concept_id as string);
  const resolve = (id: string) => conceptOf.get(id) ?? id;

  /* A concept spans several volumes, so it usually has no single organ system.
   * It only claims one when a volume STRICTLY dominates -- otherwise there is no
   * mode to take and picking the first is the arbitrary tie-break that has
   * already bitten this project twice. Schwannoma has one row in each of nine
   * volumes; naming any of them its home would be invention. Those come back
   * with no organ, and the UI colours them as what they are: tumours that cut
   * across the whole classification. */
  const conceptOrgans = new Map<string, Map<string, number>>();
  for (const e of entities) {
    if (!e.concept_id) continue;
    let m = conceptOrgans.get(e.concept_id as string);
    if (!m) conceptOrgans.set(e.concept_id as string, (m = new Map()));
    m.set(e.organ_system as string, (m.get(e.organ_system as string) ?? 0) + 1);
  }
  const modalOrgan = (cid: string) => {
    const counts = [...(conceptOrgans.get(cid) ?? new Map<string, number>()).entries()].sort(
      (a, b) => b[1] - a[1]
    );
    if (!counts.length) return undefined;
    if (counts.length > 1 && counts[0][1] === counts[1][1]) return undefined;
    return counts[0][0];
  };

  const nodes = !wantNodes
    ? []
    : [
        // Entities appearing in a single volume stay as themselves...
        ...entities
          .filter((e) => !e.concept_id)
          .map((e) => ({
            id: e.id,
            l: e.name,
            t: "entity",
            o: e.organ_system,
            w: e.chapter_name?.trim() || undefined,
            k: e.kind,
            p: e.parent_id ?? undefined,
          })),
        // ...and the repeated ones appear once, as their concept.
        ...concepts.map((c) => ({
          id: c.id,
          l: c.name,
          t: "entity",
          o: modalOrgan(c.id),
          k: c.kind,
          n: c.member_count,
          icd: c.icd_o ?? undefined,
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
        ...entities
          .filter((e) => e.parent_id && entityIds.has(e.parent_id))
          .map((e) => ({ s: e.id, t: e.parent_id, e: "subtype" })),
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
