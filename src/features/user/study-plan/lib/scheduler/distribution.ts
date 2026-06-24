// Scheduler — Sections 8, 8b, 9: Distribution, slice-gluing, and same-day merging.
// Spreads work items across the phase's study days and collapses fragments.
import { PhaseConfig, ScheduleTask, ScheduleWarning } from "../types";
import { CalendarDay } from "./calendar";
import { WorkItem } from "./work-items";
import { rankBySubjectOrder } from "./pace";

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

export function distributeEven(
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
