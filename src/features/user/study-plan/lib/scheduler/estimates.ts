// Scheduler — Section 5: Time estimates.
// Per-phase available-vs-needed hour estimates (drives the setup UI's budget warnings).
import { StudyResource, StudyConfig, PhaseTimeEstimate, ScheduleWarning } from "../types";
import { buildCalendar } from "./calendar";
import { getPhaseResources } from "./resources";
import { computeResourceTotalMinutes, computeStudyMinutes } from "./pace";

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
