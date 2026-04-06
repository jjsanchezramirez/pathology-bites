import {
  StudyResource, StudyConfig, ScheduleTask, PhaseConfig,
  SubjectEntry, ContentType, PhaseTimeEstimate, ScheduleWarning,
} from './types';
import { getCategoryParent } from './categories';

// ===== Constants =====

const DEFAULT_CONTENT_ORDER: ContentType[] = ['qbank', 'book', 'video', 'flashcards'];
const CHUNK_TARGET_MIN = 60;
const VIDEO_ATOMIC_THRESHOLD_MIN = 90;
const BOOK_MERGE_THRESHOLD = 1.3;

// =====================================================================
// SECTION 1: Calendar
// =====================================================================

export interface CalendarDay {
  date: string;
  type: 'study' | 'rest' | 'exam' | 'gone' | 'half' | 'off';
  available_minutes: number;
  phase_idx: number;
  exam_name?: string;
}

/** Resolve the catchup_first field from legacy union or new typed fields */
function resolveCatchupFirst(phase: PhaseConfig): { mode: 'date'; date: string } | { mode: 'day'; day: number } | null {
  // New fields take precedence
  if (phase.catchup_first_date) return { mode: 'date', date: phase.catchup_first_date };
  if (phase.catchup_first_day && phase.catchup_first_day > 0) return { mode: 'day', day: phase.catchup_first_day };
  // Legacy union
  if (phase.catchup_first) {
    if (typeof phase.catchup_first === 'string' && phase.catchup_first.includes('-')) {
      return { mode: 'date', date: phase.catchup_first };
    }
    const num = typeof phase.catchup_first === 'number' ? phase.catchup_first : parseInt(phase.catchup_first);
    if (num > 0) return { mode: 'day', day: num };
  }
  return null;
}

