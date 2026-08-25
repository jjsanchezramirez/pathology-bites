// Fold the shipped matrix's per-chapter rows into one row per tumour.
//
// WHY THIS EXISTS
//
// The published IHC matrix is keyed on (entity, WHO volume) — one row per
// chapter that describes a tumour, because that is what the extraction reads.
// The knowledge graph is not: `entities` holds ONE row per tumour and
// `entity_placements` carries the per-volume parent (see
// dev/docs/KNOWLEDGE-GRAPH.md §1). The tool was consuming the chapter-level
// artifact and therefore presenting the same disease many times over: CD20+
// CD5− CD10− returned SEVEN rows of extranodal marginal zone lymphoma, one per
// book that mentions it, all with identical support.
//
// This module reconciles the two. It never invents a merge:
//
//   1. `redirects` — the knowledge graph's own curated merge map
//      (`entity_merge_redirects`, 1,086 rows). Authoritative, and the only
//      thing that can merge two DIFFERENTLY named rows. Optional: it is
//      published alongside the matrix and the tool degrades to rule 2 alone if
//      it is not there.
//   2. Identical canonical name. WHO uses one name for one disease across its
//      volumes, so "Granular cell tumour" in nine books is nine chapters about
//      one tumour. 1,010 of the graph's own 1,086 curated merges are exactly
//      this case — the rule reproduces the curators' decisions rather than
//      guessing past them.
//
// The canonical name folds a TRAILING parenthetical ("… (MALT lymphoma)",
// "Acute myeloid leukaemia (AML)"), which is how WHO writes a restatement of
// the name it just gave. That covers most of the 76 curated merges rule 1 adds.
//
// What it deliberately does NOT do is merge two different names on similarity.
// The graph's rule of engagement applies here too: a missed merge leaves a
// harmless duplicate, a wrong merge destroys a distinction.
//
// EVIDENCE POOLING
//
// `evidence` is attestations, not conclusions — pooling happens at read time,
// never at write time. So merging rows merges their evidence: references and
// quotes are unioned, percentages are case-weighted, and when two books make
// OPPOSITE calls the merged cell is marked `review` and asserts nothing, which
// is the same treatment a disagreement between the two extraction passes gets.

import { normalizeMedicalSpelling } from "@/shared/utils/text/medical-spelling";
import type { Cell, Diagnosis, Matrix } from "./types";

/** `{ [losing slug]: winning slug }` — the graph's curated merge map. */
export type RedirectMap = Record<string, string>;

/**
 * The canonical form used to decide "is this the same name?".
 *
 * Folds Commonwealth spelling and Greek letters (shared with search), drops a
 * trailing parenthetical, and reduces everything else to spaced alphanumerics
 * so punctuation and hyphenation cannot split one disease in two.
 */
