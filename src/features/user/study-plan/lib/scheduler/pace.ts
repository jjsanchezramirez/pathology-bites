// Scheduler — Section 4: Pace & allocation math.
// Pure leaf helpers shared across resolution, chunking, and distribution.
import { StudyResource, SubjectEntry, ContentType, FixedDistribution } from "../types";

export function computeStudyMinutes(subject: SubjectEntry, resource: StudyResource): number {
  if (resource.type === "video") return subject.content_amount / resource.pace;
  return (subject.content_amount / resource.pace) * 60;
}

export function computeResourceTotalMinutes(resource: StudyResource): number {
  return resource.subjects
    .filter((s) => s.active !== false)
    .reduce((sum, s) => sum + computeStudyMinutes(s, resource), 0);
}

/** Lookup category's rank in subject_order; unranked → large sentinel so they sort last. */
export function rankBySubjectOrder(categoryId: string | undefined, subjectOrder: string[]): number {
  if (!categoryId) return 9999;
  const i = subjectOrder.indexOf(categoryId);
  return i >= 0 ? i : 9999;
}

/**
 * Subtract completed units from a subject. Returns null if fully complete,
 * otherwise a shallow copy with reduced content_amount and advanced start_page (books only).
 */
export function adjustSubjectForProgress(
  subject: SubjectEntry,
  done: number,
  resourceType: ContentType
): SubjectEntry | null {
  if (done <= 0) return subject;
  if (done >= subject.content_amount) return null;
  return {
    ...subject,
    content_amount: subject.content_amount - done,
    start_page: resourceType === "book" ? (subject.start_page || 1) + done : subject.start_page,
  };
}

/**
 * Compute per-day unit allocations for a fixed-daily resource given a distribution shape.
 * Σ output === totalUnits exactly (rounding residual carries forward).
 * If totalUnits < totalDays, some days legitimately get 0 — caller decides whether to warn.
 */
export function computeDailyAllocations(
  totalUnits: number,
  totalDays: number,
  shape: FixedDistribution
): number[] {
  if (totalDays <= 0 || totalUnits <= 0) return new Array(Math.max(0, totalDays)).fill(0);

  const weights = new Array<number>(totalDays);
  const denom = Math.max(1, totalDays - 1);
  for (let d = 0; d < totalDays; d++) {
    const t = d / denom;
    switch (shape) {
      case "flat":
        weights[d] = 1;
        break;
      case "front":
        weights[d] = 1.5 - t;
        break;
      case "end":
        weights[d] = 0.5 + t;
        break;
      case "middle":
        weights[d] = 1 - 0.8 * Math.abs(2 * t - 1);
        break;
    }
  }
  const wsum = weights.reduce((a, b) => a + b, 0);

  // Largest-remainder rounding so the sum lands exactly on totalUnits.
  const exact = weights.map((w) => (totalUnits * w) / wsum);
  const floored = exact.map((x) => Math.floor(x));
  let allocated = floored.reduce((a, b) => a + b, 0);
  const fracs = exact.map((x, i) => ({ i, frac: x - Math.floor(x) }));
  fracs.sort((a, b) => b.frac - a.frac);
  let idx = 0;
  while (allocated < totalUnits && idx < fracs.length) {
    floored[fracs[idx].i]++;
    allocated++;
    idx++;
  }
  return floored;
}

/**
 * Split `totalDays` across a list of subjects proportional to their remaining
 * units. Each non-empty subject gets at least 1 day. Sum of output === totalDays.
 * Caller must ensure totalDays >= number of non-zero entries; otherwise the
 * min-1 guarantee would force the sum past totalDays.
 */
export function allocateSubjectDays(units: number[], totalDays: number): number[] {
  const n = units.length;
  if (n === 0 || totalDays <= 0) return new Array(n).fill(0);
  const total = units.reduce((a, b) => a + b, 0);
  if (total === 0) return new Array(n).fill(0);

  const exact = units.map((u) => (totalDays * u) / total);
  const out = exact.map((x) => Math.floor(x));
  for (let i = 0; i < n; i++) if (units[i] > 0 && out[i] === 0) out[i] = 1;
  let allocated = out.reduce((a, b) => a + b, 0);
  if (allocated < totalDays) {
    const fracs = exact
      .map((x, i) => ({ i, frac: x - Math.floor(x) }))
      .filter((f) => units[f.i] > 0)
      .sort((a, b) => b.frac - a.frac);
    let idx = 0;
    while (allocated < totalDays && idx < fracs.length) {
      out[fracs[idx].i]++;
      allocated++;
      idx = (idx + 1) % fracs.length;
    }
  }
  return out;
}