export function buildCalendar(config: StudyConfig): CalendarDay[] {
  const days: CalendarDay[] = [];
  const phases = [...config.phases].sort((a, b) => a.start_date.localeCompare(b.start_date));
  if (phases.length === 0) return days;

  const startDate = new Date(phases[0].start_date + 'T12:00:00');
  const lastExam = config.exam_dates.length > 0 ? config.exam_dates.reduce((m, e) => e.date > m ? e.date : m, '') : '';
  const lastPhase = phases[phases.length - 1].end_date;
  const endStr = lastExam > lastPhase ? lastExam : lastPhase;
  const endDate = new Date(endStr + 'T12:00:00');
  const counters: number[] = phases.map(() => 0);
  const current = new Date(startDate);

  // Pre-compute the day before each exam
  const preExamDates = new Set<string>();
  for (const exam of config.exam_dates) {
    const d = new Date(exam.date + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    preExamDates.add(d.toISOString().split('T')[0]);
  }

  while (current <= endDate) {
    const ds = current.toISOString().split('T')[0];
    const dow = current.getDay();
    const isWeekend = dow === 0 || dow === 6;

    let phaseIdx = -1;
    for (let i = 0; i < phases.length; i++) {
      if (ds >= phases[i].start_date && ds <= phases[i].end_date) { phaseIdx = i; break; }
    }

    // Exam day
    const exam = config.exam_dates.find(e => e.date === ds);
    if (exam) { days.push({ date: ds, type: 'exam', available_minutes: 0, phase_idx: phaseIdx, exam_name: exam.name }); current.setDate(current.getDate() + 1); continue; }

    // Day before exam: rest/review/relax
    if (preExamDates.has(ds)) { days.push({ date: ds, type: 'rest', available_minutes: 0, phase_idx: phaseIdx }); current.setDate(current.getDate() + 1); continue; }

    // Full day off
    if (config.days_off[ds] === 'full') { days.push({ date: ds, type: 'gone', available_minutes: 0, phase_idx: phaseIdx }); current.setDate(current.getDate() + 1); continue; }

    // Recurring off
    if (config.recurring_off?.includes(dow)) { days.push({ date: ds, type: 'off', available_minutes: 0, phase_idx: phaseIdx }); current.setDate(current.getDate() + 1); continue; }

    // Not in any phase
    if (phaseIdx === -1) { current.setDate(current.getDate() + 1); continue; }

    const phase = phases[phaseIdx];
    const base = isWeekend ? phase.daily_minutes_weekend : phase.daily_minutes_weekday;
    const isHalf = config.days_off[ds] === 'half';
    const avail = isHalf ? Math.floor(base / 2) : base;

    // Catch-up logic
    const counter = counters[phaseIdx];
    const catchupFirst = resolveCatchupFirst(phase);
    let isCatchup = false;

    if (phase.catchup_every > 0) {
      if (catchupFirst?.mode === 'date') {
        if (ds >= catchupFirst.date) {
          const diff = Math.round((new Date(ds + 'T12:00:00').getTime() - new Date(catchupFirst.date + 'T12:00:00').getTime()) / 86400000);
          isCatchup = diff >= 0 && diff % phase.catchup_every === 0;
        }
      } else {
        const firstDay = catchupFirst?.day ?? phase.catchup_every;
        isCatchup = counter > 0 && counter >= firstDay && (counter - firstDay) % phase.catchup_every === 0;
      }
    }

    if (isCatchup) {
      days.push({ date: ds, type: 'rest', available_minutes: 0, phase_idx: phaseIdx });
      counters[phaseIdx]++;
      current.setDate(current.getDate() + 1);
      continue;
    }

    days.push({ date: ds, type: isHalf ? 'half' : 'study', available_minutes: avail, phase_idx: phaseIdx });
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
  mode: 'study' | 'review';
  review_pct: number;
  study_fraction: number;
}

function getPhaseResources(
  phase: PhaseConfig, phaseNum: number, allResources: StudyResource[],
  allPhases: PhaseConfig[], calendar: CalendarDay[],
  warnings: ScheduleWarning[],
): PhaseResourceInfo[] {
  // Legacy fallback
  if (!phase.resources || phase.resources.length === 0) {
    return allResources
      .filter(r => r.active !== false && r.phases?.includes(phaseNum))
      .map(r => ({ resource: r, mode: 'study' as const, review_pct: 0, study_fraction: 1 }));
  }

  const results: PhaseResourceInfo[] = [];

  for (const pr of phase.resources) {
    const r = allResources.find(res => res.id === pr.resource_id);
    if (!r) {
      warnings.push({ type: 'missing_resource', message: `${phase.name}: resource "${pr.resource_id}" not found` });
      continue;
    }

    const mode = pr.mode || 'study';
    const review_pct = pr.review_pct ?? 50;

    let study_fraction = 1;
    if (mode === 'study') {
      // Find all phases where this resource is in study mode
      const studyPhaseIndices: number[] = [];
      for (let i = 0; i < allPhases.length; i++) {
        if (allPhases[i].resources?.some(a => a.resource_id === r.id && (a.mode || 'study') === 'study')) {
          studyPhaseIndices.push(i);
        }
      }

      if (studyPhaseIndices.length > 1) {
        const daysByPhase = studyPhaseIndices.map(pi =>
          calendar.filter(d => d.phase_idx === pi && (d.type === 'study' || d.type === 'half')).length
        );
        const totalDays = daysByPhase.reduce((s, d) => s + d, 0);
        const thisIdx = studyPhaseIndices.indexOf(phaseNum - 1);

        if (totalDays > 0 && thisIdx >= 0) {
          study_fraction = daysByPhase[thisIdx] / totalDays;
        }

        // Validate fractions sum to ~1
        const totalFraction = daysByPhase.reduce((s, d) => s + d / totalDays, 0);
        if (Math.abs(totalFraction - 1) > 0.01) {
          warnings.push({ type: 'fraction_mismatch', message: `${r.name}: study fractions sum to ${(totalFraction * 100).toFixed(0)}% across phases` });
        }
      }
    }

    results.push({ resource: r, mode, review_pct, study_fraction });
  }

  return results;
}

// =====================================================================
// SECTION 3: Validation
// =====================================================================

export interface ValidationError { field: string; message: string; }

export function validateConfig(resources: StudyResource[], config: StudyConfig): ValidationError[] {
  const errors: ValidationError[] = [];
  if (config.phases.length === 0) errors.push({ field: "phases", message: "Add at least one phase" });

  for (let i = 0; i < config.phases.length; i++) {
    const phase = config.phases[i];
    if (!phase.start_date || !phase.end_date) { errors.push({ field: `phases[${i}]`, message: `${phase.name || `Phase ${i + 1}`}: missing dates` }); continue; }
    if (phase.start_date > phase.end_date) errors.push({ field: `phases[${i}]`, message: `${phase.name}: start date is after end date` });
    if (phase.daily_minutes_weekday <= 0 && phase.daily_minutes_weekend <= 0) errors.push({ field: `phases[${i}]`, message: `${phase.name}: no study hours configured` });
    const hasRes = phase.resources?.length || resources.some(r => r.active !== false && r.phases?.includes(i + 1));
    if (!hasRes) errors.push({ field: `phases[${i}]`, message: `${phase.name}: no resources assigned` });
    for (let j = i + 1; j < config.phases.length; j++) {
      const o = config.phases[j];
      if (o.start_date && o.end_date && phase.start_date <= o.end_date && phase.end_date >= o.start_date)
        errors.push({ field: `phases[${i}]`, message: `${phase.name} overlaps with ${o.name}` });
    }
  }
  return errors;
}

// =====================================================================
// SECTION 4: Pace helpers
// =====================================================================

function computeStudyMinutes(subject: SubjectEntry, resource: StudyResource): number {
  if (resource.type === 'video') return subject.content_amount / resource.pace;
  return (subject.content_amount / resource.pace) * 60;
}

function computeResourceTotalMinutes(resource: StudyResource): number {
  return resource.subjects.filter(s => s.active !== false)
    .reduce((sum, s) => sum + computeStudyMinutes(s, resource), 0);
}

// =====================================================================
// SECTION 5: Time estimates
// =====================================================================

export function estimatePhaseHours(resources: StudyResource[], config: StudyConfig, prebuiltCalendar?: CalendarDay[]): PhaseTimeEstimate[] {
  const calendar = prebuiltCalendar || buildCalendar(config);
  const warnings: ScheduleWarning[] = [];
  const estimates: PhaseTimeEstimate[] = [];

  for (let phaseIdx = 0; phaseIdx < config.phases.length; phaseIdx++) {
    const phase = config.phases[phaseIdx];
    const phaseDays = calendar.filter(d => d.phase_idx === phaseIdx && (d.type === 'study' || d.type === 'half'));
    const totalAvailMin = phaseDays.reduce((s, d) => s + d.available_minutes, 0);
    const studyDayCount = phaseDays.filter(d => d.available_minutes > 0).length;
    const effectiveDayCount = phaseDays.reduce((s, d) => s + (d.type === 'half' ? 0.5 : d.available_minutes > 0 ? 1 : 0), 0);
    const phaseResources = getPhaseResources(phase, phaseIdx + 1, resources, config.phases, calendar, warnings);
    const resourceHours: PhaseTimeEstimate['resource_hours'] = [];
    let totalNeededMin = 0;

    for (const { resource, mode, review_pct, study_fraction } of phaseResources) {
      const fullMin = computeResourceTotalMinutes(resource);
      const neededMin = mode === 'review' ? fullMin * (review_pct / 100) : fullMin * study_fraction;
      totalNeededMin += neededMin;
      resourceHours.push({
        resource_name: resource.name,
        total_hours: Math.round(neededMin / 60 * 10) / 10,
        hours_per_day: studyDayCount > 0 ? Math.round(neededMin / 60 / studyDayCount * 100) / 100 : 0,
      });
    }

    estimates.push({
      phase_index: phaseIdx, phase_name: phase.name,
      total_available_hours: Math.round(totalAvailMin / 60 * 10) / 10,
      total_needed_hours: Math.round(totalNeededMin / 60 * 10) / 10,
      study_day_count: studyDayCount,
      effective_day_count: effectiveDayCount,
      resource_hours: resourceHours,
      surplus_hours: Math.round((totalAvailMin - totalNeededMin) / 60 * 10) / 10,
    });
  }
  return estimates;
}

// =====================================================================
// SECTION 6: Chunking
// =====================================================================

interface WorkItem {
  resource_name: string;
  resource_type: string;
  subject: string;
  category_id?: string;
  activity: string;
  minutes: number;
  is_review: boolean;
  content_units: number;
  content_label: string;
}

function verbForType(type: string): string {
  switch (type) { case 'book': return 'Read'; case 'video': return 'Watch'; case 'qbank': return 'Do'; case 'flashcards': return 'Review'; default: return ''; }
}

function activityPrefix(resource: StudyResource, subject: SubjectEntry): string {
  const verb = verbForType(resource.type);
  const short = resource.short_name || resource.name;
  return subject.name ? `${verb} ${short}: ${subject.name}` : `${verb} ${short}`;
}

function chunkVideo(subject: SubjectEntry, resource: StudyResource, fraction: number, isReview: boolean): WorkItem[] {
  const total = Math.ceil(subject.content_amount * fraction);
  const studyMin = total / resource.pace;
  const prefix = activityPrefix(resource, subject);
  const rl = isReview ? ' (review)' : '';

  if (studyMin <= VIDEO_ATOMIC_THRESHOLD_MIN) {
    return [{ resource_name: resource.name, resource_type: 'video', subject: subject.name, category_id: subject.category_id,
      activity: `${prefix} (${resource.pace}x, ${Math.ceil(studyMin)}m)${rl}`, minutes: Math.ceil(studyMin),
      is_review: isReview, content_units: total, content_label: `${total} min video` }];
  }

  const parts = Math.ceil(studyMin / CHUNK_TARGET_MIN);
  const mpp = Math.ceil(studyMin / parts);
  const dpp = Math.ceil(total / parts);
  const items: WorkItem[] = [];
  for (let i = 0; i < parts; i++) {
    const last = i === parts - 1;
    const pm = last ? Math.ceil(studyMin - mpp * i) : mpp;
    const pd = last ? total - dpp * i : dpp;
    items.push({ resource_name: resource.name, resource_type: 'video', subject: subject.name, category_id: subject.category_id,
      activity: `${prefix} Pt ${i+1}/${parts} (${resource.pace}x, ${Math.max(1,pm)}m)${rl}`,
      minutes: Math.max(1, pm), is_review: isReview, content_units: Math.max(1, pd), content_label: `${Math.max(1,pd)} min video` });
  }
  return items;
}

function chunkBook(subject: SubjectEntry, resource: StudyResource, fraction: number, isReview: boolean): WorkItem[] {
  const sp = subject.start_page || 1;
  const prefix = activityPrefix(resource, subject);
  const rl = isReview ? ' (review)' : '';

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
    const pl = total > 1 ? ` ${i+1}/${total}` : '';
    items.push({ resource_name: resource.name, resource_type: 'book', subject: subject.name, category_id: subject.category_id,
      activity: `${prefix}${pl} (pp ${c.start}-${c.end}, ${c.pg} pg)${rl}`,
      minutes: mins, is_review: isReview, content_units: c.pg, content_label: `pp ${c.start}-${c.end}` });
  }
  return items;
}

function chunkCountable(subject: SubjectEntry, resource: StudyResource, fraction: number, isReview: boolean): WorkItem[] {
  const fullTotal = subject.content_amount;
  const upc = Math.max(1, Math.floor((CHUNK_TARGET_MIN / 60) * resource.pace));
  const label = resource.type === 'qbank' ? 'Qs' : 'cards';
  const prefix = activityPrefix(resource, subject);
  const rl = isReview ? ' (review)' : '';

  // Build all full-size chunks first
  const fullChunks = Math.max(1, Math.ceil(fullTotal / upc));
  const allChunks: { start: number; end: number; units: number }[] = [];
  let rem = fullTotal;
  for (let i = 0; i < fullChunks; i++) {
    const u = Math.min(upc, rem);
    const s = fullTotal - rem + 1;
    allChunks.push({ start: s, end: s + u - 1, units: u });
    rem -= u;
  }

  // For review: sample evenly across all chunks
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
  for (const c of selectedChunks) {
    const m = Math.ceil((c.units / resource.pace) * 60);
    items.push({ resource_name: resource.name, resource_type: resource.type, subject: subject.name, category_id: subject.category_id,
      activity: `${prefix}: ${label} ${c.start}-${c.end} (${c.units} ${label})${rl}`,
      minutes: m, is_review: isReview, content_units: c.units,
      content_label: `${c.units} ${resource.type === 'qbank' ? 'questions' : 'cards'}` });
  }
  return items;
}

// =====================================================================
// SECTION 7: Build work items
// =====================================================================

function buildWorkItems(
  phaseResources: PhaseResourceInfo[],
  completedProgress?: Record<string, number>,
): WorkItem[] {
  const items: WorkItem[] = [];

  for (const { resource, mode, review_pct, study_fraction } of phaseResources) {
    const fraction = mode === 'review' ? (review_pct / 100) : study_fraction;
    const isReview = mode === 'review';
    const activeSubjects = resource.subjects.filter(s => s.active !== false);

    for (const subject of activeSubjects) {
      // For study mode, subtract completed progress so we don't re-schedule done work
      let adj = subject;
      if (!isReview && completedProgress) {
        const key = `${resource.name}::${subject.name}`;
        const done = completedProgress[key] || 0;
        if (done > 0) {
          if (done >= subject.content_amount) continue; // fully done, skip
          adj = {
            ...subject,
            content_amount: subject.content_amount - done,
            start_page: resource.type === 'book' ? (subject.start_page || 1) + done : subject.start_page,
          };
        }
      }

      let chunks: WorkItem[];
      if (resource.type === 'video') chunks = chunkVideo(adj, resource, fraction, isReview);
      else if (resource.type === 'book') chunks = chunkBook(adj, resource, fraction, isReview);
      else chunks = chunkCountable(adj, resource, fraction, isReview);
      items.push(...chunks);
    }
  }

  return items;
}

// =====================================================================
// SECTION 8: Distribution (even + interleaved)
// =====================================================================


/**
 * Order a pool of work items for maximum continuity:
 * 1. Group by category_id
 * 2. Sort category groups by rank in subjectOrder (lower index = higher priority)
 * 3. Within each category, group by resource_name
 * 4. Sort resources by typeRank, then name
 * 5. Within each resource, preserve original chunk order (Bacteriology 1 → 2 → 3)
 * For review items, interleave subjects within each resource instead of sequential.
 */
function orderPool(
  pool: WorkItem[],
  subjectOrder: string[],
  typeRank: Record<string, number>,
): WorkItem[] {
  // Group by category_id
  const byCat = new Map<string, WorkItem[]>();
  for (const item of pool) {
    const cat = item.category_id || '__none__';
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat)!.push(item);
  }

  // Sort category groups by subjectOrder rank
  const catEntries = [...byCat.entries()];
  catEntries.sort((a, b) => {
    const ai = subjectOrder.indexOf(a[0]);
    const bi = subjectOrder.indexOf(b[0]);
    const ra = ai >= 0 ? ai : 9999;
    const rb = bi >= 0 ? bi : 9999;
    return ra - rb;
  });

  const result: WorkItem[] = [];

  for (const [, catItems] of catEntries) {
    // Group by resource_name within this category
    const byRes = new Map<string, WorkItem[]>();
    for (const item of catItems) {
      if (!byRes.has(item.resource_name)) byRes.set(item.resource_name, []);
      byRes.get(item.resource_name)!.push(item);
    }

    // Sort resources by typeRank, then name
    const resEntries = [...byRes.entries()];
    resEntries.sort((a, b) => {
      const tr = (typeRank[a[1][0].resource_type] ?? 99) - (typeRank[b[1][0].resource_type] ?? 99);
      if (tr !== 0) return tr;
      return a[0].localeCompare(b[0]);
    });

    for (const [, resItems] of resEntries) {
      const hasReview = resItems.some(it => it.is_review);
      if (hasReview) {
        // Interleave subjects within review resource
        const bySubject = new Map<string, WorkItem[]>();
        for (const item of resItems) {
          if (!bySubject.has(item.subject)) bySubject.set(item.subject, []);
          bySubject.get(item.subject)!.push(item);
        }
        const subjects = [...bySubject.values()];
        const maxLen = Math.max(...subjects.map(s => s.length), 0);
        for (let i = 0; i < maxLen; i++) {
          for (const subjectItems of subjects) {
            if (i < subjectItems.length) result.push(subjectItems[i]);
          }
        }
      } else {
        // Sequential: preserves original chunk order within resource
        result.push(...resItems);
      }
    }
  }

  return result;
}

