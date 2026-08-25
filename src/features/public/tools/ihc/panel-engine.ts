// Pure functions over the compiled matrix. No React, no I/O. "Build Panel"
// logic: given a differential (a set of diagnoses), rank markers by how well
// they *discriminate* between them, not merely by whether they're positive.

import { compareMarkerNames } from "./marker-order";
import type { Matrix, Marker, Cell, Diagnosis } from "./types";

/** Numeric value for ranking/tone: the % if known, else a proxy from polarity. */
export function effVal(c: Cell): number {
  if (c.pct !== null && c.pct !== undefined) return c.pct;
  // A proliferation index with no number tells us nothing about positivity, and a
  // disputed call should not pull a marker up the ranking.
  if (c.polarity === "index" || c.status === "review") return 50;
  return c.polarity === "positive" ? 85 : 2;
}

export function pctTone(c: Cell): "pos" | "partial" | "neg" | "unsettled" {
  if (c.status === "review") return "unsettled";
  if (c.polarity === "index") return "partial";
  // Hedged in the source ("a subset", "variable") — not the same claim as a
  // definite positive, and it should not be coloured like one.
  if (c.certainty === "variable" && (c.pct === null || c.pct === undefined)) return "partial";
  if (c.pct === null || c.pct === undefined) return c.polarity === "positive" ? "pos" : "neg";
  if (c.pct >= 50) return "pos";
  if (c.pct <= 15) return "neg";
  return "partial";
}

export interface RankedMarker {
  marker: Marker;
  byDx: Record<string, Cell | undefined>;
  /** discriminating power: spread (max−min) of effective value across tested dx */
  spread: number;
  testedCount: number;
  discriminates: boolean;
  /** fraction of the differential WHO actually records this marker for (0–1) */
  coverage: number;
  /** true when the spread was discounted because some arms are unstated */
  partialCoverage: boolean;
}

export function rankMarkersForPanel(matrix: Matrix, diagnosisIds: string[]): RankedMarker[] {
  const selected = diagnosisIds.filter(Boolean);
  const cellsByDx = new Map<string, Map<string, Cell>>();
  for (const id of selected) cellsByDx.set(id, new Map());
  for (const c of matrix.cells) {
    const dm = cellsByDx.get(c.d);
    if (dm) dm.set(c.m, c);
  }

  // Neutral midpoint for a marker the WHO text simply doesn't mention for a
  // given entity (absence ≠ negative — we treat it as "unknown", not 0%).
  const UNKNOWN = 50;

  const ranked: RankedMarker[] = [];
  for (const marker of matrix.markers) {
    const byDx: Record<string, Cell | undefined> = {};
    const vals: number[] = [];
    for (const dxId of selected) {
      const cell = cellsByDx.get(dxId)!.get(marker.id);
      byDx[dxId] = cell;
      if (cell) vals.push(effVal(cell));
    }
    if (vals.length === 0) continue;
    const testedCount = vals.length;
    const fullyTested = testedCount === selected.length;

    // Full discrimination spread when every arm is tested. When a marker is
    // known in some entities but unstated in others, it's still informative if
    // the known value is extreme (strongly pos/neg) — score it by distance from
    // neutral, discounted by how much of the differential it actually covers, so
    // a fully-tested pos-vs-neg marker always outranks a one-sided one.
    const fullSpread = Math.max(...vals) - Math.min(...vals);
    const spread = fullyTested
      ? fullSpread
      : Math.round(
          Math.max(...vals.map((v) => Math.abs(v - UNKNOWN))) * (testedCount / selected.length)
        );
    const discriminates = fullyTested && selected.length > 1 && fullSpread >= 60;
    ranked.push({
      marker,
      byDx,
      spread,
      testedCount,
      discriminates,
      coverage: testedCount / selected.length,
      partialCoverage: !fullyTested,
    });
  }

  // Discriminators first (the tool's purpose is "what best separates these?"),
  // then by power, then by how completely the marker is tested across the panel.
  ranked.sort((a, b) => {
    if (a.discriminates !== b.discriminates) return a.discriminates ? -1 : 1;
    if (b.spread !== a.spread) return b.spread - a.spread;
    if (b.testedCount !== a.testedCount) return b.testedCount - a.testedCount;
    // Natural order, not `localeCompare`: equally powerful markers listed
    // CD10 · CD20 · CD3 · CD5 read as shuffled. See ./marker-order.ts.
    return compareMarkerNames(a.marker.name, b.marker.name);
  });
  return ranked;
}