export function canonicalName(name: string): string {
  return normalizeMedicalSpelling(name)
    .replace(/\s*\([^()]*\)\s*$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Follow the merge map to its fixed point, refusing to loop on a bad cycle. */
function resolveSlug(id: string, redirects: RedirectMap): string {
  let cur = id;
  for (let hops = 0; hops < 8; hops++) {
    const next = redirects[cur];
    if (!next || next === cur) return cur;
    cur = next;
  }
  return cur;
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/**
 * Pool the member rows' cells for one marker into a single cell.
 *
 * Percentages are case-weighted when the sources counted cases (Σ pct·n / Σ n,
 * the same pooling `marker_summary` does) and plain-averaged when they did not.
 * A positive/negative disagreement between volumes is NOT averaged away — the
 * merged cell keeps `status: "review"` so the table shows it as unsettled.
 */
export function poolCells(members: Cell[], targetId: string): Cell {
  const primary = members[0];

  // A HEDGED MINORITY IS NOT A CONTRADICTION.
  //
  // Extranodal MZL is the case that taught this. Four WHO volumes say "EMZLs
  // are typically negative for CD5" as a flat statement; the Digestive System
  // volume says "a small subset (< 4%) of EMZL expresses CD5". Treating any
  // difference in polarity as a conflict marked that cell unsettled and threw
  // away a call five books agree on — when in fact they are all saying the same
  // thing: negative, with a rare positive subset.
  //
  // So a disagreement only counts when it is between statements of the SAME
  // confidence. A definite call outranks a hedged one; a hedged dissent instead
  // downgrades the merged cell's certainty to `variable`, which is precisely
  // what "usually negative" means and what the scorer needs to know.
  const claims = members.filter((c) => c.polarity !== "index" && c.status !== "review");
  const definite = claims.filter((c) => c.certainty !== "variable");
  const authoritative = definite.length ? definite : claims;
  const conflicted = new Set(authoritative.map((c) => c.polarity)).size > 1;

  // Modal polarity among the authoritative claims; index only wins when no
  // volume made a positivity call at all.
  const tally = new Map<Cell["polarity"], number>();
  for (const c of (authoritative.length ? authoritative : members))
    tally.set(c.polarity, (tally.get(c.polarity) ?? 0) + 1);
  let polarity = primary.polarity;
  let best = -1;
  for (const [p, n] of tally) {
    const weight = p === "index" ? n - 0.5 : n;
    if (weight > best) {
      best = weight;
      polarity = p;
    }
  }

  // Only percentages reported FOR THE CALL WE LANDED ON are pooled — averaging
  // a dissenting volume's rate into the majority polarity would invent a figure
  // no source printed.
  const withPct = members.filter(
    (c) => c.pct !== null && c.pct !== undefined && c.polarity === polarity
  );
  let pct: number | null = null;
  let n: number | undefined;
  if (withPct.length) {
    const counted = withPct.filter((c) => typeof c.n === "number" && c.n! > 0);
    if (counted.length) {
      const total = counted.reduce((s, c) => s + c.n!, 0);
      pct = Math.round(counted.reduce((s, c) => s + c.pct! * c.n!, 0) / total);
      n = total;
    } else {
      pct = Math.round(withPct.reduce((s, c) => s + c.pct!, 0) / withPct.length);
    }
    pct = clamp(pct, 0, 100);
  }

  const refs = [...new Set(members.flatMap((c) => c.refs))];
  const quotes = [...new Set(members.map((c) => c.quote).filter((q): q is string => Boolean(q)))];
  // Status takes the BEST attestation, not the worst — with one exception.
  //
  // The first cut of this propagated `review` if any pooled chapter carried it,
  // and that inverted the point of pooling: CD10 in MALT lymphoma is stated by
  // five volumes, four of them confirmed and one whose extraction the two
  // passes disagreed about, and the merged cell came out "unsettled" — so a
  // well-attested negative was scored as making no claim at all, and the entity
  // dropped out of its own differential. One disputed reading does not unsettle
  // four independent confirmations of the same call.
  //
  // The exception is a genuine polarity conflict: volumes asserting OPPOSITE
  // results is not weak evidence, it is contradictory evidence, and that stays
  // `review` however confidently each side states it.
  const statuses = new Set(members.map((c) => c.status));
  const status: Cell["status"] = conflicted
    ? "review"
    : statuses.has("confirmed")
      ? "confirmed"
      : statuses.has("carried")
        ? "carried"
        : // Only assert `review` when a source actually says so. An absent
          // status is unknown provenance, not a disputed call, and defaulting
          // it to `review` would silence every cell from a build that predates
          // the reconciliation pass.
          statuses.has("review")
          ? "review"
          : undefined;

  // Certainty goes with the MAJORITY of the volumes making this call, and a
  // polarity dissent forces `variable` however it is phrased.
  //
  // Not "hedged in any source means hedged": WHO writes multi-clause profile
  // sentences ("Neoplastic cells express CD20, CD79a, and PAX5; usually IgM;
  // occasionally IgG…") whose hedges belong to the immunoglobulin clause, and
  // the extraction tags every marker in such a sentence `variable` — so a
  // single mis-scoped hedge could otherwise soften a call four other volumes
  // state flatly. Not "any definite means definite" either: presenting hedged
  // calls as definite was the single largest inaccuracy this table has had
  // (see types.ts on `certainty`), and an optimistic pooling rule would walk
  // straight back into it. The majority, with definite winning a tie.
  const agreeing = claims.filter((c) => c.polarity === polarity);
  const hedgedCount = agreeing.filter((c) => c.certainty === "variable").length;
  const hedged =
    hedgedCount > agreeing.length - hedgedCount || claims.some((c) => c.polarity !== polarity);

  return {
    d: targetId,
    m: primary.m,
    polarity,
    certainty: hedged ? "variable" : "definite",
    status,
    pct,
    n,
    pattern: members.find((c) => c.pattern)?.pattern ?? null,
    quote: quotes[0] ?? null,
    quotes: quotes.length > 1 ? quotes : undefined,
    refs,
    sourceCount: members.length,
    conflicted: conflicted || undefined,
  };
}

/**
 * Drop genetic tumour syndromes from the searchable set.
 *
 * A syndrome is not a tumour and does not have an immunoprofile the way one
 * does — what it has is a SURROGATE for a germline defect (SDHB loss standing
 * in for an SDHx mutation, MMR-protein loss for Lynch), performed on the
 * tumour but read as evidence about the patient. Ranking those against real
 * entities on an observed panel compares two different kinds of claim, and the
 * 64 of them were surfacing in differentials where nobody was asking about a
 * predisposition. They are removed from search and from scoring, not from the
 * data — a profile reached by id still renders.
 */
export function withoutSyndromes(matrix: Matrix): Matrix {
  const drop = new Set(
    matrix.diagnoses.filter((d) => d.kind === "syndrome").map((d) => d.id)
  );
  if (drop.size === 0) return matrix;
  return {
    ...matrix,
    diagnoses: matrix.diagnoses.filter((d) => !drop.has(d.id)),
    cells: matrix.cells.filter((c) => !drop.has(c.d)),
  };
}

export interface AggregateResult {
  matrix: Matrix;
  /** How many chapter rows collapsed into how many tumours. */
  stats: { before: number; after: number; merged: number; redirectsApplied: number };
  /** chapter-row id → canonical id, so an old deep link still resolves. */
  idMap: Record<string, string>;
}

/**
 * Collapse `matrix` to one diagnosis per tumour. Pure — the input is untouched.
 */
export function aggregateMatrix(matrix: Matrix, redirects: RedirectMap = {}): AggregateResult {
  // Pass 1: assign every chapter row a group key.
  const members = new Map<string, Diagnosis[]>();
  let redirectsApplied = 0;

  const byId = new Map(matrix.diagnoses.map((d) => [d.id, d]));
  for (const dx of matrix.diagnoses) {
    const resolved = resolveSlug(dx.id, redirects);
    if (resolved !== dx.id) redirectsApplied++;
    // The merge target names the group even when the winning row is itself
    // absent from this matrix build — that is what keeps a redirect meaningful.
    const naming = byId.get(resolved) ?? dx;
    const key = canonicalName(naming.name);
    const bucket = members.get(key);
    if (bucket) bucket.push(dx);
    else members.set(key, [dx]);
  }

  // Pass 2: pick each group's representative and build the merged diagnosis.
  const cellCount = new Map<string, number>();
  for (const c of matrix.cells) cellCount.set(c.d, (cellCount.get(c.d) ?? 0) + 1);

  const diagnoses: Diagnosis[] = [];
  const idMap: Record<string, string> = {};
  // Hoisted: this was being rebuilt once per group, which is 1,900 × 1,086
  // set insertions on the live matrix for a value that never changes.
  const winners = new Set(Object.values(redirects));

  for (const [, group] of members) {
    // Prefer a row the graph itself named as a merge winner; then the
    // best-characterised row; then the shortest (most canonical) name.
    const rep =
      [...group].sort((a, b) => {
        const wa = Number(winners.has(a.id));
        const wb = Number(winners.has(b.id));
        if (wa !== wb) return wb - wa;
        const ca = cellCount.get(a.id) ?? 0;
        const cb = cellCount.get(b.id) ?? 0;
        if (ca !== cb) return cb - ca;
        if (a.name.length !== b.name.length) return a.name.length - b.name.length;
        return a.id.localeCompare(b.id);
      })[0] ?? group[0];

    // The displayed name is the group's commonest spelling, shortest on a tie —
    // "Acute myeloid leukaemia", not "Acute myeloid leukaemia (AML)".
    const nameTally = new Map<string, number>();
    for (const g of group) nameTally.set(g.name, (nameTally.get(g.name) ?? 0) + 1);
    const name =
      [...nameTally.entries()].sort(
        (a, b) => b[1] - a[1] || a[0].length - b[0].length || a[0].localeCompare(b[0])
      )[0]?.[0] ?? rep.name;

    const organs = [...new Set(group.map((g) => g.organ).filter(Boolean))].sort();
    const books = [...new Set(group.map((g) => g.book).filter((b): b is string => Boolean(b)))].sort();
    // Every spelling this tumour appears under is searchable, so a query using
    // one book's wording still finds the merged entry.
    const aliases = [
      ...new Set([
        ...group.flatMap((g) => g.aliases ?? []),
        ...group.map((g) => g.name).filter((n) => n !== name),
      ]),
    ];
    // A kind that is not "neoplasm" was asserted deliberately; it wins.
    const kind = group.find((g) => g.kind && g.kind !== "neoplasm")?.kind ?? rep.kind;

    for (const g of group) idMap[g.id] = rep.id;

    diagnoses.push({
      ...rep,
      name,
      // `organs` is built from this group, so it always contains rep's.
      organ: rep.organ,
      organs,
      books,
      aliases,
      kind,
      memberIds: group.map((g) => g.id),
    });
  }

  // Pass 3: re-key every cell onto its group, then pool per (group, marker).
  const bucket = new Map<string, Cell[]>();
  for (const c of matrix.cells) {
    const target = idMap[c.d];
    if (!target) continue;
    const key = `${target}|${c.m}`;
    const list = bucket.get(key);
    if (list) list.push(c);
    else bucket.set(key, [c]);
  }

  const cells: Cell[] = [];
  for (const [key, group] of bucket) {
    const target = key.slice(0, key.lastIndexOf("|"));
    cells.push(group.length === 1 ? { ...group[0], d: target } : poolCells(group, target));
  }

  diagnoses.sort((a, b) => a.name.localeCompare(b.name));

  return {
    matrix: { ...matrix, diagnoses, cells },
    stats: {
      before: matrix.diagnoses.length,
      after: diagnoses.length,
      merged: matrix.diagnoses.length - diagnoses.length,
      redirectsApplied,
    },
    idMap,
  };
}
