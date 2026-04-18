"use client";

import { useMemo, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { TaskCard } from "./task-card";
import { ScheduleTask, StudyConfig, StudyResource } from "../lib/types";
import { useSwipe } from "../hooks/use-swipe";

interface DayViewProps {
  currentDate: string;
  setCurrentDate: (date: string) => void;
  schedule: ScheduleTask[];
  config: StudyConfig | null;
  resources: StudyResource[];
  completedTasks: Record<string, string>;
  colorMap: Record<string, { bg: string; text: string }>;
  onToggleTask: (taskId: string) => void;
}

function getWeekStart(dateStr: string): Date {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function fmtTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function DayView({
  currentDate,
  setCurrentDate,
  schedule,
  config,
  resources,
  completedTasks,
  colorMap,
  onToggleTask,
}: DayViewProps) {
  const today = new Date().toISOString().split("T")[0];
  const stripRef = useRef<HTMLDivElement>(null);

  const shortNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    (resources || []).forEach((r) => {
      map[r.name] = r.short_name || r.name;
    });
    return map;
  }, [resources]);

  const weekStart = useMemo(() => getWeekStart(currentDate), [currentDate]);
  const days = useMemo(() => {
    const result: string[] = [];
    const d = new Date(weekStart);
    for (let i = 0; i < 7; i++) {
      result.push(d.toISOString().split("T")[0]);
      d.setDate(d.getDate() + 1);
    }
    return result;
  }, [weekStart]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, ScheduleTask[]>();
    for (const d of days) map.set(d, []);
    for (const t of schedule) {
      if (map.has(t.date)) map.get(t.date)!.push(t);
    }
    return map;
  }, [schedule, days]);

  const dayTasks = useMemo(() => tasksByDate.get(currentDate) || [], [tasksByDate, currentDate]);
  const studyTasks = dayTasks.filter((t) => t.task_type === "task");
  const completedCount = studyTasks.filter((t) => !!completedTasks[t.task_id]).length;
  const totalMin = studyTasks.reduce((s, t) => s + t.minutes, 0);
  const remainingMin = studyTasks
    .filter((t) => !completedTasks[t.task_id])
    .reduce((s, t) => s + t.minutes, 0);

  const navigateWeek = useCallback(
    (offset: number) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + offset * 7);
      setCurrentDate(d.toISOString().split("T")[0]);
    },
    [weekStart, setCurrentDate]
  );

  const navigateDay = useCallback(
    (offset: number) => {
      const d = new Date(currentDate + "T12:00:00");
      d.setDate(d.getDate() + offset);
      setCurrentDate(d.toISOString().split("T")[0]);
    },
    [currentDate, setCurrentDate]
  );

  const swipeHandlers = useSwipe(
    () => navigateDay(1),
    () => navigateDay(-1)
  );

  const monthLabel = new Date(currentDate + "T12:00:00").toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const selectedDateObj = new Date(currentDate + "T12:00:00");
  const isToday = currentDate === today;
  const dayTitle = isToday
    ? "Today"
    : selectedDateObj.toLocaleDateString("en-US", { weekday: "long" });
  const daySubtitle = selectedDateObj.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });

  const tasksByResource = useMemo(() => {
    const groups: { resource: string; tasks: ScheduleTask[] }[] = [];
    const seen = new Set<string>();
    for (const task of dayTasks) {
      if (task.task_type !== "task") continue;
      if (!seen.has(task.resource_name)) {
        seen.add(task.resource_name);
        groups.push({ resource: task.resource_name, tasks: [] });
      }
      groups.find((g) => g.resource === task.resource_name)!.tasks.push(task);
    }
    return groups;
  }, [dayTasks]);

  const specialTasks = dayTasks.filter((t) => t.task_type !== "task");

  const examDateSet = useMemo(
    () => new Set((config?.exam_dates || []).map((e) => e.date)),
    [config]
  );
  const isPreExamDay = useMemo(() => {
    const d = new Date(currentDate + "T12:00:00");
    d.setDate(d.getDate() + 1);
    return examDateSet.has(d.toISOString().split("T")[0]);
  }, [currentDate, examDateSet]);

  return (
    <div {...swipeHandlers}>
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <Button variant="ghost" size="icon" className="size-8" onClick={() => navigateWeek(-1)}>
            <ChevronLeft size={16} />
          </Button>
          <button
            onClick={() => setCurrentDate(today)}
            className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
          >
            {monthLabel}
          </button>
          <Button variant="ghost" size="icon" className="size-8" onClick={() => navigateWeek(1)}>
            <ChevronRight size={16} />
          </Button>
        </div>

        <div ref={stripRef} data-tutorial="week-strip" className="grid grid-cols-7 gap-1 md:gap-2">
          {days.map((dateStr) => {
            const dateObj = new Date(dateStr + "T12:00:00");
            const isSelected = dateStr === currentDate;
            const isDayToday = dateStr === today;
            const dt = tasksByDate.get(dateStr) || [];
            const hasTasks = dt.some((t) => t.task_type === "task");
            const allDone =
              hasTasks &&
              dt.filter((t) => t.task_type === "task").every((t) => !!completedTasks[t.task_id]);

            return (
              <button
                key={dateStr}
                onClick={() => setCurrentDate(dateStr)}
                className={`group relative flex flex-col items-center rounded-xl py-2 transition-all ${
                  isSelected ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted"
                }`}
              >
                <span
                  className={`text-[10px] font-medium uppercase ${
                    isSelected ? "text-primary-foreground/70" : "text-muted-foreground"
                  }`}
                >
                  {dateObj.toLocaleDateString("en-US", { weekday: "short" })}
                </span>
                <span
                  className={`mt-0.5 text-lg font-semibold tabular-nums ${
                    isSelected
                      ? "text-primary-foreground"
                      : isDayToday
                        ? "text-primary"
                        : "text-foreground"
                  }`}
                >
                  {dateObj.getDate()}
                </span>
                {hasTasks && !isSelected && (
                  <span
                    className={`mt-0.5 size-1.5 rounded-full ${
                      allDone ? "bg-emerald-300" : "bg-primary/40"
                    }`}
                  />
                )}
                {isSelected && hasTasks && (
                  <span className="mt-0.5 size-1.5 rounded-full bg-primary-foreground/50" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2
            className={`text-2xl font-bold tracking-tight ${isToday ? "text-primary" : "text-foreground"}`}
          >
            {dayTitle}
          </h2>
          <p className="text-sm text-muted-foreground">{daySubtitle}</p>
        </div>
        {studyTasks.length > 0 && (
          <div className="text-right">
            <div className="text-sm font-semibold tabular-nums text-foreground">
              {completedCount}/{studyTasks.length} done
            </div>
            <div className="text-xs text-muted-foreground">
              {remainingMin > 0 ? `${fmtTime(remainingMin)} left` : fmtTime(totalMin)}
            </div>
          </div>
        )}
      </div>

      {studyTasks.length > 0 && (
        <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${Math.round((completedCount / studyTasks.length) * 100)}%` }}
          />
        </div>
      )}

      {dayTasks.length === 0 ? (
        <div data-tutorial="task-list" className="rounded-2xl bg-muted/30 py-12 text-center">
          <p className="text-sm font-medium text-muted-foreground">No tasks scheduled</p>
          <p className="mt-1 text-xs text-muted-foreground/60">Enjoy your free day</p>
        </div>
      ) : (
        <div data-tutorial="task-list" className="space-y-2">
          {specialTasks.map((task, idx) => {
            const colors = colorMap[task.resource_name] || { bg: "#e5e5e5", text: "#000000" };
            return (
              <TaskCard
                key={task.task_id || `special-${idx}`}
                task={task}
                completed={!!completedTasks[task.task_id]}
                colorBg={colors.bg}
                colorText={colors.text}
                isPreExam={task.task_type === "rest" && isPreExamDay}
                onToggle={() => onToggleTask(task.task_id)}
              />
            );
          })}

          <div className="hidden lg:block space-y-4">
            {tasksByResource.map(({ resource, tasks }) => {
              const colors = colorMap[resource] || { bg: "#e5e5e5", text: "#000000" };
              return (
                <div key={resource}>
                  <div className="mb-2 flex items-center gap-2">
                    <div className="size-2.5 rounded-sm" style={{ backgroundColor: colors.bg }} />
                    <span className="text-xs font-medium text-muted-foreground">{resource}</span>
                    <span className="text-[10px] text-muted-foreground/50">
                      {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {tasks.map((task, idx) => (
                      <TaskCard
                        key={task.task_id || idx}
                        task={task}
                        completed={!!completedTasks[task.task_id]}
                        colorBg={colors.bg}
                        colorText={colors.text}
                        shortName={shortNameMap[task.resource_name]}
                        onToggle={() => onToggleTask(task.task_id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="lg:hidden space-y-2">
            {dayTasks
              .filter((t) => t.task_type === "task")
              .map((task, idx) => {
                const colors = colorMap[task.resource_name] || { bg: "#e5e5e5", text: "#000000" };
                return (
                  <TaskCard
                    key={task.task_id || idx}
                    task={task}
                    completed={!!completedTasks[task.task_id]}
                    colorBg={colors.bg}
                    colorText={colors.text}
                    shortName={shortNameMap[task.resource_name]}
                    onToggle={() => onToggleTask(task.task_id)}
                  />
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