/**
 * Pull items from queue starting at cursor, filling up to budgetMin.
 * Always allows at least one item if budget > 0 (prevents starvation).
 * Returns updated cursor.
 */
function fillFromQueue(
  queue: WorkItem[],
  cursor: number,
  budgetMin: number,
  target: WorkItem[],
): number {
  if (cursor >= queue.length || budgetMin <= 0) return cursor;

  let used = 0;
  // Always place at least one item if there's any budget
  while (cursor < queue.length) {
    const item = queue[cursor];
    if (used > 0 && used + item.minutes > budgetMin) break;
    target.push(item);
    used += item.minutes;
    cursor++;
  }
  return cursor;
}

function distributeEven(
  studyDays: CalendarDay[], allWorkItems: WorkItem[],
  phase: PhaseConfig,
): ScheduleTask[] {
  const contentOrder = phase.content_type_order || DEFAULT_CONTENT_ORDER;
  const typeRank: Record<string, number> = {};
  contentOrder.forEach((t, i) => { typeRank[t] = i; });

  const usableDays = studyDays.filter(d => d.available_minutes > 0);
  const totalDays = usableDays.length;
  if (totalDays === 0) return [];

  // Step 1: Separate fixed-daily (qbank/flashcards) vs variable (book/video)
  const fixedItems: WorkItem[] = [];
  const variableItems: WorkItem[] = [];
  for (const item of allWorkItems) {
    if (item.resource_type === 'qbank' || item.resource_type === 'flashcards') {
      fixedItems.push(item);
    } else {
      variableItems.push(item);
    }
  }

  // Step 2: Build fixed queues per resource, ordered by subject priority
  const fixedByResource = new Map<string, WorkItem[]>();
  for (const item of fixedItems) {
    if (!fixedByResource.has(item.resource_name)) fixedByResource.set(item.resource_name, []);
    fixedByResource.get(item.resource_name)!.push(item);
  }

  const cpOrder = phase.cp_subject_order || [];
  const apOrder = phase.ap_subject_order || [];
  const combinedSubjectOrder = [...cpOrder, ...apOrder];

  const fixedQueues: { queue: WorkItem[]; chunksPerDay: number }[] = [];
  for (const [, items] of fixedByResource) {
    // Order by subject priority, then preserve chunk order within same category+resource
    const ordered = orderPool(items, combinedSubjectOrder, typeRank);
    const chunksPerDay = Math.ceil(ordered.length / totalDays);
    fixedQueues.push({ queue: ordered, chunksPerDay });
  }

  // Step 3: Classify variable items into AP/CP/uncategorized pools
  const cpPool: WorkItem[] = [];
  const apPool: WorkItem[] = [];
  const uncatPool: WorkItem[] = [];
  for (const item of variableItems) {
    if (!item.category_id) {
      uncatPool.push(item);
    } else {
      const parent = getCategoryParent(item.category_id);
      if (parent === 'CP') cpPool.push(item);
      else if (parent === 'AP') apPool.push(item);
      else uncatPool.push(item);
    }
  }

  // Step 4: Order each pool for continuity
  const cpQueue = orderPool(cpPool, cpOrder, typeRank);
  const apQueue = orderPool(apPool, apOrder, typeRank);
  const uncatQueue = orderPool(uncatPool, combinedSubjectOrder, typeRank);

  // Step 5 & 6: Place items on each day
  const dailyPlan: WorkItem[][] = Array.from({ length: totalDays }, () => []);
  const fixedCursors = fixedQueues.map(() => 0);
  let cpCursor = 0;
  let apCursor = 0;
  let uncatCursor = 0;

  const cpShare = (phase.cp_share ?? 50) / 100;

  for (let d = 0; d < totalDays; d++) {
    let usedMin = 0;

    // Place fixed items
    for (let q = 0; q < fixedQueues.length; q++) {
      const fq = fixedQueues[q];
      for (let i = 0; i < fq.chunksPerDay && fixedCursors[q] < fq.queue.length; i++) {
        const item = fq.queue[fixedCursors[q]++];
        dailyPlan[d].push(item);
        usedMin += item.minutes;
      }
    }

    // Fill variable items with AP/CP time split
    const remaining = usableDays[d].available_minutes - usedMin;
    if (remaining <= 0) continue;

    const cpHasItems = cpCursor < cpQueue.length;
    const apHasItems = apCursor < apQueue.length;

    let cpBudget = 0;
    let apBudget = 0;

    if (cpHasItems && apHasItems) {
      cpBudget = remaining * cpShare;
      apBudget = remaining - cpBudget;
    } else if (cpHasItems) {
      cpBudget = remaining;
    } else if (apHasItems) {
      apBudget = remaining;
    }

    const beforeCp = dailyPlan[d].length;
    cpCursor = fillFromQueue(cpQueue, cpCursor, cpBudget, dailyPlan[d]);
    const cpActual = dailyPlan[d].slice(beforeCp).reduce((s, it) => s + it.minutes, 0);

    const beforeAp = dailyPlan[d].length;
    apCursor = fillFromQueue(apQueue, apCursor, apBudget, dailyPlan[d]);
    const apActual = dailyPlan[d].slice(beforeAp).reduce((s, it) => s + it.minutes, 0);

    // Leftover budget → uncategorized → overflow to whichever pool has items
    let leftover = remaining - cpActual - apActual;
    if (leftover > 0 && uncatCursor < uncatQueue.length) {
      const beforeUncat = dailyPlan[d].length;
      uncatCursor = fillFromQueue(uncatQueue, uncatCursor, leftover, dailyPlan[d]);
      const uncatActual = dailyPlan[d].slice(beforeUncat).reduce((s, it) => s + it.minutes, 0);
      leftover -= uncatActual;
    }

    // Overflow: if one pool finished early, give its leftover to the other
    if (leftover > 0 && cpCursor < cpQueue.length) {
      cpCursor = fillFromQueue(cpQueue, cpCursor, leftover, dailyPlan[d]);
    } else if (leftover > 0 && apCursor < apQueue.length) {
      apCursor = fillFromQueue(apQueue, apCursor, leftover, dailyPlan[d]);
    }
  }

  // Step 7: Sort within each day and convert to ScheduleTask
  const result: ScheduleTask[] = [];

  for (let d = 0; d < totalDays; d++) {
    const day = usableDays[d];
    const dayItems = dailyPlan[d];

    // Sort: variable items first, then fixed (qbank/flashcards at end)
    // Within each group: subject (alphabetical), content type order, resource name
    dayItems.sort((a, b) => {
      const aFixed = a.resource_type === 'qbank' || a.resource_type === 'flashcards' ? 1 : 0;
      const bFixed = b.resource_type === 'qbank' || b.resource_type === 'flashcards' ? 1 : 0;
      if (aFixed !== bFixed) return aFixed - bFixed;
      const sc = a.subject.localeCompare(b.subject);
      if (sc !== 0) return sc;
      const rd = (typeRank[a.resource_type] ?? 99) - (typeRank[b.resource_type] ?? 99);
      if (rd !== 0) return rd;
      return a.resource_name.localeCompare(b.resource_name);
    });

    for (let i = 0; i < dayItems.length; i++) {
      const item = dayItems[i];
      result.push({
        task_id: '', date: day.date, idx: i,
        resource_name: item.resource_name, subject: item.subject,
        activity: item.activity, minutes: item.minutes,
        task_type: 'task', is_review: item.is_review,
        content_units: item.content_units, content_label: item.content_label,
      });
    }
  }

  return mergeSameDayTasks(result);
}