/**
 * Rank order of the result groups in a profile. Sorting on `effVal` alone left
 * every qualitative positive tied at 85, so the order inside the biggest block
 * of the table was whatever order the extraction happened to emit — which is
 * what made a CD panel look shuffled. Grouping first, then ordering markers
 * naturally inside each group, makes the list deterministic and readable.
 */
const TONE_RANK: Record<ReturnType<typeof pctTone>, number> = {
  pos: 0,
  partial: 1,
  neg: 2,
  unsettled: 3,
};

export function profileForDiagnosis(matrix: Matrix, diagnosisId: string): { marker: Marker; cell: Cell }[] {
  const markerById = new Map(matrix.markers.map((m) => [m.id, m]));
  return matrix.cells
    .filter((c) => c.d === diagnosisId)
    .map((cell) => {
      const marker = markerById.get(cell.m);
      return marker ? { marker, cell } : null;
    })
    .filter((x): x is { marker: Marker; cell: Cell } => x !== null)
    .sort((a, b) => {
      const ta = TONE_RANK[pctTone(a.cell)];
      const tb = TONE_RANK[pctTone(b.cell)];
      if (ta !== tb) return ta - tb;
      // Inside a group a reported rate outranks a bare qualitative call, so the
      // quantified end of the profile reads first.
      const pa = a.cell.pct ?? -1;
      const pb = b.cell.pct ?? -1;
      if (pa !== pb && pa >= 0 && pb >= 0) return pb - pa;
      return compareMarkerNames(a.marker.name, b.marker.name);
    });
}

// ---------------------------------------------------------------------------
// Diagnostic mode: observed stains → ranked differential
// ---------------------------------------------------------------------------

/**
 * What the pathologist saw down the microscope.
 *
 * `variable` is not a hedge about the observation — it IS the observation:
 * patchy, subset-only or equivocal staining. The tool used to offer only
 * positive and negative, which forced a partial stain to be entered as one or
 * the other and then scored it as if it were clean. It is scored as its own
 * outcome now, and it is the outcome a `certainty: "variable"` cell predicts.
 */
export type Observation = "positive" | "negative" | "variable";

export const OBSERVATIONS: Observation[] = ["positive", "variable", "negative"];

/** Symbol shown on a stain chip. */
export const OBSERVATION_SYMBOL: Record<Observation, string> = {
  positive: "+",
  variable: "+/−",
  negative: "−",
};

export interface DiagnosisScore {
  diagnosis: Diagnosis;
  /** Relative support, normalised so the top candidate = 1. */
  support: number;
  /** Evidence for this diagnosis over the average entity, in bits, after the
   *  coverage discount. This is what the ranking sorts on. */
  bits: number;
  /** Evidence before the discount — the raw sum of log-ratios. */
  rawBits: number;
  /** Observations this diagnosis is characterised for, as a fraction (0–1). */
  coverage: number;
  /** Observed markers whose known result agrees with this diagnosis. */
  matched: number;
  /** Observed markers whose known result contradicts this diagnosis. */
  conflicts: number;
  /** Observed markers this diagnosis records as partial/subset staining. */
  partial: number;
  /** Observed markers for which this diagnosis has data at all. */
  tested: number;
}

