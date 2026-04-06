"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight, GraduationCap, CloudSun, Bird, Flower, Rabbit } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { ScheduleTask, StudyConfig, StudyResource } from "../lib/types";
import { useSwipe } from "../hooks/use-swipe";

interface CalendarViewProps {
  calendarMonth: Date;
  setCalendarMonth: (d: Date) => void;
  schedule: ScheduleTask[];
  config: StudyConfig | null;
  resources: StudyResource[];
  completedTasks: Record<string, string>;
  colorMap: Record<string, { bg: string; text: string }>;
  onSelectDate: (date: string) => void;
}

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarView({
  calendarMonth, setCalendarMonth, schedule, config, resources,
  completedTasks, colorMap, onSelectDate,
}: CalendarViewProps) {
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const today = new Date().toISOString().split("T")[0];
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

  const shortNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    resources.forEach(r => { map[r.name] = r.short_name || r.name; });
    return map;
  }, [resources]);

  const examDateSet = useMemo(() => new Set((config?.exam_dates || []).map(e => e.date)), [config]);

  const getTasksForDate = (date: string) => schedule.filter((t) => t.date === date);

  const isPreExamDay = (dateStr: string): boolean => {
    const d = new Date(dateStr + "T12:00:00");
    d.setDate(d.getDate() + 1);
    return examDateSet.has(d.toISOString().split("T")[0]);
  };

  const navMonth = (offset: number) => {
    const m = new Date(calendarMonth);
    m.setMonth(m.getMonth() + offset);
    setCalendarMonth(m);
  };

  const swipeHandlers = useSwipe(
    () => navMonth(1),
    () => navMonth(-1),
  );

  const fmtTime = (min: number) => {
    if (min === 0) return "0s";
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h${m}m`;
  };

  return (
    <div {...swipeHandlers}>
      <div data-tutorial="calendar-nav" className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="icon" className="size-8" onClick={() => navMonth(-1)}>
          <ChevronLeft size={16} />
        </Button>
        <h2 className="text-lg font-semibold text-foreground">
          {calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </h2>
        <Button variant="ghost" size="icon" className="size-8" onClick={() => navMonth(1)}>
          <ChevronRight size={16} />
        </Button>
      </div>

      <div data-tutorial="calendar-grid" className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="grid grid-cols-7 border-b border-border bg-muted/30">
          {DAY_HEADERS.map((day) => (
            <div key={day} className="py-2.5 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((date, idx) => {
            const dateStr = date.toISOString().split("T")[0];
            const dayTasks = getTasksForDate(dateStr);
            const isToday = dateStr === today;
            const isOtherMonth = date.getMonth() !== month;
            const dow = date.getDay();
            const isWeekend = dow === 0 || dow === 6;
            const exam = config?.exam_dates?.find((e) => e.date === dateStr);
            const dayOffStatus = config?.days_off?.[dateStr];
            const isRest = dayTasks.some((t) => t.task_type === "rest");
            const preExam = isRest && isPreExamDay(dateStr);

            const taskItems = dayTasks.filter(t => t.task_type === "task");
            const totalMin = taskItems.reduce((s, t) => s + t.minutes, 0);
            const resourceNames = [...new Set(taskItems.map(t => t.resource_name))];
            const isDayComplete = taskItems.length > 0 && taskItems.every(t => !!completedTasks[t.task_id]);

            const maxPills = 3;
            const visibleResources = resourceNames.slice(0, maxPills);
            const overflowResources = resourceNames.slice(maxPills);

            let cellBg = isWeekend ? "bg-muted/20" : "";
            if (isOtherMonth) cellBg += " opacity-30";
            if (exam) cellBg = "bg-purple-50/80 dark:bg-purple-950/20";
            else if (preExam) cellBg = "bg-blue-50/70 dark:bg-blue-950/15";
            else if (isRest && !preExam) cellBg = "bg-green-50/60 dark:bg-green-950/15";
            else if (dayOffStatus === "full") cellBg = "bg-red-50/50 dark:bg-red-950/15";
            else if (dayOffStatus === "half") cellBg = "bg-amber-50/80 dark:bg-amber-950/15";

            const isSpecialDay = !!exam || preExam || (isRest && !preExam) || dayOffStatus === "full" || dayOffStatus === "half";
            const hasResourcePills = visibleResources.length > 0;

            return (
              <button
                key={idx}
                onClick={() => onSelectDate(dateStr)}
                className={`flex min-h-[56px] flex-col border-b border-r border-border/50 p-1 text-left transition-colors hover:bg-muted/40 lg:min-h-[100px] lg:p-2 ${cellBg}`}
              >
                <div className="flex w-full items-start justify-between">
                  <span className={`text-xs font-medium ${
                    isToday
                      ? "flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
                      : "text-foreground"
                  }`}>
                    {date.getDate()}
                  </span>
                  {totalMin > 0 && (
                    <span className="hidden text-[10px] tabular-nums text-muted-foreground lg:inline">{fmtTime(totalMin)}</span>
                  )}
                </div>

                {isSpecialDay && !hasResourcePills && (
                  <div className="flex flex-1 items-center justify-center">
                    {exam && (
                      <div className="flex flex-col items-center gap-0.5">
                        <GraduationCap size={14} className="text-purple-600 lg:size-4" />
                        <span className="hidden text-center text-[10px] font-bold leading-tight text-purple-600 lg:block">{exam.name || "Exam"}</span>
                      </div>
                    )}
                    {preExam && !exam && (
                      <div className="flex flex-col items-center gap-0.5">
                        <Flower size={14} className="text-blue-500 lg:size-4" />
                        <span className="hidden text-center text-[10px] font-bold leading-tight text-blue-500 lg:block">Rest, review, relax</span>
                      </div>
                    )}
                    {isRest && !preExam && !exam && (
                      <div className="flex flex-col items-center gap-0.5">
                        <Rabbit size={14} className="text-green-600 lg:size-4" />
                        <span className="hidden text-center text-[10px] font-bold leading-tight text-green-600 lg:block">Catch up day</span>
                      </div>
                    )}
                    {dayOffStatus === "full" && !exam && !isRest && (
                      <div className="flex flex-col items-center gap-0.5">
                        <Bird size={14} className="text-red-400 lg:size-4" />
                        <span className="hidden text-center text-[10px] font-bold leading-tight text-red-400 lg:block">Enjoy your day off!</span>
                      </div>
                    )}
                    {dayOffStatus === "half" && !exam && !isRest && (
                      <div className="flex flex-col items-center gap-0.5">
                        <CloudSun size={14} className="text-amber-500 lg:size-4" />
                        <span className="hidden text-center text-[10px] font-bold leading-tight text-amber-500 lg:block">Half Day</span>
                      </div>
                    )}
                  </div>
                )}

                {resourceNames.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-0.5 lg:hidden">
                    {resourceNames.slice(0, 5).map((name) => {
                      const colors = colorMap[name] || { bg: "#e5e5e5", text: "#000" };
                      return (
                        <div
                          key={name}
                          className="size-2 rounded-full"
                          style={{ backgroundColor: isDayComplete ? "#34D399" : colors.bg }}
                        />
                      );
                    })}
                    {resourceNames.length > 5 && (
                      <span className="text-[8px] tabular-nums text-muted-foreground">+{resourceNames.length - 5}</span>
                    )}
                  </div>
                )}

                <div className="mt-0.5 hidden flex-col gap-px lg:flex">
                  {visibleResources.map((name) => {
                    const colors = colorMap[name] || { bg: "#e5e5e5", text: "#000" };
                    const pillBg = isDayComplete ? "#D1FAE5" : colors.bg;
                    const pillText = isDayComplete ? "#065F46" : colors.text;
                    const count = taskItems.filter(t => t.resource_name === name).length;
                    const shortName = shortNameMap[name] || name;
                    return (
                      <div
                        key={name}
                        className="flex items-center justify-between overflow-hidden rounded px-1 py-px text-[10px] leading-tight"
                        style={{ backgroundColor: pillBg, color: pillText }}
                      >
                        <span className="truncate">{shortName}</span>
                        {count > 1 && <span className="ml-1 shrink-0 font-medium">{count}</span>}
                      </div>
                    );
                  })}

                  {overflowResources.length === 1 && (() => {
                    const name = overflowResources[0];
                    const colors = colorMap[name] || { bg: "#e5e5e5", text: "#000" };
                    const pillBg = isDayComplete ? "#D1FAE5" : colors.bg;
                    const pillText = isDayComplete ? "#065F46" : colors.text;
                    const count = taskItems.filter(t => t.resource_name === name).length;
                    const shortName = shortNameMap[name] || name;
                    return (
                      <div
                        key={name}
                        className="flex items-center justify-between overflow-hidden rounded px-1 py-px text-[10px] leading-tight"
                        style={{ backgroundColor: pillBg, color: pillText }}
                      >
                        <span className="truncate">{shortName}</span>
                        {count > 1 && <span className="ml-1 shrink-0 font-medium">{count}</span>}
                      </div>
                    );
                  })()}

                  {overflowResources.length > 1 && (
                    <div className="mt-0.5 flex items-center">
                      <div className="flex -space-x-1.5">
                        {overflowResources.slice(0, 4).map((name, i) => {
                          const colors = colorMap[name] || { bg: "#e5e5e5", text: "#000" };
                          return (
                            <div
                              key={name}
                              className="size-4 rounded-full border border-card"
                              style={{ backgroundColor: isDayComplete ? "#34D399" : colors.bg, zIndex: overflowResources.length - i }}
                            />
                          );
                        })}
                      </div>
                      <span className="ml-1 text-[9px] tabular-nums text-muted-foreground">
                        +{overflowResources.length}
                      </span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div data-tutorial="calendar-legend" className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><GraduationCap size={10} className="text-purple-600" /> Exam</span>
        <span className="flex items-center gap-1"><Flower size={10} className="text-blue-500" /> Pre-Exam</span>
        <span className="flex items-center gap-1"><Rabbit size={10} className="text-green-600" /> Catch Up</span>
        <span className="flex items-center gap-1"><Bird size={10} className="text-red-400" /> Day Off</span>
        <span className="flex items-center gap-1"><CloudSun size={10} className="text-amber-500" /> Half Day</span>
        <span className="flex items-center gap-1">
          <span className="flex size-3 items-center justify-center rounded-full bg-primary text-[7px] text-primary-foreground">T</span> Today
        </span>
      </div>
    </div>
  );
}
