// Scheduler — Sections 6 & 7: Chunking + work-item construction.
// Turns resolved phase resources into discrete WorkItems: variable (book/video,
// chunked into ~hour sessions) and fixed-daily (qbank/flashcards, pre-allocated per day).
import { StudyResource, SubjectEntry } from "../types";
import { PhaseResourceInfo } from "./resources";
import {
  rankBySubjectOrder,
  adjustSubjectForProgress,
  allocateSubjectDays,
  computeDailyAllocations,
} from "./pace";

const CHUNK_TARGET_MIN = 60;
const VIDEO_ATOMIC_THRESHOLD_MIN = 90;
const BOOK_MERGE_THRESHOLD = 1.3;

export interface WorkItem {
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

export function buildVariableWorkItems(
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
export function buildFixedDailyItems(
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
