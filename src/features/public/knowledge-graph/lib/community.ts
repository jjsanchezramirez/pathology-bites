/**
 * Community detection, off the main thread.
 *
 * Leiden over 8,930 nodes and 26,552 edges is a second or two of solid compute,
 * and on the main thread that is a second or two in which the page cannot draw
 * a frame or answer a click. It also cannot be chunked -- the algorithm has no
 * natural yield point -- so a worker is the only way to keep the cloud
 * responsive while it runs.
 *
 * Leiden rather than Louvain because Louvain can return communities that are
 * internally disconnected: two unrelated groups filed under one label, which
 * the layout then draws as a single cluster and quietly lies about. Leiden
 * guarantees connectivity and gives a more stable partition run to run.
 *
 * The message is deliberately array-shaped and transferred, not copied: node
 * ids never cross the boundary, only indices.
 *
 * This module is the computation itself, with no reference to `self` or to
 * postMessage. It runs in three places now -- the browser worker, and the
 * snapshot generator that bakes a layout offline -- and a second copy of a
 * partition algorithm is exactly the kind of divergence that ends with the
 * homepage and the explorer quietly disagreeing about what belongs together.
 */
import Graphology from "graphology";
import leiden from "@aflsolutions/graphology-communities-leiden";
import { forceCenter, forceLink, forceManyBody, forceSimulation } from "d3-force-3d";

/** Communities smaller than this are folded into a linked neighbour. */
const MIN_COMMUNITY = 5;

export interface CommunityRequest {
  /** Node count; nodes are addressed by index. */
  n: number;
  /** Flat triples of (source, target, edgeKind). */
  edges: Int32Array;
  /** Per-kind base weight, indexed by the edge's kind. A kind at zero is
   *  expected to have been dropped from `edges` already, not passed at zero. */
  kindWeights: Float64Array;
  resolution: number;
  /**
   * How hard to discount an edge by the degree of its busier endpoint, as an
   * exponent on the log-degree. 1 is the IDF-shaped default; 0 turns the
   * discount off entirely and lets universal markers glue the graph into one
   * continent, which is worth being able to SEE rather than just read about.
   */
  damping: number;
}

export interface CommunityResponse {
  /** Community id per node index. */
  communities: Int32Array;
  /** Community ids in the order they should be seated on the sphere. */
  order: Int32Array;
  /** The family each seated community belongs to, parallel to `order`. */
  family: Int32Array;
  /** Per-node position inside its own cluster, normalised to a unit ball. */
  offsets: Float32Array;
  count: number;
  ms: number;
}

