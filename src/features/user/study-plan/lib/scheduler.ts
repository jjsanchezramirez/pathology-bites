import {
  StudyResource,
  StudyConfig,
  ScheduleTask,
  PhaseConfig,
  SubjectEntry,
  ContentType,
  PhaseTimeEstimate,
  ScheduleWarning,
  FixedDistribution,
} from "./types";

// ===== Constants =====

const CHUNK_TARGET_MIN = 60;
const VIDEO_ATOMIC_THRESHOLD_MIN = 90;
const BOOK_MERGE_THRESHOLD = 1.3;

// =====================================================================
// SECTION 1: Calendar
// =====================================================================

export interface CalendarDay {
  date: string;
  type: "study" | "rest" | "exam" | "gone" | "half" | "off";
  available_minutes: number;
  phase_idx: number;
  exam_name?: string;
}

function resolveCatchupFirst(
  phase: PhaseConfig
): { mode: "date"; date: string } | { mode: "day"; day: number } | null {
  if (phase.catchup_first_date) return { mode: "date", date: phase.catchup_first_date };
  if (phase.catchup_first_day && phase.catchup_first_day > 0)
    return { mode: "day", day: phase.catchup_first_day };
  return null;
}

/**
 * Build the calendar from phase[0].start_date through the last exam or phase end.
 * If `effectiveStart` is provided, days before it are skipped from output but
 * counters still advance so catch-up day cadence remains anchored to phase start.
 */
export function buildCalendar(config: StudyConfig, effectiveStart?: string): CalendarDay[] {
  const days: CalendarDay[] = [];
  const phases = [...config.phases].sort((a, b) => a.start_date.localeCompare(b.start_date));
  if (phases.length === 0) return days;

  const startDate = new Date(phases[0].start_date + "T12:00:00");
  const lastExam =
    config.exam_dates.length > 0
      ? config.exam_dates.reduce((m, e) => (e.date > m ? e.date : m), "")
      : "";
  const lastPhase = phases[phases.length - 1].end_date;
  const endStr = lastExam > lastPhase ? lastExam : lastPhase;
  const endDate = new Date(endStr + "T12:00:00");
  const counters: number[] = phases.map(() => 0);
  const current = new Date(startDate);

  // Pre-compute the day before each exam
  const preExamDates = new Set<string>();
  for (const exam of config.exam_dates) {
    const d = new Date(exam.date + "T12:00:00");
    d.setDate(d.getDate() - 1);
    preExamDates.add(d.toISOString().split("T")[0]);
  }

  const emit = (day: CalendarDay) => {
    if (!effectiveStart || day.date >= effectiveStart) days.push(day);
  };

  while (current <= endDate) {
    const ds = current.toISOString().split("T")[0];
    const dow = current.getDay();
    const isWeekend = dow === 0 || dow === 6;

    let phaseIdx = -1;
    for (let i = 0; i < phases.length; i++) {
      if (ds >= phases[i].start_date && ds <= phases[i].end_date) {
        phaseIdx = i;
        break;
      }
    }

    // Exam day
    const exam = config.exam_dates.find((e) => e.date === ds);
    if (exam) {
      emit({
        date: ds,
        type: "exam",
        available_minutes: 0,
        phase_idx: phaseIdx,
        exam_name: exam.name,
      });
      current.setDate(current.getDate() + 1);
      continue;
    }

    // Day before exam: rest/review/relax
    if (preExamDates.has(ds)) {
      emit({ date: ds, type: "rest", available_minutes: 0, phase_idx: phaseIdx });
      current.setDate(current.getDate() + 1);
      continue;
    }

    // Full day off
    if (config.days_off[ds] === "full") {
      emit({ date: ds, type: "gone", available_minutes: 0, phase_idx: phaseIdx });
      current.setDate(current.getDate() + 1);
      continue;
    }

    // Recurring off
    if (config.recurring_off?.includes(dow)) {
      emit({ date: ds, type: "off", available_minutes: 0, phase_idx: phaseIdx });
      current.setDate(current.getDate() + 1);
      continue;
    }

    // Not in any phase
    if (phaseIdx === -1) {
      current.setDate(current.getDate() + 1);
      continue;
    }

    const phase = phases[phaseIdx];
    const base = isWeekend ? phase.daily_minutes_weekend : phase.daily_minutes_weekday;
    const isHalf = config.days_off[ds] === "half";
    const avail = isHalf ? Math.floor(base / 2) : base;

    // Catch-up logic
    const counter = counters[phaseIdx];
    const catchupFirst = resolveCatchupFirst(phase);
    let isCatchup = false;

    if (phase.catchup_every > 0) {
      if (catchupFirst?.mode === "date") {
        if (ds >= catchupFirst.date) {
          const diff = Math.round(
            (new Date(ds + "T12:00:00").getTime() -
              new Date(catchupFirst.date + "T12:00:00").getTime()) /
              86400000
          );
          isCatchup = diff >= 0 && diff % phase.catchup_every === 0;
        }
      } else {
        const firstDay = catchupFirst?.day ?? phase.catchup_every;
        isCatchup =
          counter > 0 && counter >= firstDay && (counter - firstDay) % phase.catchup_every === 0;
      }
    }

    if (isCatchup) {
      emit({ date: ds, type: "rest", available_minutes: 0, phase_idx: phaseIdx });
      counters[phaseIdx]++;
      current.setDate(current.getDate() + 1);
      continue;
    }

    emit({
      date: ds,
      type: isHalf ? "half" : "study",
      available_minutes: avail,
      phase_idx: phaseIdx,
    });
    counters[phaseIdx]++;
    current.setDate(current.getDate() + 1);
  }

  return days;
}

