/* eslint-disable no-console -- a CLI tool; its output IS the interface */
/**
 * Bakes the knowledge graph into static snapshots for the public cloud.
 *
 *   npx tsx src/features/public/knowledge-graph/scripts/build-snapshot.ts
 *   ... --publish        also uploads them to R2
 *   ... --hero-nodes=N   size of the hero cut (default 1500)
 *
 * TWO snapshots, from one read of the database and published in one call: the
 * explorer's full cloud, and a sparse cut for the landing-page hero. The hero
 * draws a backdrop rather than a map, and every node it carries is paid for on
 * every frame for as long as the page is open -- see `bake`.
 *
 * The public cloud has no API. It downloads one brotli'd file and draws it,
 * which is the only way it can appear fast enough to belong on a landing page:
 * the live explorer spends seconds fetching five megabytes of JSON and then a
 * second or two more running Leiden in a worker before anything takes shape.
 *
 * What is baked is the EXPENSIVE half of the layout -- the partition and the
 * per-cluster force simulations. Seating those clusters on a sphere stays on
 * the client because it costs microseconds and because it is what the shape
 * controls drive. See `GraphSnapshot`.
 *
 * The graph itself is built by `buildTopology`, the same function the debug API
 * route serves, and the partition by `computeLayout`, the same function the
 * browser worker runs. Neither is reimplemented here; if either changes, this
 * changes with it.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

import { computeLayout } from "../lib/community";
import { decodeSnapshot, encodeSnapshot } from "../lib/snapshot-codec";
import {
  EDGE_KINDS,
  EDGE_RESULTS,
  EDGE_WEIGHT,
  HUB_DAMPING,
  POLAR_KINDS,
  PUBLIC_POLARITIES,
  LEIDEN_RESOLUTION,
  NODE_TYPES,
  type EdgeType,
} from "../lib/model";
import { buildTopology } from "../lib/topology";

const OUT_DIR = path.resolve(process.cwd(), "public/data");
const OUT_NAME = "knowledge-graph.bin";
const HERO_NAME = "knowledge-graph-hero.bin";
/** Matches the prefixes already in use in the bucket; see TOOLING-INDEX. */
const R2_PREFIX = "knowledge-graph/";
/** Rewritten on every publish; the compiled fallback in knowledge-graph-data.ts. */
const R2_FALLBACK = "cloud-v1.bin.br";
/** The hero's sparse cut, published beside the full cloud under one manifest. */
const R2_HERO = "hero-v1.bin.br";
/**
 * How many nodes the landing page gets.
 *
 * Not a download budget -- the full cloud is only 80KB brotli'd. It is a
 * per-frame budget: every node is paid for in the projection pass, the label
 * candidate pass, the magnet scan and the line rasteriser, on every frame, for
 * as long as the page is open. Fifteen hundred keeps every hub and the shape
 * they make; the rest of the cloud was texture.
 */
const HERO_NODES = 1500;
/** Publishing is blocked below this fraction of the live snapshot's size. */
const REGRESSION_FLOOR = 0.9;