// =====================================================================
// SECTION 9: Same-day merging
// =====================================================================

function mergeSameDayTasks(tasks: ScheduleTask[]): ScheduleTask[] {
  const grouped = new Map<string, ScheduleTask[]>();
  for (const t of tasks) {
    if (!grouped.has(t.date)) grouped.set(t.date, []);
    grouped.get(t.date)!.push(t);
  }

  const result: ScheduleTask[] = [];

  for (const [date, dayTasks] of grouped) {
    const mergeGroups = new Map<string, ScheduleTask[]>();
    for (const t of dayTasks) {
      if (t.task_type !== 'task') { result.push(t); continue; }
      // Use is_review boolean, not string matching
      const key = `${t.resource_name}::${t.subject}::${t.is_review ? 'R' : 'S'}`;
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
      const verb = first.activity.split(' ')[0] || '';

      // For books, merge page ranges: "pp 55-67" + "pp 68-80" → "pp 55-80"
      const firstPp = first.content_label?.match(/^pp (\d+)-/);
      const lastPp = last.content_label?.match(/^pp \d+-(\d+)/);
      let mergedLabel: string;
      if (firstPp && lastPp) {
        mergedLabel = `pp ${firstPp[1]}-${lastPp[1]}`;
      } else {
        const unitType = first.content_label?.replace(/^\d+\s*/, '') || '';
        mergedLabel = `${totalUnits} ${unitType}`.trim();
      }

      result.push({
        task_id: '', date, idx: idx++,
        resource_name: first.resource_name, subject: first.subject,
        activity: `${verb} ${first.resource_name}: ${first.subject} (${mergedLabel})${first.is_review ? ' (review)' : ''}`,
        minutes: totalMin, task_type: 'task', is_review: first.is_review,
        content_units: totalUnits, content_label: mergedLabel,
      });
    }
  }
  return result;
}