// =====================================================================
// SECTION 2: Phase resource resolution
// =====================================================================

interface PhaseResourceInfo {
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
function partitionSubjects(
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

function getPhaseResources(
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

// =====================================================================
// SECTION 3: Validation
// =====================================================================

export interface ValidationError {
  field: string;
  message: string;
}

export function validateConfig(
  _resources: StudyResource[],
  config: StudyConfig
): ValidationError[] {
  const errors: ValidationError[] = [];
  if (config.phases.length === 0)
    errors.push({ field: "phases", message: "Add at least one phase" });

  for (let i = 0; i < config.phases.length; i++) {
    const phase = config.phases[i];
    if (!phase.start_date || !phase.end_date) {
      errors.push({
        field: `phases[${i}]`,
        message: `${phase.name || `Phase ${i + 1}`}: missing dates`,
      });
      continue;
    }
    if (phase.start_date > phase.end_date)
      errors.push({
        field: `phases[${i}]`,
        message: `${phase.name}: start date is after end date`,
      });
    if (phase.daily_minutes_weekday <= 0 && phase.daily_minutes_weekend <= 0)
      errors.push({
        field: `phases[${i}]`,
        message: `${phase.name}: no study hours configured`,
      });
    if (!phase.resources?.length)
      errors.push({ field: `phases[${i}]`, message: `${phase.name}: no resources assigned` });
    for (let j = i + 1; j < config.phases.length; j++) {
      const o = config.phases[j];
      if (
        o.start_date &&
        o.end_date &&
        phase.start_date <= o.end_date &&
        phase.end_date >= o.start_date
      )
        errors.push({
          field: `phases[${i}]`,
          message: `${phase.name} overlaps with ${o.name}`,
        });
    }
  }
  return errors;
}

// =====================================================================
// SECTION 4: Pace helpers
// =====================================================================

function computeStudyMinutes(subject: SubjectEntry, resource: StudyResource): number {
  if (resource.type === "video") return subject.content_amount / resource.pace;
  return (subject.content_amount / resource.pace) * 60;
}

function computeResourceTotalMinutes(resource: StudyResource): number {
  return resource.subjects
    .filter((s) => s.active !== false)
    .reduce((sum, s) => sum + computeStudyMinutes(s, resource), 0);
}

/** Lookup category's rank in subject_order; unranked → large sentinel so they sort last. */
function rankBySubjectOrder(categoryId: string | undefined, subjectOrder: string[]): number {
  if (!categoryId) return 9999;
  const i = subjectOrder.indexOf(categoryId);
  return i >= 0 ? i : 9999;
}

/**
 * Subtract completed units from a subject. Returns null if fully complete,
 * otherwise a shallow copy with reduced content_amount and advanced start_page (books only).
 */
function adjustSubjectForProgress(
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
function computeDailyAllocations(
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
function allocateSubjectDays(units: number[], totalDays: number): number[] {
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

// =====================================================================
// SECTION 5: Time estimates
// =====================================================================

export function estimatePhaseHours(
  resources: StudyResource[],
  config: StudyConfig
): PhaseTimeEstimate[] {
  const calendar = buildCalendar(config);
  // getPhaseResources requires a warnings sink; this estimate helper doesn't
  // surface them (generateSchedule emits the real ones on its own pass).
  const warningsSink: ScheduleWarning[] = [];
  const estimates: PhaseTimeEstimate[] = [];

  for (let phaseIdx = 0; phaseIdx < config.phases.length; phaseIdx++) {
    const phase = config.phases[phaseIdx];
    const phaseDays = calendar.filter(
      (d) => d.phase_idx === phaseIdx && (d.type === "study" || d.type === "half")
    );
    const totalAvailMin = phaseDays.reduce((s, d) => s + d.available_minutes, 0);
    const studyDayCount = phaseDays.filter((d) => d.available_minutes > 0).length;
    const effectiveDayCount = phaseDays.reduce(
      (s, d) => s + (d.type === "half" ? 0.5 : d.available_minutes > 0 ? 1 : 0),
      0
    );
    const phaseResources = getPhaseResources(
      phase,
      phaseIdx + 1,
      resources,
      config.phases,
      calendar,
      warningsSink
    );
    const resourceHours: PhaseTimeEstimate["resource_hours"] = [];
    let totalNeededMin = 0;

    for (const {
      resource,
      mode,
      review_pct,
      subject_filter,
      content_start_frac,
      content_end_frac,
    } of phaseResources) {
      const fullMin = computeResourceTotalMinutes(resource);
      let neededMin: number;
      if (mode === "review") {
        neededMin = fullMin * (review_pct / 100);
      } else if (subject_filter) {
        // Whole-subject partition (video/book/qbank).
        neededMin = resource.subjects
          .filter((s) => s.active !== false && subject_filter.has(s.name))
          .reduce((sum, s) => sum + computeStudyMinutes(s, resource), 0);
      } else {
        // Either single-phase (range=[0,1]) or splittable multi-phase flashcards.
        neededMin = fullMin * (content_end_frac - content_start_frac);
      }
      totalNeededMin += neededMin;
      resourceHours.push({
        resource_name: resource.name,
        total_hours: Math.round((neededMin / 60) * 10) / 10,
        hours_per_day:
          studyDayCount > 0 ? Math.round((neededMin / 60 / studyDayCount) * 100) / 100 : 0,
      });
    }

    estimates.push({
      phase_index: phaseIdx,
      phase_name: phase.name,
      total_available_hours: Math.round((totalAvailMin / 60) * 10) / 10,
      total_needed_hours: Math.round((totalNeededMin / 60) * 10) / 10,
      study_day_count: studyDayCount,
      effective_day_count: effectiveDayCount,
      resource_hours: resourceHours,
      surplus_hours: Math.round(((totalAvailMin - totalNeededMin) / 60) * 10) / 10,
    });
  }
  return estimates;
}

// =====================================================================
// SECTION 6: Chunking
// =====================================================================

interface WorkItem {
  resource_id: string;
  resource_name: string;
  resource_type: string;
  subject_id: string;
  subject: string;
  category_id?: string;
  activity: string;
  minutes: number;
  is_review: boolean;
  content_units: number;
  content_label: string;
}

function verbForType(type: string): string {
  switch (type) {
    case "book":
      return "Read";
    case "video":
      return "Watch";
    case "qbank":
      return "Do";
    case "flashcards":
      return "Review";
    default:
      return "";
  }
}

function activityPrefix(resource: StudyResource, subject: SubjectEntry): string {
  const verb = verbForType(resource.type);
  const short = resource.short_name || resource.name;
  return subject.name ? `${verb} ${short}: ${subject.name}` : `${verb} ${short}`;
}

function chunkVideo(
  subject: SubjectEntry,
  resource: StudyResource,
  fraction: number,
  isReview: boolean
): WorkItem[] {
  const total = Math.ceil(subject.content_amount * fraction);
  const studyMin = total / resource.pace;
  const prefix = activityPrefix(resource, subject);

  if (studyMin <= VIDEO_ATOMIC_THRESHOLD_MIN) {
    return [
      {
        resource_id: resource.id,
        resource_name: resource.name,
        resource_type: "video",
        subject_id: subject.id || subject.name,
        subject: subject.name,
        category_id: subject.category_id,
        activity: `${prefix} (${resource.pace}x, ${Math.ceil(studyMin)}m)`,
        minutes: Math.ceil(studyMin),
        is_review: isReview,
        content_units: total,
        content_label: `${total} min video`,
      },
    ];
  }

  const parts = Math.ceil(studyMin / CHUNK_TARGET_MIN);
  const mpp = Math.ceil(studyMin / parts);
  const dpp = Math.ceil(total / parts);
  const items: WorkItem[] = [];
  for (let i = 0; i < parts; i++) {
    const last = i === parts - 1;
    const pm = last ? Math.ceil(studyMin - mpp * i) : mpp;
    const pd = last ? total - dpp * i : dpp;
    items.push({
      resource_id: resource.id,
      resource_name: resource.name,
      resource_type: "video",
      subject_id: subject.id || subject.name,
      subject: subject.name,
      category_id: subject.category_id,
      activity: `${prefix} Pt ${i + 1}/${parts} (${resource.pace}x, ${Math.max(1, pm)}m)`,
      minutes: Math.max(1, pm),
      is_review: isReview,
      content_units: Math.max(1, pd),
      content_label: `${Math.max(1, pd)} min video`,
    });
  }
  return items;
}

function chunkBook(
  subject: SubjectEntry,
  resource: StudyResource,
  fraction: number,
  isReview: boolean
): WorkItem[] {
  const sp = subject.start_page || 1;
  const prefix = activityPrefix(resource, subject);

  // Chunk into uniform ~CHUNK_TARGET_MIN sessions
  const fullPg = subject.content_amount;
  const ppc = Math.max(1, Math.floor((CHUNK_TARGET_MIN / 60) * resource.pace));
  let fullChunks = Math.ceil(fullPg / ppc);
  if (fullPg <= ppc * BOOK_MERGE_THRESHOLD) fullChunks = 1;
  const appc = Math.ceil(fullPg / fullChunks);

  // Build all full-size chunks with proper page ranges
  const allChunks: { start: number; end: number; pg: number }[] = [];
  for (let i = 0; i < fullChunks; i++) {
    const cs = sp + i * appc;
    const ce = Math.min(cs + appc - 1, sp + fullPg - 1);
    const pg = ce - cs + 1;
    if (pg > 0) allChunks.push({ start: cs, end: ce, pg });
  }

  // For review: sample evenly across all chunks (every Nth)
  // For study with fraction < 1: take the first N chunks (sequential)
  let selectedChunks: typeof allChunks;
  if (isReview && fraction < 1 && allChunks.length > 1) {
    const targetCount = Math.max(1, Math.round(allChunks.length * fraction));
    const step = allChunks.length / targetCount;
    selectedChunks = [];
    for (let i = 0; i < targetCount; i++) {
      selectedChunks.push(allChunks[Math.floor(i * step)]);
    }
  } else if (fraction < 1) {
    const targetCount = Math.max(1, Math.round(allChunks.length * fraction));
    selectedChunks = allChunks.slice(0, targetCount);
  } else {
    selectedChunks = allChunks;
  }

  const items: WorkItem[] = [];
  const total = selectedChunks.length;
  for (let i = 0; i < total; i++) {
    const c = selectedChunks[i];
    const mins = Math.ceil((c.pg / resource.pace) * 60);
    const pl = total > 1 ? ` ${i + 1}/${total}` : "";
    items.push({
      resource_id: resource.id,
      resource_name: resource.name,
      resource_type: "book",
      subject_id: subject.id || subject.name,
      subject: subject.name,
      category_id: subject.category_id,
      activity: `${prefix}${pl} (pp ${c.start}-${c.end}, ${c.pg} pg)`,
      minutes: mins,
      is_review: isReview,
      content_units: c.pg,
      content_label: `pp ${c.start}-${c.end}`,
    });
  }
  return items;
}

// =====================================================================
// SECTION 7: Build work items (variable only: book + video)
// =====================================================================

function buildVariableWorkItems(
  phaseResources: PhaseResourceInfo[],
  completedProgress?: Record<string, number>
): WorkItem[] {
  const items: WorkItem[] = [];

  for (const { resource, mode, review_pct, subject_filter } of phaseResources) {
    if (resource.type !== "book" && resource.type !== "video") continue;

    const isReview = mode === "review";
    const fraction = isReview ? review_pct / 100 : 1;

    for (const subject of resource.subjects) {
      if (subject.active === false) continue;
      if (!isReview && subject_filter && !subject_filter.has(subject.name)) continue;

      const subjectKey = subject.id || subject.name;
      const done =
        !isReview && completedProgress
          ? completedProgress[`${resource.id}::${subjectKey}`] || 0
          : 0;
      const adj = adjustSubjectForProgress(subject, done, resource.type);
      if (!adj) continue;

      const chunks =
        resource.type === "video"
          ? chunkVideo(adj, resource, fraction, isReview)
          : chunkBook(adj, resource, fraction, isReview);
      items.push(...chunks);
    }
  }

  return items;
}

/**
 * Build fixed-daily items (qbank + flashcards) for each day.
 * Per-day unit count is driven by the distribution shape (flat/front/middle/end)
 * and always sums to exactly the available content — no lumpy tails, no over-allocation.
 * Returns perDay[dayIdx][...] arrays.
 */
function buildFixedDailyItems(
  phaseResources: PhaseResourceInfo[],
  subjectOrder: string[],
  totalDays: number,
  completedProgress: Record<string, number> | undefined
): WorkItem[][] {
  const perDay: WorkItem[][] = Array.from({ length: totalDays }, () => []);
  if (totalDays === 0) return perDay;

  // Preserve resource order (rank) so same-day output respects user priority.
  const sortedResources = [...phaseResources].sort((a, b) => a.rank - b.rank);

  for (const info of sortedResources) {
    const {
      resource,
      mode,
      review_pct,
      subject_filter,
      content_start_frac,
      content_end_frac,
      distribution,
    } = info;
    if (resource.type !== "qbank" && resource.type !== "flashcards") continue;

    const isReview = mode === "review";
    const reviewFrac = isReview ? review_pct / 100 : 1;

    // Collect subjects in subject_order. For splittable resources (qbank/flashcards)
    // this phase owns a [content_start_frac, content_end_frac] slice of each subject's
    // original content. For review mode subject_filter is null so this is a no-op.
    const active = resource.subjects
      .filter((s) => s.active !== false)
      .filter((s) => isReview || !subject_filter || subject_filter.has(s.name));

    const sorted = [...active].sort(
      (a, b) =>
        rankBySubjectOrder(a.category_id, subjectOrder) -
        rankBySubjectOrder(b.category_id, subjectOrder)
    );

    type Slice = { subject: SubjectEntry; startAt: number; remaining: number };
    const slices: Slice[] = [];
    for (const subject of sorted) {
      if (isReview) {
        // Review samples the whole subject; no cross-phase slicing.
        const reviewUnits = Math.max(1, Math.round(subject.content_amount * reviewFrac));
        slices.push({ subject, startAt: 1, remaining: reviewUnits });
        continue;
      }
      // Study mode: this phase owns [phaseStart, phaseEnd] of the original content.
      const phaseStart = Math.floor(content_start_frac * subject.content_amount) + 1;
      const phaseEnd = Math.floor(content_end_frac * subject.content_amount);
      if (phaseEnd < phaseStart) continue;

      // Subtract completed progress (global count; earlier phases may have consumed past phaseStart).
      const subjectKey = subject.id || subject.name;
      const done = completedProgress ? completedProgress[`${resource.id}::${subjectKey}`] || 0 : 0;
      const actualStart = Math.max(phaseStart, done + 1);
      if (actualStart > phaseEnd) continue;
      slices.push({ subject, startAt: actualStart, remaining: phaseEnd - actualStart + 1 });
    }

    const totalUnits = slices.reduce((s, x) => s + x.remaining, 0);
    if (totalUnits === 0) continue;

    const label = resource.type === "qbank" ? "Qs" : "cards";
    const unitWord = resource.type === "qbank" ? "questions" : "cards";

    const emit = (dayIdx: number, slice: Slice, take: number) => {
      const startUnit = slice.startAt;
      const endUnit = startUnit + take - 1;
      const minutes = Math.ceil((take / resource.pace) * 60);
      const prefix = activityPrefix(resource, slice.subject);
      perDay[dayIdx].push({
        resource_id: resource.id,
        resource_name: resource.name,
        resource_type: resource.type,
        subject_id: slice.subject.id || slice.subject.name,
        subject: slice.subject.name,
        category_id: slice.subject.category_id,
        activity: `${prefix}: ${label} ${startUnit}-${endUnit} (${take} ${label})`,
        minutes,
        is_review: isReview,
        content_units: take,
        content_label: `${take} ${unitWord}`,
      });
      slice.startAt += take;
      slice.remaining -= take;
    };

    if (slices.length <= totalDays) {
      // Per-subject day ranges: each subject gets a contiguous block of days
      // proportional to its remaining units. Distribution shape is applied
      // INSIDE each block, so "end" means each subject ramps up over its own
      // days (not just the last subject getting the back-loaded curve).
      const subjectDays = allocateSubjectDays(
        slices.map((s) => s.remaining),
        totalDays
      );
      let dayCursor = 0;
      for (let i = 0; i < slices.length; i++) {
        const slice = slices[i];
        const days = subjectDays[i];
        if (days === 0 || slice.remaining === 0) {
          dayCursor += days;
          continue;
        }
        const dailyTargets = computeDailyAllocations(slice.remaining, days, distribution);
        for (let d = 0; d < days; d++) {
          const take = dailyTargets[d];
          if (take === 0) continue;
          emit(dayCursor + d, slice, take);
        }
        dayCursor += days;
      }
    } else {
      // More subjects than days — can't give each its own block. Fall back to
      // a single phase-wide distribution curve and drain subjects in order.
      const dailyTargets = computeDailyAllocations(totalUnits, totalDays, distribution);
      let si = 0;
      for (let d = 0; d < totalDays && si < slices.length; d++) {
        let remaining = dailyTargets[d];
        while (remaining > 0 && si < slices.length) {
          const slice = slices[si];
          if (slice.remaining <= 0) {
            si++;
            continue;
          }
          const take = Math.min(remaining, slice.remaining);
          emit(d, slice, take);
          remaining -= take;
          if (slice.remaining <= 0) si++;
        }
      }
    }
  }

  return perDay;
}

// =====================================================================
// SECTION 8: Distribution
// =====================================================================

/**
 * Order variable work items (book/video).
 *
 * STUDY mode: strict serial by subject_order, then by user's resource rank,
 * then preserve original chunk order (Chapter 1 → 2 → 3).
 *
 * REVIEW mode (pool is all review): subjects fully interleaved across the phase,
 * respecting resource rank on ties. This keeps review spread instead of draining
 * one subject then the next.
 */
function orderVariablePool(
  pool: WorkItem[],
  subjectOrder: string[],
  resourceRank: Map<string, number>
): WorkItem[] {
  if (pool.length === 0) return [];
  const rankRes = (name: string) => resourceRank.get(name) ?? 9999;

  const allReview = pool.every((it) => it.is_review);
  if (allReview) {
    // Group by (resource, subject) preserving chunk order within each group.
    const groups = new Map<string, WorkItem[]>();
    for (const item of pool) {
      const key = `${item.resource_name}::${item.subject}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    // Round-robin one item from each group, ordered by (resource rank, subject_order rank, subject name).
    const entries = [...groups.entries()].map(([, items]) => items);
    entries.sort((a, b) => {
      const r = rankRes(a[0].resource_name) - rankRes(b[0].resource_name);
      if (r !== 0) return r;
      const s =
        rankBySubjectOrder(a[0].category_id, subjectOrder) -
        rankBySubjectOrder(b[0].category_id, subjectOrder);
      if (s !== 0) return s;
      return a[0].subject.localeCompare(b[0].subject);
    });
    const result: WorkItem[] = [];
    const maxLen = Math.max(...entries.map((g) => g.length), 0);
    for (let i = 0; i < maxLen; i++) {
      for (const group of entries) {
        if (i < group.length) result.push(group[i]);
      }
    }
    return result;
  }

  // Study mode: strict serial.
  const byCat = new Map<string, WorkItem[]>();
  for (const item of pool) {
    const cat = item.category_id || "__none__";
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat)!.push(item);
  }
  const catEntries = [...byCat.entries()];
  catEntries.sort(
    (a, b) =>
      rankBySubjectOrder(a[0] === "__none__" ? undefined : a[0], subjectOrder) -
      rankBySubjectOrder(b[0] === "__none__" ? undefined : b[0], subjectOrder)
  );

  const result: WorkItem[] = [];
  for (const [, catItems] of catEntries) {
    const byRes = new Map<string, WorkItem[]>();
    for (const item of catItems) {
      if (!byRes.has(item.resource_name)) byRes.set(item.resource_name, []);
      byRes.get(item.resource_name)!.push(item);
    }
    const resEntries = [...byRes.entries()];
    resEntries.sort((a, b) => rankRes(a[0]) - rankRes(b[0]));
    for (const [, resItems] of resEntries) {
      result.push(...resItems);
    }
  }
  return result;
}

function distributeEven(
  studyDays: CalendarDay[],
  variableItems: WorkItem[],
  fixedPerDay: WorkItem[][],
  phase: PhaseConfig,
  subjectOrder: string[],
  resourceRank: Map<string, number>,
  shortNameById: Map<string, string>,
  warnings: ScheduleWarning[]
): ScheduleTask[] {
  const usableDays = studyDays.filter((d) => d.available_minutes > 0);
  const totalDays = usableDays.length;
  if (totalDays === 0) return [];

  const variableQueue = orderVariablePool(variableItems, subjectOrder, resourceRank);

  const dailyPlan: WorkItem[][] = Array.from({ length: totalDays }, () => []);

  // 1. Place fixed items (qbank/flashcards) — already pre-allocated per day
  //    by buildFixedDailyItems with the configured distribution shape.
  for (let d = 0; d < totalDays; d++) {
    for (const item of fixedPerDay[d] || []) {
      dailyPlan[d].push(item);
    }
  }

  // 2. Spread variable items (books/videos) forward in queue order using a
  //    weighted fair-share target per day: each day gets a fraction of the
  //    total variable minutes proportional to its available_minutes (so
  //    weekends or half-days scale accordingly). Items stay in queue order
  //    so the natural subject/resource sequence maps to date order — item 0
  //    lands on day 0, item N lands on day N-1. This ignores how much of a
  //    day's nominal budget fixed items already consumed: when the phase is
  //    over-budget, the overload is spread evenly across days instead of
  //    being concentrated on one mega-day or scattered via round-robin.
  const totalVarMin = variableQueue.reduce((s, it) => s + it.minutes, 0);
  const totalAvail = usableDays.reduce((s, d) => s + d.available_minutes, 0);
  const perDayTarget = usableDays.map((d) =>
    totalAvail > 0 ? totalVarMin * (d.available_minutes / totalAvail) : totalVarMin / totalDays
  );

  let varCursor = 0;
  for (let d = 0; d < totalDays && varCursor < variableQueue.length; d++) {
    let dayVarMin = 0;
    const target = perDayTarget[d];
    while (varCursor < variableQueue.length && dayVarMin < target) {
      const item = variableQueue[varCursor++];
      dailyPlan[d].push(item);
      dayVarMin += item.minutes;
    }
  }

  // Floating-point underfill safety net: any trailing items go on the last day.
  while (varCursor < variableQueue.length) {
    const item = variableQueue[varCursor++];
    dailyPlan[totalDays - 1].push(item);
  }

  // Warn once if the phase is over budget — the daily targets will push days
  // past their nominal hours proportionally, not scatter items.
  const totalFixedMin = fixedPerDay.reduce(
    (s, arr) => s + arr.reduce((t, it) => t + it.minutes, 0),
    0
  );
  const totalLoad = totalVarMin + totalFixedMin;
  if (totalLoad > totalAvail * 1.02) {
    const overageMin = Math.round(totalLoad - totalAvail);
    warnings.push({
      type: "overloaded_day",
      message: `${phase.name}: ~${overageMin} min over budget — increase hours/day or split phase`,
    });
  }

  const result: ScheduleTask[] = [];
  for (let d = 0; d < totalDays; d++) {
    const day = usableDays[d];
    const dayItems = dailyPlan[d];
    // Within-day order: resource priority (phase.resources[] index), then
    // subject priority. Same-resource items stay clustered.
    dayItems.sort((a, b) => {
      const rr =
        (resourceRank.get(a.resource_name) ?? 9999) - (resourceRank.get(b.resource_name) ?? 9999);
      if (rr !== 0) return rr;
      return (
        rankBySubjectOrder(a.category_id, subjectOrder) -
        rankBySubjectOrder(b.category_id, subjectOrder)
      );
    });

    for (let i = 0; i < dayItems.length; i++) {
      const item = dayItems[i];
      result.push({
        task_id: "",
        date: day.date,
        idx: i,
        resource_id: item.resource_id,
        resource_name: item.resource_name,
        resource_type: item.resource_type as "qbank" | "book" | "video" | "flashcards",
        subject_id: item.subject_id,
        subject: item.subject,
        activity: item.activity,
        minutes: item.minutes,
        task_type: "task",
        is_review: item.is_review,
        content_units: item.content_units,
        content_label: item.content_label,
      });
    }
  }

  return glueSmallSlices(mergeSameDayTasks(result, shortNameById), shortNameById);
}

// =====================================================================
// SECTION 8b: Glue small slices across days
// =====================================================================

/** Below these, a task is considered a fragment that should be glued to
 *  an adjacent same-resource/subject task instead of standing alone. */
function isTinySlice(task: ScheduleTask): boolean {
  if (task.task_type !== "task") return false;
  const label = task.content_label || "";
  const pp = label.match(/^pp (\d+)-(\d+)$/);
  if (pp) return parseInt(pp[2]) - parseInt(pp[1]) + 1 <= 5; // book: ≤5 pages
  if (label.endsWith("min video")) return task.minutes < 10; // video: <10 min
  if (label.includes("questions")) return task.content_units <= 5; // qbank: ≤5 Qs
  if (label.includes("cards")) return task.content_units <= 5; // flashcards: ≤5
  return false;
}

/** Re-home tiny tasks onto the nearest same-resource/subject/review task
 *  on another day, then re-run same-day merging so adjacent book page
 *  ranges collapse. If every task in a group is tiny (no big anchor), the
 *  group is left alone. */
function glueSmallSlices(
  tasks: ScheduleTask[],
  shortNameById: Map<string, string>
): ScheduleTask[] {
  const keyOf = (t: ScheduleTask) => `${t.resource_name}::${t.subject}::${t.is_review ? "R" : "S"}`;

  const groups = new Map<string, ScheduleTask[]>();
  for (const t of tasks) {
    if (t.task_type !== "task") continue;
    const k = keyOf(t);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(t);
  }

  const relocated = new Map<ScheduleTask, string>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => a.date.localeCompare(b.date));

    for (let i = 0; i < group.length; i++) {
      const t = group[i];
      if (!isTinySlice(t)) continue;
      let anchor: ScheduleTask | null = null;
      let dist = Infinity;
      for (let j = 0; j < group.length; j++) {
        if (j === i || isTinySlice(group[j])) continue;
        const dj = Math.abs(j - i);
        // Prefer nearer; on ties, prefer earlier (absorb tail into parent).
        if (dj < dist || (dj === dist && j < i)) {
          anchor = group[j];
          dist = dj;
        }
      }
      if (anchor) relocated.set(t, anchor.date);
    }
  }

  if (relocated.size === 0) return tasks;

  const rewritten = tasks.map((t) => {
    const d = relocated.get(t);
    return d ? { ...t, date: d } : t;
  });
  return mergeSameDayTasks(rewritten, shortNameById);
}

// =====================================================================
// SECTION 9: Same-day merging
// =====================================================================

function mergeSameDayTasks(
  tasks: ScheduleTask[],
  shortNameById: Map<string, string>
): ScheduleTask[] {
  const grouped = new Map<string, ScheduleTask[]>();
  for (const t of tasks) {
    if (!grouped.has(t.date)) grouped.set(t.date, []);
    grouped.get(t.date)!.push(t);
  }

  const result: ScheduleTask[] = [];

  for (const [date, dayTasks] of grouped) {
    const mergeGroups = new Map<string, ScheduleTask[]>();
    for (const t of dayTasks) {
      if (t.task_type !== "task") {
        result.push(t);
        continue;
      }
      const key = `${t.resource_id}::${t.subject_id}::${t.is_review ? "R" : "S"}`;
      if (!mergeGroups.has(key)) mergeGroups.set(key, []);
      mergeGroups.get(key)!.push(t);
    }

    let idx = 0;
    for (const [, group] of mergeGroups) {
      if (group.length === 1) {
        result.push({ ...group[0], date, idx: idx++ });
        continue;
      }
      const first = group[0];
      const last = group[group.length - 1];
      const totalMin = group.reduce((s, t) => s + t.minutes, 0);
      const totalUnits = group.reduce((s, t) => s + t.content_units, 0);
      const verb = first.activity.split(" ")[0] || "";
      const short = shortNameById.get(first.resource_id) || first.resource_name;

      // For books, merge page ranges: "pp 55-67" + "pp 68-80" → "pp 55-80"
      const firstPp = first.content_label?.match(/^pp (\d+)-/);
      const lastPp = last.content_label?.match(/^pp \d+-(\d+)/);
      let mergedLabel: string;
      if (firstPp && lastPp) {
        mergedLabel = `pp ${firstPp[1]}-${lastPp[1]}`;
      } else {
        const unitType = first.content_label?.replace(/^\d+\s*/, "") || "";
        mergedLabel = `${totalUnits} ${unitType}`.trim();
      }

      const activityPrefix = first.subject
        ? `${verb} ${short}: ${first.subject}`
        : `${verb} ${short}`;
      result.push({
        task_id: "",
        date,
        idx: idx++,
        resource_id: first.resource_id,
        resource_name: first.resource_name,
        resource_type: first.resource_type,
        subject_id: first.subject_id,
        subject: first.subject,
        activity: `${activityPrefix} (${mergedLabel})`,
        minutes: totalMin,
        task_type: "task",
        is_review: first.is_review,
        content_units: totalUnits,
        content_label: mergedLabel,
      });
    }
  }
  return result;
}

// =====================================================================
// SECTION 10: Task IDs
// =====================================================================

/**
 * Stable hash of date | resource_id | subject_id | review flag. Activity is
 * intentionally excluded so chunk-size config tweaks don't invalidate IDs.
 * After mergeSameDayTasks + glueSmallSlices there is at most one task per
 * (date, resource_id, subject_id, is_review), so no collisions occur in practice.
 * Pre-migration rows may not have a subject_id yet; fall back to subject name
 * so the hash matches what the older code produced.
 */
function stableTaskId(task: ScheduleTask): string {
  const rid = task.resource_id || task.task_type;
  const sid = task.subject_id || task.subject;
  const key = `${task.date}|${rid}|${sid}|${task.is_review ? "R" : "S"}`;
  let hash = 5381;
  for (let i = 0; i < key.length; i++) hash = ((hash << 5) + hash + key.charCodeAt(i)) & 0xffffffff;
  return `${task.date}-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function assignTaskIds(tasks: ScheduleTask[]): ScheduleTask[] {
  const grouped = new Map<string, ScheduleTask[]>();
  for (const t of tasks) {
    if (!grouped.has(t.date)) grouped.set(t.date, []);
    grouped.get(t.date)!.push(t);
  }

  const result: ScheduleTask[] = [];
  for (const [, dayTasks] of grouped) {
    dayTasks.sort(
      (a, b) => a.resource_name.localeCompare(b.resource_name) || a.subject.localeCompare(b.subject)
    );
    dayTasks.forEach((t, i) => {
      result.push({ ...t, idx: i, task_id: stableTaskId(t) });
    });
  }

  return result.sort((a, b) => a.date.localeCompare(b.date) || a.idx - b.idx);
}

// =====================================================================
// SECTION 11: Main entry point
// =====================================================================

export function generateSchedule(
  resources: StudyResource[],
  config: StudyConfig,
  completedProgress?: Record<string, number>,
  effectiveStart?: string
): { tasks: ScheduleTask[]; warnings: ScheduleWarning[] } {
  const warnings: ScheduleWarning[] = [];

  if (config.phases.length === 0) return { tasks: [], warnings };

  const calendar = buildCalendar(config, effectiveStart);
  const allTasks: ScheduleTask[] = [];

  for (let phaseIdx = 0; phaseIdx < config.phases.length; phaseIdx++) {
    const phase = config.phases[phaseIdx];
    const phaseDays = calendar.filter(
      (d) => d.phase_idx === phaseIdx && (d.type === "study" || d.type === "half")
    );
    const phaseResources = getPhaseResources(
      phase,
      phaseIdx + 1,
      resources,
      config.phases,
      calendar,
      warnings
    );

    if (phaseResources.length === 0) {
      warnings.push({ type: "empty_phase", message: `${phase.name}: no resources assigned` });
      continue;
    }
    if (phaseDays.length === 0) {
      warnings.push({ type: "empty_phase", message: `${phase.name}: no study days available` });
      continue;
    }

    const subjectOrder = phase.subject_order || [];
    const studyDayCount = phaseDays.filter((d) => d.available_minutes > 0).length;
    // Resource rank = index in phase.resources[] → same priority for variable AND fixed.
    const resourceRank = new Map<string, number>();
    phaseResources.forEach((info) => resourceRank.set(info.resource.name, info.rank));
    const shortNameById = new Map<string, string>();
    phaseResources.forEach((info) =>
      shortNameById.set(info.resource.id, info.resource.short_name || info.resource.name)
    );
    const variableItems = buildVariableWorkItems(phaseResources, completedProgress);
    const fixedPerDay = buildFixedDailyItems(
      phaseResources,
      subjectOrder,
      studyDayCount,
      completedProgress
    );
    const phaseTasks = distributeEven(
      phaseDays,
      variableItems,
      fixedPerDay,
      phase,
      subjectOrder,
      resourceRank,
      shortNameById,
      warnings
    );
    allTasks.push(...phaseTasks);
  }

  // Rest/exam/gone days are not stored. The UI computes them from config via
  // buildCalendar() at render time. Only real study tasks live in the schedule.

  return { tasks: assignTaskIds(allTasks), warnings };
}

// Internal helpers exposed only for unit tests. Not part of the public API.
export const __test__ = {
  computeDailyAllocations,
  allocateSubjectDays,
  buildCalendar,
  partitionSubjects,
  rankBySubjectOrder,
};
