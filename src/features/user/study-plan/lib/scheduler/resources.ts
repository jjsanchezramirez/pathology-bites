// Scheduler — Section 2: Phase resource resolution.
// Resolves which resources (and which slice of each) a phase owns, partitioning
// study-mode resources across phases that share them.
import { StudyResource, PhaseConfig, ScheduleWarning, FixedDistribution } from "../types";
import { CalendarDay } from "./calendar";
import { rankBySubjectOrder, computeStudyMinutes } from "./pace";

export interface PhaseResourceInfo {
  resource: StudyResource;
  mode: "study" | "review";
  review_pct: number;
  // Priority within the phase: index in phase.resources[] (lower = higher priority).
  rank: number;
  // Cross-phase splitting strategy depends on resource type:
  //
  //   * video / book / qbank → atomic per subject. `subject_filter` lists which
  //     subjects this phase owns; `content_start_frac` / `content_end_frac` are [0, 1].
  //   * flashcards → countable units; each subject's content is split
  //     proportionally across phases by day share. `subject_filter` is null;
  //     `content_start_frac` / `content_end_frac` delimit this phase's slice.
  //
  // For single-phase or review-mode resources: filter=null, range=[0,1].
  subject_filter: Set<string> | null;
  content_start_frac: number;
  content_end_frac: number;
  distribution: FixedDistribution;
}

function countPhaseStudyDays(calendar: CalendarDay[], phaseIdx: number): number {
  return calendar.filter(
    (d) => d.phase_idx === phaseIdx && (d.type === "study" || d.type === "half")
  ).length;
}

/**
 * For study-mode resources listed in multiple phases, partition WHOLE subjects
 * across phases proportionally to each phase's study days (weighted by subject minutes).
 * Subjects are iterated in the earliest study phase's `subject_order` so
 * high-priority subjects land in earlier phases.
 * Returns map of subject name → phase index.
 */
export function partitionSubjects(
  resource: StudyResource,
  studyPhaseIndices: number[],
  calendar: CalendarDay[],
  allPhases: PhaseConfig[]
): Map<string, number> {
  const earliestOrder = allPhases[studyPhaseIndices[0]]?.subject_order || [];
  const active = resource.subjects
    .filter((s) => s.active !== false)
    .slice()
    .sort(
      (a, b) =>
        rankBySubjectOrder(a.category_id, earliestOrder) -
        rankBySubjectOrder(b.category_id, earliestOrder)
    );
  const subjectMin = active.map((s) => computeStudyMinutes(s, resource));
  const totalMin = subjectMin.reduce((a, b) => a + b, 0);

  const daysByPhase = studyPhaseIndices.map((pi) => countPhaseStudyDays(calendar, pi));
  const totalDays = daysByPhase.reduce((a, b) => a + b, 0);

  const map = new Map<string, number>();
  if (totalMin === 0 || totalDays === 0 || studyPhaseIndices.length === 0) return map;

  // Running minute target through phase p (sum of phases 0..p).
  const phaseTargets: number[] = [];
  let acc = 0;
  for (let i = 0; i < studyPhaseIndices.length; i++) {
    acc += (daysByPhase[i] / totalDays) * totalMin;
    phaseTargets.push(acc);
  }

  // Best-fit pack in subject_order: high-priority subjects land in the earliest
  // phase that can hold them without overshooting its running minute target.
  let placedMin = 0;
  for (let si = 0; si < active.length; si++) {
    let bestPhase = studyPhaseIndices.length - 1;
    let bestOvershoot = Infinity;
    const afterPlace = placedMin + subjectMin[si];
    for (let p = 0; p < studyPhaseIndices.length; p++) {
      if (placedMin >= phaseTargets[p] - 1e-6) continue;
      const overshoot = Math.max(0, afterPlace - phaseTargets[p]);
      if (overshoot < bestOvershoot) {
        bestOvershoot = overshoot;
        bestPhase = p;
      }
    }
    map.set(active[si].name, studyPhaseIndices[bestPhase]);
    placedMin = afterPlace;
  }
  return map;
}

export function getPhaseResources(
  phase: PhaseConfig,
  phaseNum: number,
  allResources: StudyResource[],
  allPhases: PhaseConfig[],
  calendar: CalendarDay[],
  warnings: ScheduleWarning[]
): PhaseResourceInfo[] {
  if (!phase.resources || phase.resources.length === 0) return [];

  const results: PhaseResourceInfo[] = [];
  const thisPhaseIdx = phaseNum - 1;

  phase.resources.forEach((pr, rank) => {
    const r = allResources.find((res) => res.id === pr.resource_id);
    if (!r) {
      warnings.push({
        type: "missing_resource",
        message: `${phase.name}: resource "${pr.resource_id}" not found`,
      });
      return;
    }

    const mode = pr.mode || "study";
    const review_pct = pr.review_pct ?? 50;
    const distribution: FixedDistribution = pr.distribution || "flat";
    let subject_filter: Set<string> | null = null;
    let content_start_frac = 0;
    let content_end_frac = 1;

    if (mode === "study") {
      const studyPhaseIndices: number[] = [];
      for (let i = 0; i < allPhases.length; i++) {
        if (
          allPhases[i].resources?.some(
            (a) => a.resource_id === r.id && (a.mode || "study") === "study"
          )
        ) {
          studyPhaseIndices.push(i);
        }
      }
      if (studyPhaseIndices.length > 1) {
        // Splittable = countable units split by phase share. Flashcards always
        // qualify (spaced practice). A qbank qualifies only when it has a
        // single subject — "finish a section before moving on" is meaningless
        // when there's just one section, so split the questions across phases
        // instead of dumping the whole bank in one phase.
        const activeSubjectCount = r.subjects.filter((s) => s.active !== false).length;
        const splittable =
          r.type === "flashcards" || (r.type === "qbank" && activeSubjectCount === 1);
        if (splittable) {
          // Countable: split each subject's content proportionally by day share.
          const daysByPhase = studyPhaseIndices.map((pi) => countPhaseStudyDays(calendar, pi));
          const totalDays = daysByPhase.reduce((a, b) => a + b, 0);
          if (totalDays > 0) {
            let placedDays = 0;
            for (let i = 0; i < studyPhaseIndices.length; i++) {
              if (studyPhaseIndices[i] === thisPhaseIdx) {
                content_start_frac = placedDays / totalDays;
                content_end_frac = (placedDays + daysByPhase[i]) / totalDays;
                break;
              }
              placedDays += daysByPhase[i];
            }
          }
        } else {
          // Atomic per subject (videos, books, qbanks): whole-subject partition.
          const partition = partitionSubjects(r, studyPhaseIndices, calendar, allPhases);
          subject_filter = new Set<string>();
          for (const [name, pi] of partition) {
            if (pi === thisPhaseIdx) subject_filter.add(name);
          }
        }
      }
    }

    results.push({
      resource: r,
      mode,
      review_pct,
      rank,
      subject_filter,
      content_start_frac,
      content_end_frac,
      distribution,
    });
  });

  return results;
}
