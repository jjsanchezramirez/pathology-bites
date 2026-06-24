// Scheduler — Section 1: Calendar.
// Builds the day-by-day study calendar (study / rest / exam / off days) from the phase config.
import { StudyConfig, PhaseConfig } from "../types";

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