// =====================================================================
// SECTION 10: Task IDs
// =====================================================================

function stableTaskId(task: ScheduleTask): string {
  const key = `${task.date}|${task.resource_name}|${task.subject}|${task.activity}`;
  let hash = 5381;
  for (let i = 0; i < key.length; i++) hash = ((hash << 5) + hash + key.charCodeAt(i)) & 0xffffffff;
  return `${task.date}-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function assignTaskIds(tasks: ScheduleTask[]): ScheduleTask[] {
  const grouped = new Map<string, ScheduleTask[]>();
  for (const t of tasks) {
    if (!grouped.has(t.date)) grouped.set(t.date, []);
    grouped.get(t.date)!.push(t);
  }

  const result: ScheduleTask[] = [];
  const usedIds = new Set<string>();

  for (const [, dayTasks] of grouped) {
    dayTasks.forEach((t, i) => {
      let id = stableTaskId(t);
      let suffix = 1;
      while (usedIds.has(id)) { id = `${stableTaskId(t)}_${suffix++}`; }
      usedIds.add(id);
      result.push({ ...t, idx: i, task_id: id });
    });
  }

  return result.sort((a, b) => a.date.localeCompare(b.date) || a.idx - b.idx);
}

// =====================================================================
// SECTION 11: Main entry point
// =====================================================================

export function generateSchedule(
  resources: StudyResource[], config: StudyConfig,
  completedProgress?: Record<string, number>,
): { tasks: ScheduleTask[]; warnings: ScheduleWarning[] } {
  const warnings: ScheduleWarning[] = [];

  if (config.phases.length === 0) return { tasks: [], warnings };

  const calendar = buildCalendar(config);
  const allTasks: ScheduleTask[] = [];

  for (let phaseIdx = 0; phaseIdx < config.phases.length; phaseIdx++) {
    const phase = config.phases[phaseIdx];
    const phaseDays = calendar.filter(d => d.phase_idx === phaseIdx && (d.type === 'study' || d.type === 'half'));
    const phaseResources = getPhaseResources(phase, phaseIdx + 1, resources, config.phases, calendar, warnings);

    if (phaseResources.length === 0) {
      warnings.push({ type: 'empty_phase', message: `${phase.name}: no resources assigned` });
      continue;
    }
    if (phaseDays.length === 0) {
      warnings.push({ type: 'empty_phase', message: `${phase.name}: no study days available` });
      continue;
    }

    const workItems = buildWorkItems(phaseResources, completedProgress);
    const phaseTasks = distributeEven(phaseDays, workItems, phase);
    allTasks.push(...phaseTasks);
  }

  // Add special days
  for (const day of calendar) {
    if (day.type === 'rest') allTasks.push({ task_id: '', date: day.date, idx: 0, resource_name: 'REST', subject: '', activity: 'Catch-up / Rest', minutes: 0, task_type: 'rest', is_review: false, content_units: 0, content_label: '' });
    else if (day.type === 'exam') allTasks.push({ task_id: '', date: day.date, idx: 0, resource_name: 'EXAM', subject: day.exam_name || '', activity: day.exam_name || 'Exam Day', minutes: 0, task_type: 'exam', is_review: false, content_units: 0, content_label: '' });
    else if (day.type === 'gone') allTasks.push({ task_id: '', date: day.date, idx: 0, resource_name: 'GONE', subject: '', activity: 'Day off', minutes: 0, task_type: 'gone', is_review: false, content_units: 0, content_label: '' });
  }

  allTasks.sort((a, b) => a.date.localeCompare(b.date) || a.idx - b.idx);
  return { tasks: assignTaskIds(allTasks), warnings };
}
