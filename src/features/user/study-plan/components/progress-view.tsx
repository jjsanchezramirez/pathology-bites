"use client";

import { ScheduleTask, StudyConfig } from "../lib/types";
import { PHASE_PALETTE } from "../lib/color-utils";

interface ProgressViewProps {
  schedule: ScheduleTask[];
  config: StudyConfig | null;
  completedTasks: Record<string, string>;
  colorMap: Record<string, { bg: string; text: string }>;
}

export function ProgressView({ schedule, config, completedTasks, colorMap }: ProgressViewProps) {
  const taskSchedule = schedule.filter((t) => t.task_type === "task");
  const totalTasks = taskSchedule.length;
  const completedCount = taskSchedule.filter((t) => !!completedTasks[t.task_id]).length;
  const totalMinutes = taskSchedule.reduce((sum, t) => sum + t.minutes, 0);
  const completedMinutes = taskSchedule
    .filter((t) => !!completedTasks[t.task_id])
    .reduce((sum, t) => sum + t.minutes, 0);
  const overallPct = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  const byPhase: {
    name: string;
    completed: number;
    total: number;
    phaseIdx: number;
    minutes: number;
    completedMin: number;
  }[] = [];
  config?.phases?.forEach((phase, i) => {
    const phaseTasks = taskSchedule.filter(
      (t) => t.date >= phase.start_date && t.date <= phase.end_date
    );
    const completed = phaseTasks.filter((t) => completedTasks[t.task_id]);
    byPhase.push({
      name: phase.name,
      completed: completed.length,
      total: phaseTasks.length,
      phaseIdx: i,
      minutes: phaseTasks.reduce((s, t) => s + t.minutes, 0),
      completedMin: completed.reduce((s, t) => s + t.minutes, 0),
    });
  });

  const byResource: Record<
    string,
    { completed: number; total: number; minutes: number; completedMin: number }
  > = {};
  taskSchedule.forEach((task) => {
    if (!byResource[task.resource_name]) {
      byResource[task.resource_name] = { completed: 0, total: 0, minutes: 0, completedMin: 0 };
    }
    byResource[task.resource_name].total++;
    byResource[task.resource_name].minutes += task.minutes;
    if (completedTasks[task.task_id]) {
      byResource[task.resource_name].completed++;
      byResource[task.resource_name].completedMin += task.minutes;
    }
  });

  const fmtHours = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5 lg:p-6">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-3xl font-bold tabular-nums text-foreground">{overallPct}%</div>
            <div className="mt-0.5 text-sm text-muted-foreground">Overall Progress</div>
          </div>
          <div className="text-right text-xs tabular-nums text-muted-foreground">
            <div>
              {completedCount} of {totalTasks} tasks
            </div>
            <div>
              {fmtHours(completedMinutes)} / {fmtHours(totalMinutes)}
            </div>
          </div>
        </div>
        <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${overallPct}%` }}
          />
        </div>
      </div>

      {byPhase.length > 0 && (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Phases
          </h3>
          <div
            className={`grid gap-3 ${
              byPhase.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            }`}
          >
            {byPhase.map((p) => {
              const palette = PHASE_PALETTE[p.phaseIdx % PHASE_PALETTE.length];
              const pct = p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0;
              return (
                <div key={p.name} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-medium text-foreground">{p.name}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {p.completed}/{p.total} tasks
                      </div>
                    </div>
                    <div
                      className="text-xl font-bold tabular-nums"
                      style={{ color: palette.accent }}
                    >
                      {pct}%
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: palette.accent }}
                    />
                  </div>
                  <div className="mt-1.5 text-[10px] tabular-nums text-muted-foreground">
                    {fmtHours(p.completedMin)} / {fmtHours(p.minutes)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {Object.keys(byResource).length > 0 && (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Resources
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(byResource).map(([resName, stats]) => {
              const colors = colorMap[resName] || { bg: "#e5e5e5", text: "#000000" };
              const pct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
              return (
                <div
                  key={resName}
                  className="overflow-hidden rounded-2xl border border-border bg-card p-4"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="size-4 shrink-0 rounded-md"
                      style={{ backgroundColor: colors.bg }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate text-sm font-medium text-foreground">
                          {resName}
                        </span>
                        <span className="ml-2 shrink-0 text-sm font-semibold tabular-nums text-foreground">
                          {pct}%
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: colors.bg }}
                        />
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-[11px] tabular-nums text-muted-foreground">
                        <span>
                          {stats.completed}/{stats.total} tasks
                        </span>
                        <span>
                          {fmtHours(stats.completedMin)} / {fmtHours(stats.minutes)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
