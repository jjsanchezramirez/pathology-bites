// Pure helpers extracted from setup-sheet.tsx — time/date formatting, subject
// ordering, rebalance progress aggregation, and surplus colors. Unit-tested in
// isolation (see setup-sheet-utils.test.ts).

import type { ScheduleTask, StudyResource } from "../lib/types";

/** Format a fractional-hours value as "1h 30m" / "45m" / "2h" (signed). */
export function fmtH(h: number): string {
  if (h === 0) return "0m";
  const whole = Math.floor(Math.abs(h));
  const mins = Math.round((Math.abs(h) - whole) * 60);
  const sign = h < 0 ? "-" : "";
  if (whole === 0) return `${sign}${mins}m`;
  if (mins === 0) return `${sign}${whole}h`;
  return `${sign}${whole}h ${mins}m`;
}

/** Format a start/end date pair as "Jan 3 – Feb 9" (or "No dates"). */
export function fmtRange(s: string, e: string): string {
  if (!s || !e) return "No dates";
  const f = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${f(s)} – ${f(e)}`;
}

/** Saved order first (filtered to known ids), then any canonical ids not yet ordered. */
export function orderedSubjectIds(savedOrder: string[], canonicalAllIds: string[]): string[] {
  return [
    ...savedOrder.filter((id) => canonicalAllIds.includes(id)),
    ...canonicalAllIds.filter((id) => !savedOrder.includes(id)),
  ];
}

/**
 * Aggregate completed content-units per `resource_id::subject_id` so the scheduler
 * can skip finished work. Pre-migration rows missing ids are recovered by name.
 */
export function aggregateRebalanceProgress(
  schedule: ScheduleTask[],
  completedTasks: Record<string, string>,
  resources: StudyResource[]
): Record<string, number> {
  const progress: Record<string, number> = {};
  for (const task of schedule) {
    if (!completedTasks[task.task_id] || task.task_type !== "task" || task.content_units <= 0) {
      continue;
    }
    const r = task.resource_id
      ? resources.find((x) => x.id === task.resource_id)
      : resources.find((x) => x.name === task.resource_name);
    const rid = task.resource_id || r?.id;
    if (!rid) continue;
    const sid =
      task.subject_id || r?.subjects.find((s) => s.name === task.subject)?.id || task.subject;
    const key = `${rid}::${sid}`;
    progress[key] = (progress[key] || 0) + task.content_units;
  }
  return progress;
}

/** Text color class for a phase's hours surplus relative to availability. */
export function surplusColor(surplus: number, available: number): string {
  if (available <= 0) return "text-muted-foreground";
  const ratio = surplus / available;
  if (ratio >= -0.05) return "text-emerald-500";
  if (ratio >= -0.15) return "text-amber-400";
  return "text-destructive";
}

/** Bar (background) color class for a phase's hours surplus relative to availability. */
export function surplusBarColor(surplus: number, available: number): string {
  if (available <= 0) return "bg-muted";
  const ratio = surplus / available;
  if (ratio >= -0.05) return "bg-emerald-300";
  if (ratio >= -0.15) return "bg-amber-300";
  return "bg-destructive";
}

/** Menu summary of the days-off map ("2 days off · 1 half-days off" / "None"). */
export function daysOffSummary(daysOff: Record<string, string> | undefined): string {
  const offs = Object.values(daysOff || {});
  const full = offs.filter((v) => v === "full").length;
  const half = offs.filter((v) => v === "half").length;
  const parts: string[] = [];
  if (full > 0) parts.push(`${full} days off`);
  if (half > 0) parts.push(`${half} half-days off`);
  return parts.length > 0 ? parts.join(" · ") : "None";
}

/** Total schedule time from minutes → "2h30m" / "45m" / "3h". */
export function formatTotalTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h${m}m`;
}

/** Tongue-in-cheek warning when the busiest phase's average daily load is unrealistic. */
export function overloadMessage(maxAvgDailyHours: number): string | null {
  const h = Math.ceil(maxAvgDailyHours);
  if (h > 24)
    return `Fun fact: the Earth completes one full rotation in 24 hours, not ${h}h. Unless you've discovered a new planet?`;
  if (h > 16)
    return `${h}h daily of studying? Sleep is not a luxury, it's when your brain consolidates memories. You need those.`;
  if (h > 12)
    return `${h}h daily? Bold strategy. Your attention span checked out around hour 6, but sure.`;
  if (h > 8)
    return `${h}h daily? That's a full work day plus overtime. Don't forget to eat, stretch, and see sunlight.`;
  return null;
}