export function computeLayout(req: CommunityRequest): CommunityResponse {
  const t0 = performance.now();
  const { n, edges, kindWeights, resolution, damping } = req;
  const triples = edges.length / 3;
  const exponent = damping ?? 1;

  // Degrees first: the weight of an edge depends on how promiscuous its busier
  // endpoint is, so nothing can be weighted until every degree is known.
  const degree = new Int32Array(n);
  for (let k = 0; k < triples; k++) {
    degree[edges[k * 3]]++;
    degree[edges[k * 3 + 1]]++;
  }

  /** An edge's weight: its class weight, discounted by its busier endpoint. */
  const weigh = (k: number) => {
    const d = Math.max(degree[edges[k * 3]], degree[edges[k * 3 + 1]]);
    return kindWeights[edges[k * 3 + 2]] / Math.pow(Math.log2(2 + d), exponent);
  };

  const g = new Graphology({ type: "undirected", multi: true });
  for (let i = 0; i < n; i++) g.addNode(String(i));
  for (let k = 0; k < triples; k++) {
    const s = edges[k * 3];
    const t = edges[k * 3 + 1];
    if (s === t) continue;
    // Class weight discounted by the log-degree of the busier end -- IDF, in
    // effect. Two tumours both being CK7-positive says almost nothing, because
    // CK7 touches hundreds of things; two sharing SS18::SSX says nearly
    // everything. Unweighted, a handful of universal markers glue the whole
    // graph into one community.
    g.addEdge(String(s), String(t), { weight: weigh(k) });
  }

  const mapping = leiden(g, {
    attributes: { weight: "weight" },
    weighted: true,
    resolution,
  }) as Record<string, number>;

  const communities = new Int32Array(n);
  for (let i = 0; i < n; i++) communities[i] = mapping[String(i)] ?? 0;

  /* ── absorb the specks ──
   *
   * Leiden leaves several hundred communities of one or two nodes. Each would
   * otherwise be handed its own patch of the sphere, and the result is a globe
   * of real clusters with dust sprayed across every gap between them. Almost
   * none of those are genuinely their own thing: they are a pair of nodes
   * hanging off something larger. So each is folded into whichever neighbouring
   * community it shares the most edge weight with, which puts it beside its
   * actual relatives instead of floating alone.
   *
   * Nodes with no external links at all are left where they are -- those are
   * genuinely isolated, and pretending otherwise would be a lie about the data.
   */
  const sizeOfComm = new Map<number, number>();
  for (let i = 0; i < n; i++)
    sizeOfComm.set(communities[i], (sizeOfComm.get(communities[i]) ?? 0) + 1);

  const affinity = new Map<number, Map<number, number>>();
  for (let k = 0; k < triples; k++) {
    const a = communities[edges[k * 3]];
    const b = communities[edges[k * 3 + 1]];
    if (a === b) continue;
    const w = kindWeights[edges[k * 3 + 2]];
    for (const [x, y] of [
      [a, b],
      [b, a],
    ]) {
      let m = affinity.get(x);
      if (!m) affinity.set(x, (m = new Map()));
      m.set(y, (m.get(y) ?? 0) + w);
    }
  }

  const absorbedInto = new Map<number, number>();
  for (const [c, size] of sizeOfComm) {
    if (size >= MIN_COMMUNITY) continue;
    const m = affinity.get(c);
    if (!m) continue;
    let best = -1;
    let bestW = 0;
    for (const [other, w] of m) {
      if ((sizeOfComm.get(other) ?? 0) < MIN_COMMUNITY) continue;
      if (w > bestW) {
        bestW = w;
        best = other;
      }
    }
    if (best >= 0) absorbedInto.set(c, best);
  }
  for (let i = 0; i < n; i++) {
    const to = absorbedInto.get(communities[i]);
    if (to !== undefined) communities[i] = to;
  }

  const seen = new Set<number>();
  for (let i = 0; i < n; i++) seen.add(communities[i]);

  /* ── shape of each cluster ──
   *
   * A force layout, but restricted to the edges that stay inside a single
   * community. That restriction is the whole point: the reason four attempts at
   * a global force layout collapsed this graph is that a few universal markers
   * link everything to everything, and the link force drags every island into
   * the middle. An edge that cannot leave its community cannot do that.
   *
   * What it buys is the thing a spiral cannot: within a cluster, position means
   * something. Related entities end up adjacent, sub-groups separate out, and
   * the silhouette comes out irregular -- lobed and filamentary, the way a real
   * star cluster looks, rather than a perfectly packed ball.
   */
  const members = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    let a = members.get(communities[i]);
    if (!a) members.set(communities[i], (a = []));
    a.push(i);
  }

  const offsets = new Float32Array(n * 3);
  for (const [, idxs] of members) {
    if (idxs.length === 1) continue;
    const local = new Map(idxs.map((g, i) => [g, i]));
    // The simulation fills in x/y/z as it runs.
    const simNodes: { index: number; x: number; y: number; z: number }[] = idxs.map((_, i) => ({
      index: i,
      x: 0,
      y: 0,
      z: 0,
    }));
    const simLinks: { source: number; target: number; w: number }[] = [];
    for (let k = 0; k < triples; k++) {
      const s = local.get(edges[k * 3]);
      const t = local.get(edges[k * 3 + 1]);
      if (s === undefined || t === undefined || s === t) continue;
      simLinks.push({ source: s, target: t, w: weigh(k) });
    }
    // Bigger clusters need fewer passes each to look settled, and there are more
    // of them; this keeps the total bounded.
    const ticks = Math.max(50, Math.min(150, Math.round(2200 / Math.sqrt(idxs.length))));
    const sim = forceSimulation(simNodes, 3)
      .force(
        "link",
        forceLink(simLinks)
          .id((d: { index: number }) => d.index)
          .distance(14)
          .strength((l: { w: number }) => Math.min(1, l.w * 3))
      )
      .force("charge", forceManyBody().strength(-14).distanceMax(140).theta(0.9))
      .force("center", forceCenter(0, 0, 0).strength(0.06))
      .stop();
    for (let i = 0; i < ticks; i++) sim.tick();

    /* Normalise so the renderer can scale each cluster to the patch of sphere
     * it was allocated -- but against the 85th percentile radius, not the
     * maximum. Force layouts routinely fling one or two weakly-attached nodes
     * far out, and dividing by that outlier squashes everything else into a
     * dense knot with empty space around it. Scaling to the bulk and letting
     * the stragglers overshoot is both better-looking and more honest: those
     * nodes really are out on their own. */
    const radii = simNodes.map((node) => Math.hypot(node.x, node.y, node.z)).sort((a, b) => a - b);
    const scale = Math.max(1e-6, radii[Math.floor(radii.length * 0.85)] || radii[radii.length - 1]);
    idxs.forEach((g, i) => {
      const node = simNodes[i];
      // Outliers are allowed past the rim, but only so far.
      const clamp = (v: number) => Math.max(-1.6, Math.min(1.6, v / scale));
      offsets[g * 3] = clamp(node.x);
      offsets[g * 3 + 1] = clamp(node.y);
      offsets[g * 3 + 2] = clamp(node.z);
    });
  }

  /* ── which cluster sits next to which ──
   *
   * Leiden at any resolution splits a tumour family into its variants: mantle
   * cell, follicular and Burkitt each become their own community and never
   * join, so B-cell lymphomas end up scattered over eighteen clusters on
   * opposite sides of the globe. Measured across resolutions 0.6 to 1.2 that
   * number does not move -- it is not a tuning problem.
   *
   * The cause is the IDF weighting, and it is doing its job. Discounting an
   * edge by the degree of its busier endpoint is what stops CK7 and S100 gluing
   * the whole graph together; but the markers that unite a family -- CD20,
   * PAX5 -- are promiscuous for exactly the same reason, so they are discounted
   * too and the family never coheres.
   *
   * The fix is a second level, not a different resolution. Running Leiden again
   * over the graph OF communities finds which clusters belong to one family
   * (B-cell lymphomas collapse from eighteen groups to four), and those
   * families decide SEATING order. The clusters themselves stay separate --
   * merging them outright makes a single region swallow a third of the graph --
   * but related ones become neighbours, so a family reads as one cloud made of
   * adjacent sub-clusters rather than confetti sprayed across the sphere.
   */
  const communityGraph = new Graphology({ type: "undirected" });
  const commIds = [...members.keys()];
  for (const c of commIds) communityGraph.addNode(String(c));

  const between = new Map<string, number>();
  for (let k = 0; k < triples; k++) {
    const a = communities[edges[k * 3]];
    const b = communities[edges[k * 3 + 1]];
    if (a === b) continue;
    const w = weigh(k);
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    between.set(key, (between.get(key) ?? 0) + w);
  }
  for (const [k, w] of between) {
    const [x, y] = k.split("|");
    if (!communityGraph.hasEdge(x, y)) communityGraph.addEdge(x, y, { weight: w });
  }

  const familyOfComm = leiden(communityGraph, {
    attributes: { weight: "weight" },
    weighted: true,
    resolution: 1,
  }) as Record<string, number>;

  // Seat family by family, biggest family first, biggest cluster first inside
  // each. Contiguous in this list means adjacent on the sphere.
  const families = new Map<number, number[]>();
  for (const c of commIds) {
    const f = familyOfComm[String(c)] ?? -1;
    let arr = families.get(f);
    if (!arr) families.set(f, (arr = []));
    arr.push(c);
  }
  const sizeOf = (c: number) => members.get(c)!.length;
  const order: number[] = [];
  const family: number[] = [];
  for (const [fid, cs] of [...families.entries()].sort(
    (x, y) => y[1].reduce((n, c) => n + sizeOf(c), 0) - x[1].reduce((n, c) => n + sizeOf(c), 0)
  )) {
    for (const c of cs.sort((x, y) => sizeOf(y) - sizeOf(x))) {
      order.push(c);
      family.push(fid);
    }
  }

  const res: CommunityResponse = {
    communities,
    order: Int32Array.from(order),
    family: Int32Array.from(family),
    offsets,
    count: seen.size,
    ms: Math.round(performance.now() - t0),
  };
  return res;
}
