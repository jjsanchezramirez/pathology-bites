"use client";

import { ScheduleTask, StudyConfig } from "../lib/types";
import { PHASE_PALETTE } from "../lib/color-utils";

function MiniCalendar({
  currentDate, schedule, config, completedTasks, onSelectDate,
}: {
  currentDate: string;
  schedule: ScheduleTask[];
  config: StudyConfig | null;
  completedTasks: Record<string, string>;
  onSelectDate: (date: string) => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const dateObj = new Date(currentDate + "T12:00:00");
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay());

  const cells: Date[] = [];
  const current = new Date(startDate);
  while (current <= lastDay || current.getDay() !== 0) {
    cells.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  const taskDates = new Set(schedule.filter(t => t.task_type === "task").map(t => t.date));
  const examDates = new Set((config?.exam_dates || []).map(e => e.date));

  return (
    <div>
      <div className="mb-2 text-xs font-semibold text-foreground">
        {dateObj.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
      </div>
      <div className="grid grid-cols-7 gap-0">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="pb-1 text-center text-[10px] font-medium text-muted-foreground">
            {d}
          </div>
        ))}
        {cells.map((date, idx) => {
          const dateStr = date.toISOString().split("T")[0];
          const isToday = dateStr === today;
          const isSelected = dateStr === currentDate;
          const isOtherMonth = date.getMonth() !== month;
          const hasTasks = taskDates.has(dateStr);
          const isExam = examDates.has(dateStr);

          return (
            <button
              key={idx}
              onClick={() => onSelectDate(dateStr)}
              className={`relative flex size-7 items-center justify-center rounded-md text-[11px] transition-colors
                ${isOtherMonth ? "text-muted-foreground/30" : "text-foreground"}
                ${isSelected ? "bg-primary text-primary-foreground font-semibold" : "hover:bg-muted"}
                ${isToday && !isSelected ? "font-bold text-primary" : ""}
              `}
            >
              {date.getDate()}
              {hasTasks && !isSelected && (
                <span className={`absolute bottom-0.5 size-1 rounded-full ${isExam ? "bg-purple-300" : "bg-primary/40"}`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ProgressWidget({
  schedule, config, completedTasks,
}: {
  schedule: ScheduleTask[];
  config: StudyConfig | null;
  completedTasks: Record<string, string>;
}) {
  const taskSchedule = schedule.filter(t => t.task_type === "task");
  const totalTasks = taskSchedule.length;
  const completedCount = taskSchedule.filter(t => !!completedTasks[t.task_id]).length;
  const overallPct = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
  const phases = config?.phases || [];

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-foreground">Progress</div>
      <div>
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-bold tabular-nums text-foreground">{overallPct}%</span>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {completedCount}/{totalTasks}
          </span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${overallPct}%` }}
          />
        </div>
      </div>

      {phases.map((phase, i) => {
        const phaseTasks = taskSchedule.filter(t => t.date >= phase.start_date && t.date <= phase.end_date);
        const done = phaseTasks.filter(t => completedTasks[t.task_id]).length;
        const pct = phaseTasks.length > 0 ? Math.round((done / phaseTasks.length) * 100) : 0;
        const palette = PHASE_PALETTE[i % PHASE_PALETTE.length];

        return (
          <div key={phase.name}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-foreground">{phase.name}</span>
              <span className="text-[10px] font-medium tabular-nums" style={{ color: palette.accent }}>
                {pct}%
              </span>
            </div>
            <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: palette.accent }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface StudyScheduleSidebarProps {
  currentDate: string;
  schedule: ScheduleTask[];
  config: StudyConfig | null;
  completedTasks: Record<string, string>;
  onSelectDate: (date: string) => void;
}

export function StudyScheduleSidebar({
  currentDate, schedule, config, completedTasks, onSelectDate,
}: StudyScheduleSidebarProps) {
  return (
    <div className="hidden xl:block w-56 shrink-0 space-y-5">
      <div className="rounded-xl border border-border bg-card p-4">
        <MiniCalendar
          currentDate={currentDate}
          schedule={schedule}
          config={config}
          completedTasks={completedTasks}
          onSelectDate={onSelectDate}
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <ProgressWidget
          schedule={schedule}
          config={config}
          completedTasks={completedTasks}
        />
      </div>
    </div>
  );
}
