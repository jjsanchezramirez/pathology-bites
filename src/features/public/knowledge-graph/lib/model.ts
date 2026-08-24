/**
 * The graph's vocabulary, and the shape of a baked snapshot.
 *
 * One definition, imported by everything: the explorer, the snapshot generator
 * that bakes a layout offline, and the public cloud that reads it back. The
 * partition depends on these weights, so a second copy of them is a way for a
 * baked snapshot to be grouped differently from the live graph while both look
 * entirely correct.
 */

export type NodeType = "entity" | "marker" | "alteration" | "gene";
export type EdgeType =
  | "expression"
  | "alteration"
  | "surrogate"
  | "differential"
  | "gene"
  | "subtype";

/** Index order for the integer codes that cross into the worker and the snapshot. */
export const NODE_TYPES: NodeType[] = ["entity", "marker", "alteration", "gene"];
export const EDGE_KINDS: EdgeType[] = [
  "expression",
  "alteration",
  "surrogate",
  "differential",
  "gene",
  "subtype",
];

/**
 * How much an edge counts when deciding what belongs together.
 *
 * Class matters -- a subtype belongs to its parent far more tightly than two
 * tumours that happen to share a stain -- but the dominant term is applied in
 * the worker, which discounts every edge by the log-degree of its busier end.
 */
export const EDGE_WEIGHT: Record<EdgeType, number> = {
  subtype: 8,
  gene: 3,
  surrogate: 3,
  differential: 2,
  alteration: 1.2,
  expression: 1,
};

/**
 * Leiden resolution, chosen by measuring rather than by feel. Across 0.55-1.5
 * on this graph, 1.2 is the only setting that avoids a single dominant
 * community: it puts the largest at a few per cent of all nodes, where 0.55
 * gives twenty, which renders as one ball swallowing the middle of the globe.
 */
export const LEIDEN_RESOLUTION = 1.2;
/** Exponent on the log-degree discount. 1 is the IDF-shaped default. */
export const HUB_DAMPING = 1;

export const POLAR_KINDS = new Set<EdgeType>(["expression", "alteration"]);
/**
 * The polarities the public cloud draws, and therefore the only ones a
 * snapshot carries. An absence rendered as a line looks exactly like a
 * presence; the cloud shows what these tumours ARE.
 */
export const PUBLIC_POLARITIES = new Set<string>(["positive", "index", "present"]);
/**
 * Every value `r` takes, across all edge kinds, as one indexable list. Index 0
 * is "no polarity"; on a gene edge `r` is the gene's ROLE, which is why this is
 * wider than POLARITIES. A differential edge carries no `r` at all -- the edge
 * kind is the whole claim.
 */
export const EDGE_RESULTS = [
  "",
  "positive",
  "negative",
  "index",
  "present",
  "absent",
  "affected",
  "five_prime",
  "three_prime",
] as const;
