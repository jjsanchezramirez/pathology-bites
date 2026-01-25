// src/features/performance/components/interactive-chart-demos.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/shared/components/ui/card";

import { Skeleton } from "@/shared/components/ui/skeleton";
import { Button } from "@/shared/components/ui/button";
import { TrendingUp, Calendar, Target, ChevronLeft, ChevronRight } from "lucide-react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";

interface TimelineData {
  date: string;
  accuracy: number;
  quizzes: number;
}

interface HeatmapData {
  date: string;
  quizzes: number;
  questions: number;
}

interface HeatmapStats {
  avgQuestionsPerDay: number;
  avgQuizzesPerDay: string;
  longestStreak: number;
  currentStreak: number;
  totalQuestions: number;
  totalQuizzes: number;
  daysWithActivity: number;
}

interface CategoryData {
  category_name: string;
  accuracy: number;
}

/**
 * Chart 1: Performance Timeline
 */
interface PerformanceTimelineChartProps {
  data?: TimelineData[];
  loading?: boolean;
}

export function PerformanceTimelineChart({
  data = [],
  loading = false,
}: PerformanceTimelineChartProps) {
  const [error] = useState<string | null>(null);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Performance Timeline
          </CardTitle>
          <CardDescription>Your accuracy over the last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Performance Timeline
          </CardTitle>
          <CardDescription>Your accuracy over the last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-destructive">
            Error loading timeline data: {error}
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
            <TrendingUp className="h-5 w-5" />
            Performance Timeline
          </CardTitle>
          <CardDescription>Your accuracy over the last 30 days</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <p className="text-muted-foreground text-center px-4">
            No quiz data available yet. Start taking quizzes to see your progress!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Performance Timeline
        </CardTitle>
        <CardDescription>Your accuracy over the last 30 days</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorAccuracy" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#3b82f6" opacity={0.1} />
            <XAxis
              dataKey="date"
              tickFormatter={(value) =>
                new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })
              }
              tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
            />
            <YAxis
              label={{
                value: "Accuracy (%)",
                angle: -90,
                position: "insideLeft",
                style: { fill: "hsl(var(--foreground))" },
              }}
              domain={[0, 100]}
              tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-popover border rounded-lg p-3 shadow-lg">
                      <p className="font-semibold">
                        {new Date(payload[0].payload.date).toLocaleDateString()}
                      </p>
                      <p className="text-sm" style={{ color: "#3b82f6" }}>
                        Accuracy: {payload[0].value?.toFixed(1)}%
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {payload[0].payload.quizzes} quiz
                        {payload[0].payload.quizzes !== 1 ? "zes" : ""}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="accuracy"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#colorAccuracy)"
              dot={{ fill: "#3b82f6", r: 4 }}
              activeDot={{ r: 6 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

/**
 * Chart 2: Category Radar Chart
 */
interface CategoryRadarChartProps {
  data?: CategoryData[];
  loading?: boolean;
}

export function CategoryRadarChart({ data = [], loading = false }: CategoryRadarChartProps) {
  const [error] = useState<string | null>(null);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Category Comparison
          </CardTitle>
          <CardDescription>Your performance across all categories</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Category Comparison
          </CardTitle>
          <CardDescription>Your performance across all categories</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center text-destructive">
            Error loading category data: {error}
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
            <Target className="h-5 w-5" />
            Category Comparison
          </CardTitle>
          <CardDescription>Your performance across all categories</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[300px]">
          <p className="text-muted-foreground text-center px-4">
            No category data available yet. Start taking quizzes to see your performance!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Category Comparison
        </CardTitle>
        <CardDescription>Your performance across all categories</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <RadarChart data={data}>
            <PolarGrid stroke="#3b82f6" opacity={0.2} />
            <PolarAngleAxis
              dataKey="category_name"
              tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "hsl(var(--foreground))" }}
            />
            <Radar
              name="Accuracy"
              dataKey="accuracy"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.4}
              strokeWidth={2}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-popover border rounded-lg p-3 shadow-lg">
                      <p className="font-semibold">{payload[0].payload.category_name}</p>
                      <p className="text-sm" style={{ color: "#3b82f6" }}>
                        Accuracy: {payload[0].value?.toFixed(1)}%
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

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
    if (questions <= 5) return "bg-green-300 dark:bg-green-700";
    if (questions <= 10) return "bg-green-400 dark:bg-green-600";
    if (questions <= 20) return "bg-green-500 dark:bg-green-500";
    if (questions <= 30) return "bg-green-600 dark:bg-green-400";
    return "bg-green-700 dark:bg-green-300";
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

  // Calculate month labels based on weeks
  const monthLabels: Array<{ month: string; weekIndex: number }> = [];
  let lastMonth = "";

  weeks.forEach((week, weekIndex) => {
    // Use the Sunday (first day) of the week to determine the month
    const weekStartDate = new Date(week[0].date);
    const monthName = weekStartDate.toLocaleDateString("en-US", { month: "short" });

    if (monthName !== lastMonth) {
      monthLabels.push({ month: monthName, weekIndex });
      lastMonth = monthName;
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

  console.log("[ActivityHeatmap] Rendering:", {
    totalWeeks: weeks.length,
    totalDays: allDays.length,
    monthsToShow,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    daysWithActivity: allDays.filter((d) => d.questions > 0).length,
    monthLabels: monthLabels.map((m) => `${m.month} (week ${m.weekIndex})`),
  });

  return (
    <Card ref={containerRef}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Activity Calendar
            </CardTitle>
            <CardDescription>{getPeriodDescription()}</CardDescription>
          </div>
          <div className="flex items-center gap-1">
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
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Statistics - Only show if there's activity */}
          {stats &&
            (stats.avgQuestionsPerDay > 0 ||
              stats.longestStreak > 0 ||
              stats.currentStreak > 0) && (
              <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-sm border-b pb-4">
                <div className="text-center">
                  <div className="font-semibold text-green-600 dark:text-green-400">
                    {stats.avgQuestionsPerDay}
                  </div>
                  <div className="text-xs text-muted-foreground">Avg/day</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-blue-600 dark:text-blue-400">
                    {stats.avgQuizzesPerDay}
                  </div>
                  <div className="text-xs text-muted-foreground">Quizzes/day</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-orange-600 dark:text-orange-400">
                    {stats.longestStreak}
                  </div>
                  <div className="text-xs text-muted-foreground">Longest</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-purple-600 dark:text-purple-400">
                    {stats.currentStreak}
                  </div>
                  <div className="text-xs text-muted-foreground">Current</div>
                </div>
              </div>
            )}

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

                  return (
                    <div
                      key={index}
                      style={{ gridColumn: `${label.weekIndex + 1} / span ${span}` }}
                    >
                      {label.month}
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
                        className={`rounded-sm ${getColor(day.questions)} ${hasActivity ? "cursor-pointer hover:ring-2 hover:ring-primary" : "cursor-default"} transition-all min-w-[10px] min-h-[10px]`}
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
