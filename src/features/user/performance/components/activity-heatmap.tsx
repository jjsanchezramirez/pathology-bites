"use client";

import { useEffect, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Button } from "@/shared/components/ui/button";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { type HeatmapData, type HeatmapStats } from "./chart-utils";

/**
 * Chart 3: Activity Heatmap - Anki-style with months
 */
interface ActivityHeatmapProps {
  data?: HeatmapData[];
  stats?: HeatmapStats | null;
  loading?: boolean;
}

export function ActivityHeatmap({
  data = [],
  stats = null,
  loading = false,
}: ActivityHeatmapProps) {
  const [error] = useState<string | null>(null);
  const [monthsToShow, setMonthsToShow] = useState(12);
  const [currentPeriodStart, setCurrentPeriodStart] = useState(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  });
  const containerRef = useRef<HTMLDivElement>(null);

  // Determine how many months to show based on container width
  useEffect(() => {
    const updateMonthsToShow = () => {
      if (!containerRef.current) return;

      const containerWidth = containerRef.current.offsetWidth;

      // Each week needs minimum ~15px to be readable (10px cell + gaps + padding)
      // Account for day labels (~24px) and card padding (~32px)
      const availableWidth = containerWidth - 56;

      // Calculate how many weeks we can comfortably fit
      const weeksPerMonth = 4.33; // Average weeks per month
      const minWidthPerWeek = 15;
      const maxWeeks = Math.floor(availableWidth / minWidthPerWeek);

      // Determine months: 12, 6, 4, or 3
      let months;
      if (maxWeeks >= weeksPerMonth * 12)
        months = 12; // ~52 weeks
      else if (maxWeeks >= weeksPerMonth * 6)
        months = 6; // ~26 weeks
      else if (maxWeeks >= weeksPerMonth * 4)
        months = 4; // ~17 weeks
      else months = 3; // ~13 weeks minimum

      setMonthsToShow(months);
    };

    // Use ResizeObserver for better performance
    const resizeObserver = new ResizeObserver(() => {
      updateMonthsToShow();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
      updateMonthsToShow();
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const getColor = (questions: number) => {
    if (questions === 0) return "bg-muted/50 dark:bg-muted/30";
    if (questions <= 5) return "bg-primary/30";
    if (questions <= 10) return "bg-primary/50";
    if (questions <= 20) return "bg-primary/70";
    if (questions <= 30) return "bg-primary/90";
    return "bg-primary";
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Activity Calendar
          </CardTitle>
          <CardDescription>Your quiz activity for {new Date().getFullYear()}</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Activity Calendar
          </CardTitle>
          <CardDescription>Your quiz activity for {new Date().getFullYear()}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-destructive">
            Error loading activity data: {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Activity Calendar
          </CardTitle>
          <CardDescription>Your quiz activity for {new Date().getFullYear()}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            No activity data available yet.
          </div>
        </CardContent>
      </Card>
    );
  }

  // Create a map for quick lookup
  const dataMap = new Map(data.map((d) => [d.date, d]));

  // Calculate start and end dates based on current period and months to show
  const periodEnd = new Date(currentPeriodStart);
  periodEnd.setHours(0, 0, 0, 0);

  const periodStart = new Date(periodEnd);
  periodStart.setMonth(periodStart.getMonth() - monthsToShow + 1);
  periodStart.setDate(1); // First day of start month

  // Find the first Sunday on or before the period start
  const startDate = new Date(periodStart);
  const dayOfWeek = startDate.getDay();
  startDate.setDate(startDate.getDate() - dayOfWeek);

  // End on the last day of the end month
  const endDate = new Date(periodEnd.getFullYear(), periodEnd.getMonth() + 1, 0);

  // Build all days from start to end
  const allDays: HeatmapData[] = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split("T")[0];
    const dayData = dataMap.get(dateStr) || { date: dateStr, quizzes: 0, questions: 0 };
    allDays.push(dayData);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Group into weeks (Sunday to Saturday)
  const weeks: HeatmapData[][] = [];
  for (let i = 0; i < allDays.length; i += 7) {
    const week = allDays.slice(i, i + 7);
    if (week.length === 7) {
      weeks.push(week);
    }
  }

  // Calculate month labels based on weeks. The label stores the month, the
  // year, and whether to show the year — the renderer appends "'YY" to the
  // first label and to every January, so the year boundary is visible inside
  // the heatmap (not just in the title).
  const monthLabels: Array<{
    month: string;
    year: number;
    weekIndex: number;
    showYear: boolean;
  }> = [];
  let lastMonth = "";
  let lastYear = -1;

  weeks.forEach((week, weekIndex) => {
    const weekStartDate = new Date(week[0].date);
    const monthName = weekStartDate.toLocaleDateString("en-US", { month: "short" });
    const year = weekStartDate.getFullYear();

    if (monthName !== lastMonth) {
      const yearChanged = year !== lastYear;
      monthLabels.push({
        month: monthName,
        year,
        weekIndex,
        // First label always gets a year tag, plus every January (year change).
        showYear: lastMonth === "" || yearChanged,
      });
      lastMonth = monthName;
      lastYear = year;
    }
  });

  // Navigation handlers
  const goToPreviousPeriod = () => {
    const newStart = new Date(currentPeriodStart);
    newStart.setMonth(newStart.getMonth() - monthsToShow);
    setCurrentPeriodStart(newStart);
  };

  const goToNextPeriod = () => {
    const newStart = new Date(currentPeriodStart);
    newStart.setMonth(newStart.getMonth() + monthsToShow);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    // Don't go beyond current month
    if (newStart <= now) {
      setCurrentPeriodStart(newStart);
    }
  };

  const goToToday = () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    setCurrentPeriodStart(now);
  };

  // Check if we can navigate forward
  const canGoForward = () => {
    const newStart = new Date(currentPeriodStart);
    newStart.setMonth(newStart.getMonth() + monthsToShow);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return newStart <= now;
  };

  // Format period description
  const getPeriodDescription = () => {
    const startMonth = periodStart.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    const endMonth = periodEnd.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    return startMonth === endMonth ? startMonth : `${startMonth} - ${endMonth}`;
  };

  const showStats =
    stats && (stats.avgQuestionsPerDay > 0 || stats.longestStreak > 0 || stats.currentStreak > 0);

  // Compact inline stats — Avg/day · Quizzes/day · Longest · Current. Pulled
  // into the header so the dedicated stats row (which used ~70px between the
  // header and the heatmap grid) goes away.
  const statsInline = showStats ? (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span>
        <span className="font-semibold text-primary">{stats!.avgQuestionsPerDay}</span>
        <span className="text-muted-foreground"> avg/day</span>
      </span>
      <span className="text-muted-foreground">·</span>
      <span>
        <span className="font-semibold text-primary">{stats!.avgQuizzesPerDay}</span>
        <span className="text-muted-foreground"> quizzes/day</span>
      </span>
      <span className="text-muted-foreground">·</span>
      <span>
        <span className="font-semibold text-primary">{stats!.longestStreak}</span>
        <span className="text-muted-foreground"> longest</span>
      </span>
      <span className="text-muted-foreground">·</span>
      <span>
        <span className="font-semibold text-primary">{stats!.currentStreak}</span>
        <span className="text-muted-foreground"> current</span>
      </span>
    </div>
  ) : null;

  return (
    <Card ref={containerRef}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Activity Calendar
            </CardTitle>
            <CardDescription>{getPeriodDescription()}</CardDescription>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPreviousPeriod}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              disabled={
                currentPeriodStart.getMonth() === new Date().getMonth() &&
                currentPeriodStart.getFullYear() === new Date().getFullYear()
              }
              className="h-8 px-2 text-xs"
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextPeriod}
              disabled={!canGoForward()}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {statsInline}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* CSS Grid based calendar */}
          <div className="w-full overflow-x-auto">
            <div className="min-w-0">
              {/* Month labels with CSS Grid */}
              <div
                className="grid mb-2 text-[10px] sm:text-xs text-muted-foreground font-medium pl-6"
                style={{
                  gridTemplateColumns: `repeat(${weeks.length}, minmax(10px, 1fr))`,
                  gap: "2px",
                }}
              >
                {monthLabels.map((label, index) => {
                  const nextLabelIndex = monthLabels[index + 1]?.weekIndex || weeks.length;
                  const span = nextLabelIndex - label.weekIndex;

                  // Only show month label if it spans 3 or more weeks
                  if (span < 3) return null;

                  const yearSuffix = `'${String(label.year).slice(-2)}`;

                  return (
                    <div
                      key={index}
                      style={{ gridColumn: `${label.weekIndex + 1} / span ${span}` }}
                    >
                      {label.showYear ? (
                        <>
                          {label.month}{" "}
                          <span className="text-foreground/80 font-semibold">{yearSuffix}</span>
                        </>
                      ) : (
                        label.month
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Calendar Grid */}
              <div className="flex gap-2">
                {/* Day labels */}
                <div className="flex flex-col justify-between py-0.5">
                  {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                    <div key={index} className="h-[10px] flex items-center">
                      <span className="text-[9px] sm:text-[10px] text-muted-foreground w-3 text-right">
                        {day}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Activity grid - CSS Grid for automatic responsiveness */}
                <div
                  className="grid flex-1 gap-[2px]"
                  style={{
                    gridTemplateColumns: `repeat(${weeks.length}, minmax(10px, 1fr))`,
                    gridTemplateRows: "repeat(7, 10px)",
                    gridAutoFlow: "column",
                  }}
                >
                  {allDays.map((day, index) => {
                    const hasActivity = day.questions > 0;
                    return (
                      <div
                        key={index}
                        className={`rounded-sm ${getColor(day.questions)} ${hasActivity ? "cursor-pointer hover:ring-2 hover:ring-primary/80" : "cursor-default"} transition-all min-w-[10px] min-h-[10px]`}
                        title={`${new Date(day.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}\n${day.questions} question${day.questions !== 1 ? "s" : ""}\n${day.quizzes} quiz${day.quizzes !== 1 ? "zes" : ""}`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