function cellIndex(matrix: Matrix): Map<string, Cell> {
  const idx = new Map<string, Cell>();
  for (const c of matrix.cells) idx.set(`${c.d}|${c.m}`, c);
  return idx;
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

type Outcomes = Record<Observation, number>;

const FLOOR = 0.02;

function normalise(o: Outcomes): Outcomes {
  const p = {
    positive: Math.max(o.positive, FLOOR),
    variable: Math.max(o.variable, FLOOR),
    negative: Math.max(o.negative, FLOOR),
  };
  const total = p.positive + p.variable + p.negative;
  return { positive: p.positive / total, variable: p.variable / total, negative: p.negative / total };
}

/** No claim at all — every outcome equally likely, so it contributes nothing. */
const UNINFORMATIVE: Outcomes = { positive: 1 / 3, variable: 1 / 3, negative: 1 / 3 };

/**
 * What a cell predicts you will see, as a distribution over the three
 * outcomes rather than a single probability of positivity.
 *
 * Two cells the old two-outcome model could not tell apart:
 *   "CD43 positive in 20% of cases" and "CD43 positive (a subset)" both said
 *   p(pos) ≈ 0.2 / 0.9 and nothing about how often the stain reads as patchy.
 * Here a mid-range percentage and an explicitly hedged call both put real mass
 * on `variable`, which is what a pathologist entering "+/−" is telling us.
 */
export function outcomeProbs(cell: Cell | undefined): Outcomes {
  if (!cell) return UNINFORMATIVE;
  // An index is a number, not a positivity call, and a cell the two extractions
  // disagree on has no claim to make. Neither may push a candidate anywhere.
  if (cell.polarity === "index" || cell.status === "review") return UNINFORMATIVE;

  if (cell.pct !== null && cell.pct !== undefined) {
    const p = clamp(cell.pct / 100, 0, 1);
    // Heterogeneity peaks where the reported rate is mid-range: a marker positive
    // in half of cases is precisely the one that looks patchy on the bench.
    const variable = 2 * p * (1 - p);
    return normalise({ positive: p * (1 - variable), variable, negative: (1 - p) * (1 - variable) });
  }

  // A hedge is NOT symmetric, and calibrating it as if it were was wrong in a
  // way that showed up immediately on real data. WHO's two hedges say different
  // things:
  //
  //   "a subset expresses X"      — genuinely uncertain. Could be 20% or 60%,
  //                                 so the mass spreads wide.
  //   "typically negative for X"  — NOT uncertain. It is a negative call with a
  //                                 known exception; the volume that qualifies
  //                                 EMZL's CD5 puts the exception at < 4%.
  //
  // Treating both as "half unsure" made a hedged negative only 55% negative,
  // which dropped extranodal MZL — an entity five volumes call CD5-negative —
  // to 17th on a CD20+/CD5−/CD10− panel it should top. A hedged negative is
  // therefore kept tight on the negative side while still holding several times
  // more positive mass than a flat negative, so a CD5-POSITIVE result softly
  // disfavours the entity instead of near-excluding it. That asymmetry is the
  // whole clinical content of the word "typically".
  const hedged = cell.certainty === "variable";
  if (cell.polarity === "positive") {
    return hedged
      ? normalise({ positive: 0.42, variable: 0.4, negative: 0.18 })
      : normalise({ positive: 0.78, variable: 0.19, negative: 0.03 });
  }
  return hedged
    ? normalise({ positive: 0.1, variable: 0.13, negative: 0.77 })
    : normalise({ positive: 0.03, variable: 0.09, negative: 0.88 });
}

/**
 * How often each outcome turns up for a marker across the whole knowledge base.
 *
 * THIS IS THE FIX FOR "the algorithm doesn't give the best result".
 *
 * The old scorer summed log P(observed | diagnosis), which rewards a candidate
 * for explaining CD20+ exactly as much as for explaining a rare marker — even
 * though nearly every B-cell entity in the table is CD20+, so CD20+ separates
 * almost nothing. Dividing by the marker's own base rate turns each observation
 * into a likelihood RATIO: the score becomes "how much more likely is this
 * result under this diagnosis than under a diagnosis picked at random", which
 * is the question the ranking is actually trying to answer. A commonplace
 * result now contributes ~0 bits and a rare one dominates, which is how a
 * pathologist reads the same panel.
 *
 * Laplace-smoothed toward the uninformative prior so a marker recorded for two
 * entities cannot produce an extreme ratio.
 */
function baseRates(matrix: Matrix, markerIds: string[]): Map<string, Outcomes> {
  const wanted = new Set(markerIds);
  const acc = new Map<string, { sum: Outcomes; n: number }>();
  for (const id of wanted) acc.set(id, { sum: { positive: 0, variable: 0, negative: 0 }, n: 0 });

  for (const c of matrix.cells) {
    const entry = acc.get(c.m);
    if (!entry) continue;
    const p = outcomeProbs(c);
    entry.sum.positive += p.positive;
    entry.sum.variable += p.variable;
    entry.sum.negative += p.negative;
    entry.n++;
  }

  const PRIOR = 3; // pseudo-entities' worth of "no idea", split across outcomes
  const out = new Map<string, Outcomes>();
  for (const [id, { sum, n }] of acc) {
    const d = n + PRIOR;
    out.set(
      id,
      normalise({
        positive: (sum.positive + PRIOR / 3) / d,
        variable: (sum.variable + PRIOR / 3) / d,
        negative: (sum.negative + PRIOR / 3) / d,
      })
    );
  }
  return out;
}

/**
 * Discount a score by how little of the panel the entity actually speaks to.
 *
 * THIS IS THE FIX FOR "the ranking breaks after too many stains".
 *
 * An unrecorded marker contributes exactly 0 bits, which is right — absence in
 * WHO is not a negative. But 0 is also *free*: an entity WHO characterises for
 * one of your eight stains is never penalised for the seven it says nothing
 * about, so it keeps whatever bits that single lucky match earned. With two or
 * three stains that barely shows. With eight it dominates: an eight-marker
 * leukaemia panel surfaced "Adenomatoid tumour" and "Spindle epithelial tumour
 * with thymus-like elements" in the top ten, each on a single matching stain,
 * while the entity that explained six of the eight sat below them.
 *
 * So the sum is a biased comparison — the sparse entity's score is an estimate
 * from one observation, the well-characterised one's from six, and they were
 * being read off the same axis. The discount shrinks a score toward zero in
 * proportion to the evidence NOT obtained:
 *
 *     bits × tested / (tested + MISSING_WEIGHT × missing)
 *
 * At full coverage nothing changes. One stain out of eight keeps ~22% of its
 * bits. It cannot reorder two entities with the same coverage, and it never
 * flips a sign — it expresses "we know much less about this candidate", which
 * is exactly what the reader needs and what the raw sum was hiding.
 *
 * `MISSING_WEIGHT` is deliberately below 1: a missing marker is weaker evidence
 * of a poor match than a present one is of a good one, because WHO chapters are
 * uneven in what they bother to list.
 */
const MISSING_WEIGHT = 0.5;

function discountForCoverage(bits: number, tested: number, observed: number): number {
  const missing = observed - tested;
  if (missing <= 0) return bits;
  return (bits * tested) / (tested + MISSING_WEIGHT * missing);
}

/** Which of the three outcomes a cell most expects — used for the ✓/✕ counts. */
function expectedOutcome(cell: Cell): Observation | null {
  if (cell.polarity === "index" || cell.status === "review") return null;
  const p = outcomeProbs(cell);
  let best: Observation = "positive";
  for (const o of OBSERVATIONS) if (p[o] > p[best]) best = o;
  return best;
}

export interface MarkerContribution {
  marker: Marker;
  observation: Observation;
  cell?: Cell;
  /** Evidence this one stain lends the diagnosis, in bits (negative = against). */
  bits: number;
  /** How often this result turns up across the knowledge base (0–1). */
  baseRate: number;
  /** How often this diagnosis shows this result (0–1). */
  diagnosisRate: number;
  agreement: "supports" | "against" | "neutral";
}

/**
 * Rank diagnoses by how much better their IHC profile explains the observed
 * stains than the knowledge base at large does.
 *
 *   score(dx) = Σ log2( P(result | dx) / P(result | any entity recording it) )
 *
 * A marker with no data for a diagnosis contributes exactly 0 bits — absence in
 * WHO is not a negative, and it must not be scored as one. Only diagnoses with
 * data for ≥1 observed marker are returned.
 */
export function scoreDiagnoses(
  matrix: Matrix,
  observations: Record<string, Observation>
): DiagnosisScore[] {
  const obs = Object.entries(observations) as [string, Observation][];
  if (obs.length === 0) return [];
  const idx = cellIndex(matrix);
  const base = baseRates(
    matrix,
    obs.map(([m]) => m)
  );

  const scored: DiagnosisScore[] = [];
  for (const dx of matrix.diagnoses) {
    let bits = 0;
    let matched = 0;
    let conflicts = 0;
    let partial = 0;
    let tested = 0;
    for (const [mId, observation] of obs) {
      const cell = idx.get(`${dx.id}|${mId}`);
      if (!cell) continue;
      const p = outcomeProbs(cell)[observation];
      const q = (base.get(mId) ?? UNINFORMATIVE)[observation];
      bits += Math.log2(p / q);
      tested++;
      const expected = expectedOutcome(cell);
      if (expected === observation) matched++;
      else if (expected === "variable" || observation === "variable") partial++;
      else if (expected) conflicts++;
    }
    if (tested === 0) continue;
    const coverage = tested / obs.length;
    scored.push({
      diagnosis: dx,
      support: 0,
      bits: discountForCoverage(bits, tested, obs.length),
      rawBits: bits,
      coverage,
      matched,
      conflicts,
      partial,
      tested,
    });
  }
  if (scored.length === 0) return [];

  const maxBits = Math.max(...scored.map((s) => s.bits));
  for (const s of scored) s.support = Math.pow(2, s.bits - maxBits);

  return scored.sort(
    (a, b) =>
      b.bits - a.bits ||
      b.matched - a.matched ||
      a.conflicts - b.conflicts ||
      // A candidate WHO characterises across more of the panel is the better
      // answer when two profiles explain the stains equally well.
      b.tested - a.tested ||
      a.diagnosis.name.localeCompare(b.diagnosis.name)
  );
}

/**
 * The per-stain breakdown behind one candidate's score — what the "why?" row in
 * the differential shows. Same arithmetic as scoreDiagnoses, kept in one place
 * so the explanation can never drift from the ranking it explains.
 */
export function explainScore(
  matrix: Matrix,
  diagnosisId: string,
  observations: Record<string, Observation>
): MarkerContribution[] {
  const obs = Object.entries(observations) as [string, Observation][];
  if (obs.length === 0) return [];
  const idx = cellIndex(matrix);
  const markerById = new Map(matrix.markers.map((m) => [m.id, m]));
  const base = baseRates(
    matrix,
    obs.map(([m]) => m)
  );

  const out: MarkerContribution[] = [];
  for (const [mId, observation] of obs) {
    const marker = markerById.get(mId);
    if (!marker) continue;
    const cell = idx.get(`${diagnosisId}|${mId}`);
    const q = (base.get(mId) ?? UNINFORMATIVE)[observation];
    const p = cell ? outcomeProbs(cell)[observation] : q;
    const bits = cell ? Math.log2(p / q) : 0;
    out.push({
      marker,
      observation,
      cell,
      bits,
      baseRate: q,
      diagnosisRate: p,
      agreement: !cell || Math.abs(bits) < 0.15 ? "neutral" : bits > 0 ? "supports" : "against",
    });
  }
  return out.sort((a, b) => b.bits - a.bits || compareMarkerNames(a.marker.name, b.marker.name));
}

export interface NextMarkerSuggestion {
  marker: Marker;
  /** Expected information gain in bits, weighted by how plausible each arm is. */
  infoGain: number;
  posCount: number;
  negCount: number;
  coverage: number;
}

/**
 * Among not-yet-observed markers, the stain that would tell us the most next.
 *
 * Two changes from the naive version: candidates are weighted by their current
 * support, so a marker that splits two candidates nobody believes scores
 * nothing; and the split is measured over all three outcomes, so a marker that
 * is uniformly "patchy" across the candidates is correctly judged useless
 * rather than counted as a clean positive.
 */
export function suggestNextMarker(
  matrix: Matrix,
  candidates: { id: string; weight: number }[],
  observedMarkerIds: string[]
): NextMarkerSuggestion[] {
  const cands = candidates.filter((c) => c.id && c.weight > 0);
  if (cands.length < 2) return [];
  const observed = new Set(observedMarkerIds);
  const idx = cellIndex(matrix);
  const totalWeight = cands.reduce((s, c) => s + c.weight, 0);

  const out: NextMarkerSuggestion[] = [];
  for (const marker of matrix.markers) {
    if (observed.has(marker.id)) continue;
    const mix: Outcomes = { positive: 0, variable: 0, negative: 0 };
    let covered = 0;
    let pos = 0;
    let neg = 0;
    for (const c of cands) {
      const cell = idx.get(`${c.id}|${marker.id}`);
      if (!cell) continue;
      const expected = expectedOutcome(cell);
      if (!expected) continue;
      const p = outcomeProbs(cell);
      mix.positive += p.positive * c.weight;
      mix.variable += p.variable * c.weight;
      mix.negative += p.negative * c.weight;
      covered += c.weight;
      if (expected === "positive") pos++;
      else if (expected === "negative") neg++;
    }
    if (covered <= 0 || pos + neg < 2) continue; // can't split fewer than two known arms

    // Entropy of the expected result: maximal when the candidates disagree.
    let H = 0;
    for (const o of OBSERVATIONS) {
      const share = mix[o] / covered;
      if (share > 0) H -= share * Math.log2(share);
    }
    const coverage = covered / totalWeight;
    out.push({ marker, infoGain: H * coverage, posCount: pos, negCount: neg, coverage });
  }
  return out
    .sort(
      (a, b) =>
        b.infoGain - a.infoGain ||
        b.coverage - a.coverage ||
        compareMarkerNames(a.marker.name, b.marker.name)
    )
    .filter((s) => s.infoGain > 0);
}

export interface PanelMarker {
  marker: Marker;
  /** How many still-ambiguous diagnosis pairs this marker resolves. */
  distinguishes: number;
}

/**
 * Greedy minimal panel: the fewest markers that pairwise-separate the given
 * differential. A marker separates a pair when both are tested and their
 * polarities differ (or their reported % differ by ≥50). Returns markers in
 * the order they were greedily chosen; stops when no marker resolves more pairs.
 */
export function minimalPanel(matrix: Matrix, diagnosisIds: string[]): PanelMarker[] {
  const ids = diagnosisIds.filter(Boolean);
  if (ids.length < 2) return [];
  const idx = cellIndex(matrix);

  const separates = (mId: string, a: string, b: string): boolean => {
    const ca = idx.get(`${a}|${mId}`);
    const cb = idx.get(`${b}|${mId}`);
    if (!ca || !cb) return false;
    if (ca.polarity !== cb.polarity) return true;
    if (ca.pct !== null && ca.pct !== undefined && cb.pct !== null && cb.pct !== undefined) {
      return Math.abs(ca.pct - cb.pct) >= 50;
    }
    return false;
  };

  let remaining: [string, string][] = [];
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) remaining.push([ids[i], ids[j]]);

  const chosen: PanelMarker[] = [];
  const used = new Set<string>();
  while (remaining.length) {
    let best: Marker | null = null;
    let bestCov = 0;
    for (const marker of matrix.markers) {
      if (used.has(marker.id)) continue;
      let cov = 0;
      for (const [a, b] of remaining) if (separates(marker.id, a, b)) cov++;
      if (cov > bestCov) {
        bestCov = cov;
        best = marker;
      }
    }
    if (!best || bestCov === 0) break;
    chosen.push({ marker: best, distinguishes: bestCov });
    used.add(best.id);
    const chosenId = best.id;
    remaining = remaining.filter(([a, b]) => !separates(chosenId, a, b));
  }
  return chosen;
}

