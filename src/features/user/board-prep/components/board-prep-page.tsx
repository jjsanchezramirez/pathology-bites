"use client";

import { useState } from "react";
import { ListTodo, Calendar, BarChart3, AlertCircle } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { SpotlightTour, type TutorialStep } from "@/shared/components/tutorial/tutorial-dialog";
import { useTutorial } from "@/shared/hooks/use-tutorial";
import { useStudyPlan } from "../hooks/use-study-plan";
import { DayView } from "./day-view";
import { CalendarView } from "./calendar-view";
import { ProgressView } from "./progress-view";
import { SetupSheet } from "./setup-sheet";
import { StudyScheduleSidebar } from "./sidebar";

const SCHEDULE_TUTORIAL: TutorialStep[] = [
  {
    target: "view-tabs",
    title: "Switch Between Views",
    description:
      "Use these tabs to switch between your daily schedule, a monthly calendar overview, and your overall progress.",
    side: "bottom",
  },
  {
    target: "settings-button",
    title: "Configure Your Plan",
    description:
      "Open settings to add your exam dates, create study phases, set daily hours, and manage your study resources.",
    side: "bottom",
  },
  {
    target: "week-strip",
    title: "Navigate Your Week",
    description:
      "Browse days by tapping the date strip. Swipe left/right on mobile or use the arrows to change weeks. Dots show which days have tasks.",
    side: "bottom",
  },
  {
    target: "task-list",
    title: "Your Daily Tasks",
    description:
      "Tasks are organized by resource. Tap a task to mark it complete. Falling behind? Use Rebalance in settings to redistribute remaining work.",
    side: "top",
  },
];


export function BoardPrepPage() {
  const [view, setView] = useState<"day" | "calendar" | "progress">("day");
  const [currentDate, setCurrentDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [calendarMonth, setCalendarMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );

  const {
    loading, error, retry,
    resources, setResources,
    config, setConfig,
    schedule, setSchedule,
    completedTasks, setCompletedTasks,
    colorMap, toggleTask,
  } = useStudyPlan();

  const { showTutorial: showScheduleTutorial, completeTutorial: completeScheduleTutorial } = useTutorial("study-schedule");

  const navItems = [
    { key: "day" as const, icon: ListTodo, label: "Schedule" },
    { key: "calendar" as const, icon: Calendar, label: "Calendar" },
    { key: "progress" as const, icon: BarChart3, label: "Progress" },
  ];

  if (loading) {
    return (
      <div>
        <div className="mb-6 flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="size-8 rounded-full" />
        </div>
        <div className="mb-6">
          <div className="mb-3 flex justify-center"><Skeleton className="h-4 w-32" /></div>
          <div className="grid grid-cols-7 gap-1 md:gap-2">
            {Array.from({ length: 7 }).map((_, i) => (<Skeleton key={i} className="h-14 rounded-xl" />))}
          </div>
        </div>
        <Skeleton className="mb-6 h-1.5 w-full rounded-full" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (<Skeleton key={i} className="h-16 w-full rounded-2xl" />))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <AlertCircle size={32} className="text-destructive" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button size="sm" onClick={retry}>Retry</Button>
      </div>
    );
  }

  const handleSidebarDateSelect = (date: string) => {
    setCurrentDate(date);
    setView("day");
  };

  return (
    <div>
      <SpotlightTour
        open={showScheduleTutorial && view === "day"}
        onComplete={completeScheduleTutorial}
        steps={SCHEDULE_TUTORIAL}
      />

      {/* Header bar with view tabs + settings */}
      <div className="mb-6 flex items-center justify-between">
        <div data-tutorial="view-tabs" className="flex items-center gap-1">
          {navItems.map(({ key, icon: Icon, label }) => (
            <Button
              key={key}
              variant={view === key ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView(key)}
              className="gap-1.5"
            >
              <Icon size={16} />
              <span className="hidden sm:inline text-xs">{label}</span>
            </Button>
          ))}
        </div>

        <div data-tutorial="settings-button">
          <SetupSheet
            resources={resources}
            setResources={setResources}
            config={config}
            setConfig={setConfig}
            schedule={schedule}
            setSchedule={setSchedule}
            completedTasks={completedTasks}
            setCompletedTasks={setCompletedTasks}
            currentDate={currentDate}
          />
        </div>
      </div>

      {/* Two-column layout: main content + sidebar on xl */}
      <div className="flex gap-6">
        <div className="min-w-0 flex-1">
          {view === "day" && (
            <DayView
              currentDate={currentDate}
              setCurrentDate={setCurrentDate}
              schedule={schedule}
              config={config}
              resources={resources}
              completedTasks={completedTasks}
              colorMap={colorMap}
              onToggleTask={toggleTask}
            />
          )}
          {view === "calendar" && (
            <CalendarView
              calendarMonth={calendarMonth}
              setCalendarMonth={setCalendarMonth}
              schedule={schedule}
              config={config}
              resources={resources}
              completedTasks={completedTasks}
              colorMap={colorMap}
              onSelectDate={(date) => { setCurrentDate(date); setView("day"); }}
            />
          )}
          {view === "progress" && (
            <ProgressView
              schedule={schedule}
              config={config}
              completedTasks={completedTasks}
              colorMap={colorMap}
            />
          )}
        </div>

        {/* Right sidebar: mini calendar + progress (xl screens only) */}
        <StudyScheduleSidebar
          currentDate={currentDate}
          schedule={schedule}
          config={config}
          completedTasks={completedTasks}
          onSelectDate={handleSidebarDateSelect}
        />
      </div>
    </div>
  );
}
