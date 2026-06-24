// Scheduler — Section 11: Main entry point.
// Orchestrates the full pipeline: calendar → per-phase resources → work items →
// distribution → stable task IDs.
import { StudyResource, StudyConfig, ScheduleTask, ScheduleWarning } from "../types";
import { buildCalendar } from "./calendar";
import { getPhaseResources } from "./resources";
import { buildVariableWorkItems, buildFixedDailyItems } from "./work-items";
import { distributeEven } from "./distribution";
import { assignTaskIds } from "./task-ids";

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