/**
 * The most characteristic stains for a diagnosis — the markers whose result is
 * most extreme (strongly positive or negative). Used to auto-generate a worked
 * example: feeding these back into scoreDiagnoses ranks this diagnosis at/near
 * the top, demonstrating the tool.
 */
export function characteristicStains(
  matrix: Matrix,
  diagnosisId: string,
  max = 4
): { markerId: string; polarity: Observation }[] {
  return matrix.cells
    .filter(
      (c) =>
        c.d === diagnosisId &&
        // A worked example should demonstrate the tool with calls the source
        // actually asserts: not a disputed one, and not an index, which is a
        // number rather than an observation a user can enter.
        c.status !== "review" &&
        (c.polarity === "positive" || c.polarity === "negative")
    )
    .map((c) => ({ c, extremity: Math.abs(effVal(c) - 50) }))
    .sort((a, b) => b.extremity - a.extremity)
    .slice(0, max)
    .map(({ c }) => ({
      markerId: c.m,
      // A hedged call is demonstrated as what it is — the example should show
      // the tri-state chip, not flatten a subset positive into a clean one.
      polarity: (c.certainty === "variable" ? "variable" : c.polarity) as Observation,
    }));
}

/**
 * Diagnoses that share the most markers with the given one (same organ
 * preferred) — a plausible differential to seed the Differential view.
 */
