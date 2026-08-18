// Pure functions over the compiled matrix. No React, no I/O. "Build Panel"
// logic: given a differential (a set of diagnoses), rank markers by how well
// they *discriminate* between them, not merely by whether they're positive.

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
    ranked.push({ marker, byDx, spread, testedCount, discriminates });
  }

  // Discriminators first (the tool's purpose is "what best separates these?"),
  // then by power, then by how completely the marker is tested across the panel.
  ranked.sort((a, b) => {
    if (a.discriminates !== b.discriminates) return a.discriminates ? -1 : 1;
    if (b.spread !== a.spread) return b.spread - a.spread;
    if (b.testedCount !== a.testedCount) return b.testedCount - a.testedCount;
    return a.marker.name.localeCompare(b.marker.name);
  });
  return ranked;
}

export function profileForDiagnosis(matrix: Matrix, diagnosisId: string): { marker: Marker; cell: Cell }[] {
  const markerById = new Map(matrix.markers.map((m) => [m.id, m]));
  return matrix.cells
    .filter((c) => c.d === diagnosisId)
    .map((cell) => {
      const marker = markerById.get(cell.m);
      return marker ? { marker, cell } : null;
    })
    .filter((x): x is { marker: Marker; cell: Cell } => x !== null)
    .sort((a, b) => effVal(b.cell) - effVal(a.cell));
}

// ---------------------------------------------------------------------------
// Diagnostic mode: observed stains → ranked differential
// ---------------------------------------------------------------------------

export type Observation = "positive" | "negative";

export interface DiagnosisScore {
  diagnosis: Diagnosis;
  /** Relative support, normalised so the top candidate = 1. */
  support: number;
  /** Observed markers whose known result agrees with this diagnosis. */
  matched: number;
  /** Observed markers whose known result contradicts this diagnosis. */
  conflicts: number;
  /** Observed markers for which this diagnosis has data at all. */
  tested: number;
}

function cellIndex(matrix: Matrix): Map<string, Cell> {
  const idx = new Map<string, Cell>();
  for (const c of matrix.cells) idx.set(`${c.d}|${c.m}`, c);
  return idx;
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** P(marker positive | diagnosis) from a cell: reported %, else a polarity prior. */
function pPositive(cell: Cell): number {
  const p = cell.pct !== null && cell.pct !== undefined ? cell.pct / 100 : cell.polarity === "positive" ? 0.9 : 0.05;
  return clamp(p, 0.02, 0.98);
}

/**
 * Rank diagnoses by how well their IHC profile explains the observed stains
 * (naive-Bayes over per-marker positivity). A marker with no data for a
 * diagnosis is treated as uninformative (0.5), never as evidence against it —
 * absence in WHO ≠ negative. Only diagnoses with data for ≥1 observed marker
 * are returned (avoids ranking on the prior alone).
 */
export function scoreDiagnoses(
  matrix: Matrix,
  observations: Record<string, Observation>
): DiagnosisScore[] {
  const obs = Object.entries(observations);
  if (obs.length === 0) return [];
  const idx = cellIndex(matrix);

  const scored: { dx: Diagnosis; logL: number; matched: number; conflicts: number; tested: number }[] = [];
  for (const dx of matrix.diagnoses) {
    let logL = 0;
    let matched = 0;
    let conflicts = 0;
    let tested = 0;
    for (const [mId, polarity] of obs) {
      const cell = idx.get(`${dx.id}|${mId}`);
      const pPos = cell ? pPositive(cell) : 0.5;
      const pObs = polarity === "positive" ? pPos : 1 - pPos;
      logL += Math.log(pObs);
      if (cell) {
        tested++;
        if (cell.polarity === polarity) matched++;
        else conflicts++;
      }
    }
    if (tested === 0) continue;
    scored.push({ dx, logL, matched, conflicts, tested });
  }
  if (scored.length === 0) return [];

  const maxLog = Math.max(...scored.map((s) => s.logL));
  return scored
    .map((s) => ({
      diagnosis: s.dx,
      support: Math.exp(s.logL - maxLog),
      matched: s.matched,
      conflicts: s.conflicts,
      tested: s.tested,
    }))
    .sort(
      (a, b) =>
        b.support - a.support || b.matched - a.matched || a.conflicts - b.conflicts ||
        a.diagnosis.name.localeCompare(b.diagnosis.name)
    );
}

export interface NextMarkerSuggestion {
  marker: Marker;
  /** Expected information gain (binary entropy of the pos/neg split × coverage). */
  infoGain: number;
  posCount: number;
  negCount: number;
  coverage: number;
}

/**
 * Among not-yet-observed markers, suggest the ones that best split the current
 * candidate diagnoses — the single most informative next stain to order.
 */
export function suggestNextMarker(
  matrix: Matrix,
  candidateDiagnosisIds: string[],
  observedMarkerIds: string[]
): NextMarkerSuggestion[] {
  const cands = candidateDiagnosisIds.filter(Boolean);
  if (cands.length < 2) return [];
  const observed = new Set(observedMarkerIds);
  const idx = cellIndex(matrix);

  const out: NextMarkerSuggestion[] = [];
  for (const marker of matrix.markers) {
    if (observed.has(marker.id)) continue;
    let pos = 0;
    let neg = 0;
    for (const dId of cands) {
      const cell = idx.get(`${dId}|${marker.id}`);
      if (!cell) continue;
      if (cell.polarity === "positive") pos++;
      else neg++;
    }
    const covered = pos + neg;
    if (covered < 2) continue; // can't split fewer than two known arms
    const pPos = pos / covered;
    const H = pPos <= 0 || pPos >= 1 ? 0 : -(pPos * Math.log2(pPos) + (1 - pPos) * Math.log2(1 - pPos));
    const coverage = covered / cands.length;
    out.push({ marker, infoGain: H * coverage, posCount: pos, negCount: neg, coverage });
  }
  return out
    .sort(
      (a, b) =>
        b.infoGain - a.infoGain ||
        b.posCount + b.negCount - (a.posCount + a.negCount) ||
        a.marker.name.localeCompare(b.marker.name)
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
    .map(({ c }) => ({ markerId: c.m, polarity: c.polarity as Observation }));
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
