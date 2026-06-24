// Study-plan scheduler — public API.
//
// This module was split from a single 1,400-line scheduler.ts into focused
// stage modules (calendar → resources → pace → work-items → distribution →
// task-ids → generate). The public surface below is unchanged: consumers still
// `import { ... } from "../lib/scheduler"`.
export { buildCalendar, type CalendarDay } from "./calendar";
export { validateConfig } from "./validation";
export { estimatePhaseHours } from "./estimates";
export { generateSchedule } from "./generate";

import { buildCalendar } from "./calendar";
import { partitionSubjects } from "./resources";
import { computeDailyAllocations, allocateSubjectDays, rankBySubjectOrder } from "./pace";

// Internal helpers exposed only for unit tests. Not part of the public API.
export const __test__ = {
  computeDailyAllocations,
  allocateSubjectDays,
  buildCalendar,
  partitionSubjects,
  rankBySubjectOrder,
};