/** No dotenv in this project, and Next's loader is not running here. */
function loadEnvLocal() {
  const file = path.resolve(process.cwd(), ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    const value = m[2].replace(/^["']|["']$/g, "");
    if (!process.env[m[1]]) process.env[m[1]] = value;
  }
}

const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`;

async function main() {
  loadEnvLocal();
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY missing — is .env.local present?");
  }
  // Imported lazily: the module reads env at call time, and env is only just set.
  const { createServiceRoleClient } = await import("@/shared/services/service-role-client");
  const sb = createServiceRoleClient();

  console.log("reading the graph…");
  const topo = await buildTopology(sb, "all");
  const rawNodes = topo.nodes as { id: string; l: string; t: string; o?: string; w?: string }[];
  const rawEdges = topo.edges as { s: string; t: string; e: string; r?: string }[];

  /* The same two guards the client applies. Nodes and edges are read in one
   * pass here rather than two requests, so a mismatch is far less likely than
   * it is in the browser -- but "far less likely" is not a reason to bake a
   * broken file that would then be served for a week. */
  const seen = new Set<string>();
  const nodes: typeof rawNodes = rawNodes.filter((n) => !seen.has(n.id) && (seen.add(n.id), true));
  const index = new Map(nodes.map((n, i) => [n.id, i]));
  const edges: typeof rawEdges = rawEdges.filter((e) => index.has(e.s) && index.has(e.t));
  if (nodes.length !== rawNodes.length || edges.length !== rawEdges.length) {
    console.log(
      `  dropped ${rawNodes.length - nodes.length} duplicate nodes, ` +
        `${rawEdges.length - edges.length} edges with a missing end`
    );
  }
  console.log(`  ${rawNodes.length} nodes, ${rawEdges.length} edges before pruning`);

  const minLinks = Number(
    process.argv.find((a) => a.startsWith("--min-entity-links="))?.split("=")[1] ?? 2
  );
  const keepGenes = process.argv.includes("--keep-genes");
  const heroNodes = Number(
    process.argv.find((a) => a.startsWith("--hero-nodes="))?.split("=")[1] ?? HERO_NODES
  );

  const cloud = bake(nodes, edges, { minLinks, keepGenes, maxNodes: 0, label: "cloud" });
  const hero = bake(nodes, edges, {
    minLinks,
    keepGenes,
    maxNodes: heroNodes,
    label: "hero",
  });

  /* Written to disk only when asked. The artifact belongs in R2; a copy under
   * public/ is a second source of truth that goes stale the moment anything is
   * republished, and it used to be what the debug page read. */
  if (process.argv.includes("--local")) {
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(path.join(OUT_DIR, OUT_NAME), cloud.packed);
    writeFileSync(path.join(OUT_DIR, `${OUT_NAME}.br`), cloud.compressed);
    writeFileSync(path.join(OUT_DIR, HERO_NAME), hero.packed);
    writeFileSync(path.join(OUT_DIR, `${HERO_NAME}.br`), hero.compressed);
    console.log(`  also written to ${path.join(OUT_DIR, OUT_NAME)}`);
  }

  if (!process.argv.includes("--publish")) {
    console.log("\nnot published — pass --publish to upload to R2.");
    return;
  }

  /* r2_common is the only correct way to talk to the bucket, and
   * publishVersioned owns the content-addressing contract from CLAUDE.md: it
   * writes an immutable `cloud-v1-<hash>.bin.br`, rewrites the fixed key as a
   * short-TTL fallback, and flips manifest.json to point at the new object.
   * Old versions are left in place deliberately -- they cost almost nothing and
   * any of them is a working snapshot to roll back to. */
  const r2 = await import("../../../../../dev/resources/scrapers/r2_common.mjs");
  const env = r2.loadEnv();
  const s3 = r2.makeClient(env);

  /* Safety gate, copied in spirit from the corpus publisher: refuse to
   * overwrite a good snapshot with a much smaller one. These tables get
   * rewritten in place during curation work, and a scheduled job that happened
   * to run mid-migration would otherwise serve a half-empty map for a week.
   * A real shrink is possible, so --force exists; it just has to be deliberate. */
  const existing = await r2.getBytes(s3, `${R2_PREFIX}${R2_FALLBACK}`).catch(() => null);
  if (existing) {
    const raw = r2.unbrotli(existing) as Buffer;
    const prev = decodeSnapshot(new Uint8Array(raw).buffer as ArrayBuffer);
    /* Gated on the full cloud only. The hero cut is a fixed head count by
     * construction, so comparing it to anything would just be asserting that
     * HERO_NODES has not changed. */
    const worst = Math.min(
      cloud.nodes / prev.labels.length,
      cloud.edges / prev.edgeSource.length
    );
    console.log(
      `\npublished snapshot has ${prev.labels.length} nodes / ${prev.edgeSource.length} edges; ` +
        `this one has ${cloud.nodes} / ${cloud.edges}`
    );
    if (worst < REGRESSION_FLOOR && !process.argv.includes("--force")) {
      throw new Error(
        `refusing to publish: down to ${(worst * 100).toFixed(1)}% of the live snapshot. ` +
          `If the graph really did shrink, re-run with --force.`
      );
    }
  }

  /* BOTH artifacts in ONE call, and this is not a style choice.
   * `publishVersioned` writes manifest.json from the artifacts it was handed --
   * it does not merge with what is already in the bucket. Publishing the hero
   * on its own would therefore delete the `cloud` entry and leave the explorer
   * resolving its compiled fallback until the next full run. This is the
   * shared-prefix trap from CLAUDE.md, in the one prefix that now has two
   * datasets in it. */
  const { manifest } = await r2.publishVersioned(s3, {
    prefix: R2_PREFIX,
    artifacts: [
      {
        key: R2_FALLBACK,
        manifestKey: "cloud",
        body: cloud.compressed,
        contentType: "application/octet-stream",
        contentEncoding: "br",
      },
      {
        key: R2_HERO,
        manifestKey: "hero",
        body: hero.compressed,
        contentType: "application/octet-stream",
        contentEncoding: "br",
      },
    ],
    extra: {
      built: new Date().toISOString(),
      nodes: cloud.nodes,
      edges: cloud.edges,
      groups: cloud.groups,
      rawBytes: cloud.packed.length,
      heroNodes: hero.nodes,
      heroEdges: hero.edges,
    },
  });

  const entries = manifest as Record<string, { url: string; hash: string; bytes: number }>;
  for (const key of ["cloud", "hero"]) {
    const entry = entries[key];
    console.log(
      `\npublished ${r2.BUCKET}/${R2_PREFIX} ${key} v=${entry.hash} (${kb(entry.bytes)})`
    );
    console.log(`  ${entry.url}`);
  }
  console.log("  the app resolves these from manifest.json — no redeploy needed.");
}

type RawNode = { id: string; l: string; t: string; o?: string; w?: string };
type RawEdge = { s: string; t: string; e: string; r?: string };

type Baked = {
  packed: Uint8Array;
  compressed: Buffer;
  nodes: number;
  edges: number;
  groups: number;
};

/**
 * Prune, group, lay out and encode one snapshot.
 *
 * Called twice: once for the explorer's full cloud and once for the hero's
 * sparse cut. It takes copies, because the pruning below rewrites its inputs in
 * place and the second call needs the same graph the first one started from.
 */
function bake(
  allNodes: RawNode[],
  allEdges: RawEdge[],
  opts: { minLinks: number; keepGenes: boolean; maxNodes: number; label: string }
): Baked {
  const { minLinks, keepGenes, maxNodes, label } = opts;
  console.log(`\nbaking the ${label} snapshot…`);
  const nodes: RawNode[] = [...allNodes];
  const edges: RawEdge[] = [...allEdges];
  const index = new Map(nodes.map((n, i) => [n.id, i]));

  /* ── prune to what the public cloud actually draws ──────────────────────
   *
   * Three cuts, in order of how much they buy.
   *
   * NEGATIVES. "This tumour is NOT CD5" is a real claim, but drawn as a line it
   * looks exactly like a presence, so the public cloud never shows one. Nothing
   * is served by shipping them.
   *
   * GENES. They hang off markers, not off tumours — a third layer that answers
   * a question ("which gene is behind this stain") the cloud is not asking.
   *
   * LEAF MARKERS. This is the big one: of roughly 5,400 markers and
   * alterations, over 3,100 touch exactly ONE entity. A marker on a single
   * tumour cannot relate two things, which is the only thing this graph is for
   * — so it contributes a dot, a line, and no structure. Cutting at two
   * entities takes the file from 230 KB to about 70 and, going by the size
   * distribution, mostly deletes the dust the layout was already fighting.
   *
   * Entities are never pruned. They are the subject.
   */
  const drawable = edges.filter((e) => {
    const kind = e.e as EdgeType;
    return !(POLAR_KINDS.has(kind) && e.r && !PUBLIC_POLARITIES.has(e.r));
  });

  const typeOf = new Map(nodes.map((n) => [n.id, n.t]));
  const entitiesTouching = new Map<string, Set<string>>();
  for (const e of drawable) {
    for (const [x, y] of [
      [e.s, e.t],
      [e.t, e.s],
    ]) {
      if (typeOf.get(x) === "entity" || typeOf.get(y) !== "entity") continue;
      let set = entitiesTouching.get(x);
      if (!set) entitiesTouching.set(x, (set = new Set()));
      set.add(y);
    }
  }

  const keep = new Set<string>();
  for (const n of nodes) {
    if (n.t === "entity") keep.add(n.id);
    else if (n.t === "gene") {
      if (keepGenes) keep.add(n.id);
    } else if ((entitiesTouching.get(n.id)?.size ?? 0) >= minLinks) keep.add(n.id);
  }

  let kept = nodes.filter((n) => keep.has(n.id));
  let keptEdges = drawable.filter((e) => keep.has(e.s) && keep.has(e.t));

  /* ── the hero cut ──
   *
   * The landing page draws a backdrop, not a map. Ranked by drawn degree and
   * cut to the best-connected `maxNodes`: what survives is the structure --
   * the hubs and the tumours hanging off them -- and what goes is the rim of
   * nearly-isolated dots that reads as texture but costs a full pass each in
   * the projection, the label candidates and the magnet scan, sixty times a
   * second, forever. Edges follow their endpoints.
   *
   * Ties break on id so a rebuild of the same data cuts the same way.
   */
  if (maxNodes && kept.length > maxNodes) {
    const deg = new Map<string, number>();
    for (const e of keptEdges) {
      deg.set(e.s, (deg.get(e.s) ?? 0) + 1);
      deg.set(e.t, (deg.get(e.t) ?? 0) + 1);
    }
    const top = new Set(
      [...kept]
        .sort((a, b) => (deg.get(b.id) ?? 0) - (deg.get(a.id) ?? 0) || a.id.localeCompare(b.id))
        .slice(0, maxNodes)
        .map((n) => n.id)
    );
    kept = kept.filter((n) => top.has(n.id));
    keptEdges = keptEdges.filter((e) => top.has(e.s) && top.has(e.t));
    console.log(`  cut to the ${kept.length} best-connected nodes`);
  }
  console.log(
    `  keeping every entity, markers linking >= ${minLinks} of them` +
      `${keepGenes ? ", genes" : ", no genes"}`
  );
  console.log(`  ${kept.length} nodes, ${keptEdges.length} edges after pruning`);

  nodes.length = 0;
  nodes.push(...kept);
  edges.length = 0;
  edges.push(...keptEdges);
  index.clear();
  nodes.forEach((n, i) => index.set(n.id, i));

  /* ── group by the classification, not by modularity ──
   *
   * WHO already says what belongs with what, and it says it far better than
   * modularity can infer it from shared stains. Leiden on this graph returns
   * about five hundred communities with a median of eight nodes, and neither
   * resolution nor hub damping shifts that by more than a few per cent -- the
   * structure really is that fine. Rolled up to their taxonomic roots the same
   * entities form 127 groups with a median of 21 and a largest over a
   * thousand: "Soft tissue and bone tumours", "Melanocytic neoplasms", "CNS
   * tumours". Those are groups a pathologist would recognise, which is the
   * whole point of the colour and the clustering.
   *
   * Markers and alterations have no place in the hierarchy, so each takes the
   * group most of the entities it touches belong to. A universal stain lands
   * somewhere fairly arbitrary, but it is one dot and it has no home to be
   * wrong about.
   */
  const parentOf = new Map<string, string>();
  for (const e of edges) {
    if (e.e !== "subtype") continue;
    // Several volumes can name different parents; the lowest id, so a rebuild
    // of the same data always produces the same grouping.
    const had = parentOf.get(e.s as string);
    if (!had || (e.t as string) < had) parentOf.set(e.s as string, e.t as string);
  }
  const rootOf = new Map<string, string>();
  const rootFor = (id: string) => {
    const cached = rootOf.get(id);
    if (cached) return cached;
    const path: string[] = [];
    let at = id;
    const seen = new Set<string>();
    while (parentOf.has(at) && !seen.has(at)) {
      seen.add(at);
      path.push(at);
      at = parentOf.get(at)!;
    }
    for (const step of path) rootOf.set(step, at);
    rootOf.set(at, at);
    return at;
  };

  const groupId = new Map<string, number>();
  const groupOf = new Int32Array(nodes.length);
  const claim = (key: string) => {
    let g = groupId.get(key);
    if (g === undefined) groupId.set(key, (g = groupId.size));
    return g;
  };
  const entityGroup = new Map<string, number>();
  nodes.forEach((n, i) => {
    if (n.t !== "entity") return;
    const g = claim(rootFor(n.id));
    groupOf[i] = g;
    entityGroup.set(n.id, g);
  });

  // Markers take the group most of their entities sit in.
  const votes = new Map<string, Map<number, number>>();
  for (const e of edges) {
    if (e.e !== "expression" && e.e !== "alteration") continue;
    const from = entityGroup.get(e.s as string);
    const marker = e.t as string;
    if (from === undefined) continue;
    let tally = votes.get(marker);
    if (!tally) votes.set(marker, (tally = new Map()));
    tally.set(from, (tally.get(from) ?? 0) + 1);
  }
  nodes.forEach((n, i) => {
    if (n.t === "entity") return;
    const tally = votes.get(n.id);
    if (!tally || !tally.size) {
      groupOf[i] = claim(`orphan:${n.id}`);
      return;
    }
    groupOf[i] = [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
  });
  console.log(`  ${groupId.size} taxonomic groups`);

  console.log("running the cluster layouts…");
  const kindIndex = new Map(EDGE_KINDS.map((k, i) => [k, i]));
  const triples = new Int32Array(edges.length * 3);
  edges.forEach((e, i) => {
    triples[i * 3] = index.get(e.s)!;
    triples[i * 3 + 1] = index.get(e.t)!;
    triples[i * 3 + 2] = kindIndex.get(e.e as never) ?? 0;
  });
  const layout = computeLayout({
    n: nodes.length,
    edges: triples,
    kindWeights: Float64Array.from(EDGE_KINDS, (k) => EDGE_WEIGHT[k]),
    resolution: LEIDEN_RESOLUTION,
    damping: HUB_DAMPING,
    communities: groupOf,
  });
  console.log(`  ${layout.count} communities drawn in ${layout.ms}ms`);

  const organs = [...new Set(nodes.map((n) => n.o).filter(Boolean))] as string[];
  const chapters = [...new Set(nodes.map((n) => n.w).filter(Boolean))] as string[];
  const organIndex = new Map(organs.map((o, i) => [o, i]));
  const chapterIndex = new Map(chapters.map((c, i) => [c, i]));

  /* ── reindex by community ──
   *
   * Worth doing purely for the encoding. It makes the community column a run of
   * repeated values, and it makes edge endpoints local, since most edges join
   * two nodes in the same community and those are now adjacent indices. The
   * edge list gets most of its compression from this, not from the varints.
   */
  const seat = [...nodes.keys()].sort(
    (a, b) => layout.communities[a] - layout.communities[b] || a - b
  );
  const rank = new Int32Array(nodes.length);
  seat.forEach((was, now) => (rank[was] = now));

  const flatEdges: number[] = [];
  for (const e of edges) {
    flatEdges.push(
      rank[index.get(e.s)!],
      rank[index.get(e.t)!],
      kindIndex.get(e.e as never) ?? 0,
      Math.max(0, EDGE_RESULTS.indexOf(e.r as never))
    );
  }

  const packed = encodeSnapshot({
    organs,
    chapters,
    labels: seat.map((i) => nodes[i].l),
    type: seat.map((i) => Math.max(0, NODE_TYPES.indexOf(nodes[i].t as never))),
    organ: seat.map((i) => (nodes[i].o ? (organIndex.get(nodes[i].o!) ?? -1) : -1)),
    chapter: seat.map((i) => (nodes[i].w ? (chapterIndex.get(nodes[i].w!) ?? -1) : -1)),
    community: seat.map((i) => layout.communities[i]),
    offsets: seat.flatMap((i) => [
      layout.offsets[i * 3],
      layout.offsets[i * 3 + 1],
      layout.offsets[i * 3 + 2],
    ]),
    edges: flatEdges,
    order: Array.from(layout.order),
    family: Array.from(layout.family),
  });

  const compressed = zlib.brotliCompressSync(Buffer.from(packed), {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
      [zlib.constants.BROTLI_PARAM_LGWIN]: 24,
    },
  });

  console.log(
    `\nsnapshot ${kb(packed.length)} raw -> ${kb(compressed.length)} brotli ` +
      `(${(packed.length / compressed.length).toFixed(1)}x)`
  );
  return {
    packed,
    compressed,
    nodes: nodes.length,
    edges: edges.length,
    groups: layout.count,
  };
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
