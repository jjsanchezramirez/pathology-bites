// Scheduler — Section 10: Stable task IDs.
import { ScheduleTask } from "../types";

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

export function assignTaskIds(tasks: ScheduleTask[]): ScheduleTask[] {
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
