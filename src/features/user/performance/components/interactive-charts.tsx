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
import { cn } from "@/shared/utils";
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

// Resolve CSS variable to hex for SVG/Recharts compatibility
function resolveCssColor(varName: string): string | null {
  const el = document.createElement("div");
  el.style.color = `var(${varName})`;
  el.style.display = "none";
  document.body.appendChild(el);
  const computed = getComputedStyle(el).color;
  document.body.removeChild(el);

  const rgbMatch = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    const toHex = (n: string) => parseInt(n).toString(16).padStart(2, "0");
    return `#${toHex(rgbMatch[1])}${toHex(rgbMatch[2])}${toHex(rgbMatch[3])}`;
  }
  return null;
}

function useThemeColors() {
  const [colors, setColors] = useState({
    primary: "#2D9596",
    foreground: "#1a1a1a",
    mutedForeground: "#6b7280",
    muted: "#e5e7eb",
  });

  useEffect(() => {
    const update = () => {
      setColors({
        primary: resolveCssColor("--primary") || "#2D9596",
        foreground: resolveCssColor("--foreground") || "#1a1a1a",
        mutedForeground: resolveCssColor("--muted-foreground") || "#6b7280",
        muted: resolveCssColor("--muted") || "#e5e7eb",
      });
    };
    update();

    // Re-compute when theme changes (class toggle on <html>)
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return colors;
}

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
type TimelineRange = "1w" | "1m" | "3m" | "6m" | "1y" | "all";

interface TimelineRangeOption {
  value: TimelineRange;
  label: string; // short pill label
  longLabel: string; // used in the card description
  days: number | null; // null = all-time
  bucket: "day" | "week" | "month";
}

const TIMELINE_RANGES: TimelineRangeOption[] = [
  { value: "1w", label: "1W", longLabel: "Last week", days: 7, bucket: "day" },
  { value: "1m", label: "1M", longLabel: "Last month", days: 30, bucket: "day" },
  { value: "3m", label: "3M", longLabel: "Last 3 months", days: 90, bucket: "week" },
  { value: "6m", label: "6M", longLabel: "Last 6 months", days: 180, bucket: "week" },
  { value: "1y", label: "1Y", longLabel: "Last year", days: 365, bucket: "month" },
  { value: "all", label: "All", longLabel: "All time", days: null, bucket: "month" },
];

// ISO week number (Mon-Sun) — gives us a stable bucket key per calendar week.
function isoWeekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // Move to Thursday of this week (ISO week rule)
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

// Monday of the ISO week containing d — used as the X-axis date for weekly buckets.
function isoWeekStart(d: Date): Date {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = t.getDay() || 7;
  t.setDate(t.getDate() - (day - 1));
  return t;
}

function bucketTimeline(data: TimelineData[], bucket: "day" | "week" | "month"): TimelineData[] {
  if (bucket === "day") return data;

  // Weighted average accuracy across the bucket — weight each day by its quiz count
  // so high-volume days dominate. Mirrors what an "overall accuracy for the period"
  // calculation would produce, instead of treating a 1-quiz day as equal to a 10-quiz day.
  const buckets = new Map<string, { repDate: string; weightedSum: number; quizzes: number }>();

  data.forEach((d) => {
    const day = new Date(d.date);
    let key: string;
    let repDate: string;
    if (bucket === "week") {
      key = isoWeekKey(day);
      repDate = isoWeekStart(day).toISOString().split("T")[0];
    } else {
      // month
      key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}`;
      repDate = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-01`;
    }

    const existing = buckets.get(key);
    if (existing) {
      existing.weightedSum += d.accuracy * d.quizzes;
      existing.quizzes += d.quizzes;
    } else {
      buckets.set(key, {
        repDate,
        weightedSum: d.accuracy * d.quizzes,
        quizzes: d.quizzes,
      });
    }
  });

  return Array.from(buckets.values())
    .map((b) => ({
      date: b.repDate,
      accuracy: b.quizzes > 0 ? b.weightedSum / b.quizzes : 0,
      quizzes: b.quizzes,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

interface PerformanceTimelineChartProps {
  data?: TimelineData[];
  loading?: boolean;
}

export function PerformanceTimelineChart({
  data = [],
  loading = false,
}: PerformanceTimelineChartProps) {
  const [error] = useState<string | null>(null);
  const [range, setRange] = useState<TimelineRange>("1m");
  const { primary: primaryColor, mutedForeground: mutedFgColor } = useThemeColors();

  const rangeConfig = TIMELINE_RANGES.find((r) => r.value === range) ?? TIMELINE_RANGES[1];

  // Filter to the selected range first, then bucket. With auto-bucketing, the
  // X-axis stays readable at every range — a 1y view of 365 daily dots would be
  // a smear.
  const filteredData = (() => {
    if (rangeConfig.days === null) return data;
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - (rangeConfig.days - 1));
    const cutoffStr = cutoff.toISOString().split("T")[0];
    return data.filter((d) => d.date >= cutoffStr);
  })();

  const bucketedData = bucketTimeline(filteredData, rangeConfig.bucket);

  const formatAxisDate = (value: string) => {
    const d = new Date(value);
    if (rangeConfig.bucket === "month") {
      return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    }
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatTooltipDate = (value: string) => {
    const d = new Date(value);
    if (rangeConfig.bucket === "week") {
      const end = new Date(d);
      end.setDate(end.getDate() + 6);
      return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString(
        "en-US",
        { month: "short", day: "numeric", year: "numeric" }
      )}`;
    }
    if (rangeConfig.bucket === "month") {
      return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }
    return d.toLocaleDateString();
  };

  const description =
    rangeConfig.bucket === "day"
      ? `Daily accuracy · ${rangeConfig.longLabel.toLowerCase()}`
      : rangeConfig.bucket === "week"
        ? `Weekly accuracy · ${rangeConfig.longLabel.toLowerCase()}`
        : `Monthly accuracy · ${rangeConfig.longLabel.toLowerCase()}`;

  // Pill-style toggle row — looks-like-tabs but each option is an independent
  // button. Compact short labels (1W, 1M, 3M, 6M, 1Y, All) so they fit on one
  // line even on narrow viewports.
  const rangeSelector = (
    <div className="inline-flex items-center rounded-md border bg-muted/40 p-0.5">
      {TIMELINE_RANGES.map((opt) => {
        const active = opt.value === range;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setRange(opt.value)}
            aria-pressed={active}
            className={cn(
              "px-2.5 py-1 text-xs font-medium rounded-sm transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );

  const headerBlock = (
    <CardHeader className="pb-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Performance Timeline
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {rangeSelector}
      </div>
    </CardHeader>
  );

  // Card grows to match its grid sibling (the 400px-tall radar). To kill the
  // empty space below the chart, we let Card flex vertically and stretch the
  // content + ResponsiveContainer to fill whatever height the row settles at.
  // The min-h floor stops the chart from collapsing when this card is the
  // taller sibling.
  const cardClass = "flex flex-col h-full";
  const contentClass = "flex-1 min-h-[300px]";

  if (loading) {
    return (
      <Card className={cardClass}>
        {headerBlock}
        <CardContent className={contentClass}>
          <Skeleton className="h-full w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cardClass}>
        {headerBlock}
        <CardContent className={contentClass}>
          <div className="h-full flex items-center justify-center text-destructive">
            Error loading timeline data: {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (bucketedData.length === 0) {
    return (
      <Card className={cardClass}>
        {headerBlock}
        <CardContent className={cn(contentClass, "flex items-center justify-center")}>
          <p className="text-muted-foreground text-center px-4">
            {data.length === 0
              ? "No quiz data available yet. Start taking quizzes to see your progress!"
              : "No completed quizzes in the selected range. Try a longer timeframe."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cardClass}>
      {headerBlock}
      <CardContent className={contentClass}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={bucketedData}>
            <defs>
              <linearGradient id="colorAccuracy" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={primaryColor} stopOpacity={0.4} />
                <stop offset="95%" stopColor={primaryColor} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={primaryColor} opacity={0.1} />
            <XAxis
              dataKey="date"
              tickFormatter={formatAxisDate}
              tick={{ fill: mutedFgColor, fontSize: 12 }}
              minTickGap={20}
            />
            <YAxis
              label={{
                value: "Accuracy (%)",
                angle: -90,
                position: "insideLeft",
                style: { fill: mutedFgColor },
              }}
              domain={[0, 100]}
              tick={{ fill: mutedFgColor, fontSize: 12 }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-popover border rounded-lg p-3 shadow-lg">
                      <p className="font-semibold">{formatTooltipDate(payload[0].payload.date)}</p>
                      <p className="text-sm" style={{ color: primaryColor }}>
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
              stroke={primaryColor}
              strokeWidth={2}
              fill="url(#colorAccuracy)"
              dot={{ fill: primaryColor, r: 4 }}
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
  const {
    primary: primaryColor,
    foreground: foregroundColor,
    mutedForeground: mutedFgColor,
  } = useThemeColors();

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
            <PolarGrid stroke={primaryColor} opacity={0.2} />
            <PolarAngleAxis
              dataKey="category_name"
              tick={{ fontSize: 12, fill: foregroundColor }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: mutedFgColor }}
            />
            <Radar
              name="Accuracy"
              dataKey="accuracy"
              stroke={primaryColor}
              fill={primaryColor}
              fillOpacity={0.4}
              strokeWidth={2}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-popover border rounded-lg p-3 shadow-lg">
                      <p className="font-semibold">{payload[0].payload.category_name}</p>
                      <p className="text-sm" style={{ color: primaryColor }}>
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