export function relatedDiagnoses(matrix: Matrix, diagnosisId: string, n = 2): string[] {
  const seedMarkers = new Set(
    matrix.cells.filter((c) => c.d === diagnosisId).map((c) => c.m)
  );
  if (seedMarkers.size === 0) return [];
  const seedOrgan = matrix.diagnoses.find((d) => d.id === diagnosisId)?.organ;
  const overlap = new Map<string, number>();
  for (const c of matrix.cells) {
    if (c.d === diagnosisId) continue;
    if (seedMarkers.has(c.m)) overlap.set(c.d, (overlap.get(c.d) ?? 0) + 1);
  }
  const organOf = new Map(matrix.diagnoses.map((d) => [d.id, d.organ]));
  return [...overlap.entries()]
    .map(([id, shared]) => ({ id, shared, sameOrgan: organOf.get(id) === seedOrgan }))
    .sort((a, b) => Number(b.sameOrgan) - Number(a.sameOrgan) || b.shared - a.shared)
    .slice(0, n)
    .map((x) => x.id);
}

/** Fraction of a diagnosis's profile that is populated, vs the median profile size. */
export function profileCompleteness(matrix: Matrix, diagnosisId: string): number {
  const n = matrix.cells.filter((c) => c.d === diagnosisId).length;
  // scale against a "reasonably characterised" profile of ~10 markers
  return clamp(n / 10, 0, 1);
}

/** Unique reference ids cited across a set of cells. */
export function refsForCells(cells: (Cell | undefined)[]): string[] {
  const seen = new Set<string>();
  for (const c of cells) {
    if (!c) continue;
    for (const r of c.refs) seen.add(r);
  }
  return [...seen];
}
