// src/features/performance/components/interactive-chart-demos.tsx
"use client";

import { useState, useEffect, useRef, ReactNode } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/shared/components/ui/card";

import { Skeleton } from "@/shared/components/ui/skeleton";
import { Button } from "@/shared/components/ui/button";
import { TrendingUp, Calendar, Target, ChevronLeft, ChevronRight, LucideIcon } from "lucide-react";
import { Line, Radar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  RadarController,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions,
  TooltipOptions,
  ScaleOptions,
} from "chart.js";
import { useTheme } from "next-themes";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  RadarController,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Helper function to get computed CSS variable value
function getCSSVariable(variable: string): string {
  if (typeof window === "undefined") return "";
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value;
}

// Helper to convert HSL string to hex
function hslToHex(hsl: string): string {
  if (!hsl) return "#000000";
  const match = hsl.match(/(\d+)\s+(\d+)%\s+(\d+)%/);
  if (!match) return "#000000";

  const h = parseInt(match[1]) / 360;
  const s = parseInt(match[2]) / 100;
  const l = parseInt(match[3]) / 100;

  const hueToRgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(hueToRgb(p, q, h + 1/3) * 255);
  const g = Math.round(hueToRgb(p, q, h) * 255);
  const b = Math.round(hueToRgb(p, q, h - 1/3) * 255);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Get theme colors from CSS variables
function getThemeColors() {
  const accent = getCSSVariable("--accent");
  const accentHex = hslToHex(accent);

  // Create rgba versions
  const match = accentHex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  let r = 0, g = 0, b = 0;
  if (match) {
    r = parseInt(match[1], 16);
    g = parseInt(match[2], 16);
    b = parseInt(match[3], 16);
  }

  return {
    accent: accentHex,
    radarFill: `rgba(${r}, ${g}, ${b}, 0.12)`,
  };
}

// Use theme colors
const CHART_COLORS = {
  get accent() { return getThemeColors().accent; },
  get radarFill() { return getThemeColors().radarFill; },
  white: "#ffffff",
} as const;

const HEATMAP_COLORS = {
  empty: "bg-muted/30",
  level1: "bg-accent/20",
  level2: "bg-accent/40",
  level3: "bg-accent/60",
  level4: "bg-accent/80",
  level5: "bg-accent",
} as const;

const THEME_COLORS = {
  dark: {
    tooltip: { bg: "#18181b", text: "#fafafa", border: "#3f3f46" },
    grid: "#27272a",
    ticks: "#a1a1aa",
    radarGrid: "#3f3f46",
  },
  light: {
    tooltip: { bg: "#ffffff", text: "#09090b", border: "#e4e4e7" },
    grid: "#f4f4f5",
    ticks: "#52525b",
    radarGrid: "#e4e4e7",
  },
} as const;

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

// Hooks
function useChartTheme() {
  const { theme, systemTheme } = useTheme();
  const currentTheme = theme === "system" ? systemTheme : theme;
  const isDark = currentTheme === "dark";
  const colors = isDark ? THEME_COLORS.dark : THEME_COLORS.light;

  return { isDark, colors };
}

// Utility functions
function createTooltipConfig(isDark: boolean): Partial<TooltipOptions<any>> {
  const colors = isDark ? THEME_COLORS.dark : THEME_COLORS.light;

  return {
    backgroundColor: colors.tooltip.bg,
    titleColor: colors.tooltip.text,
    bodyColor: colors.tooltip.text,
    borderColor: colors.tooltip.border,
    borderWidth: 1,
    padding: 16,
    displayColors: false,
    cornerRadius: 8,
    titleFont: {
      size: 13,
      weight: "bold" as const,
    },
    bodyFont: {
      size: 12,
      weight: "normal" as const,
    },
    bodySpacing: 6,
    titleMarginBottom: 8,
    caretSize: 6,
    caretPadding: 8,
  };
}

function createGridConfig(isDark: boolean, isRadar = false) {
  const colors = isDark ? THEME_COLORS.dark : THEME_COLORS.light;

  return {
    grid: {
      color: isRadar ? colors.radarGrid : colors.grid,
    },
    ticks: {
      color: colors.ticks,
      font: {
        size: 11,
      },
    },
  };
}

// Shared components
interface ChartCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  loading: boolean;
  error: string | null;
  hasData: boolean;
  emptyMessage: string;
  height?: string;
  children: ReactNode;
  headerRight?: ReactNode;
}

function ChartCard({
  icon: Icon,
  title,
  description,
  loading,
  error,
  hasData,
  emptyMessage,
  height = "300px",
  children,
  headerRight,
}: ChartCardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className={`h-[${height}] w-full`} />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className={`h-[${height}] flex items-center justify-center text-destructive`}>
            Error loading data: {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className={`flex items-center justify-center h-[${height}]`}>
          <p className="text-muted-foreground text-center px-4">
            {emptyMessage}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className={headerRight ? "flex items-start justify-between" : undefined}>
          <div>
            <CardTitle className="flex items-center gap-2">
              <Icon className="h-5 w-5" />
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {headerRight}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
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
  const { isDark } = useChartTheme();

  const chartData = {
    labels: data.map((d) =>
      new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    ),
    datasets: [
      {
        label: "Accuracy",
        data: data.map((d) => d.accuracy),
        borderColor: "transparent",
        backgroundColor: CHART_COLORS.accent,
        borderWidth: 0,
        fill: false,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: CHART_COLORS.accent,
        pointBorderColor: CHART_COLORS.white,
        pointBorderWidth: 2,
        pointHoverBorderWidth: 3,
        showLine: false,
      },
    ],
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index",
      intersect: false,
    },
    animation: {
      duration: 600,
      easing: "easeInOutCubic",
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        ...createTooltipConfig(isDark),
        callbacks: {
          title: (context) => {
            const index = context[0].dataIndex;
            return new Date(data[index].date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });
          },
          label: (context) => {
            const index = context.dataIndex;
            const quizzes = data[index].quizzes;
            return [
              `Accuracy: ${context.parsed.y.toFixed(1)}%`,
              `${quizzes} quiz${quizzes !== 1 ? "zes" : ""}`,
            ];
          },
        },
      },
    },
    scales: {
      x: {
        ...createGridConfig(isDark),
        grid: {
          ...createGridConfig(isDark).grid,
          display: true,
          drawOnChartArea: false,
          drawTicks: true,
        },
      },
      y: {
        min: 0,
        max: 105,
        ...createGridConfig(isDark),
        grid: {
          ...createGridConfig(isDark).grid,
          display: true,
        },
        ticks: {
          ...createGridConfig(isDark).ticks,
          callback: (value) => (typeof value === "number" && value <= 100 ? `${value}%` : ""),
          stepSize: 25,
        },
      },
    },
  };

  return (
    <ChartCard
      icon={TrendingUp}
      title="Performance Timeline"
      description="Your accuracy over the last 30 days"
      loading={loading}
      error={error}
      hasData={data.length > 0}
      emptyMessage="No quiz data available yet. Start taking quizzes to see your progress!"
      height="300px"
    >
      <div style={{ height: "300px" }}>
        <Line data={chartData} options={options} />
      </div>
    </ChartCard>
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
  const { isDark } = useChartTheme();

  const chartData = {
    // TODO: Use short_form abbreviations when available from API
    labels: data.map((d) => d.category_name),
    datasets: [
      {
        label: "Accuracy",
        data: data.map((d) => d.accuracy),
        backgroundColor: CHART_COLORS.radarFill,
        borderColor: "transparent",
        borderWidth: 0,
        pointBackgroundColor: CHART_COLORS.accent,
        pointBorderColor: "transparent",
        pointBorderWidth: 0,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: CHART_COLORS.accent,
        pointHoverBorderColor: "transparent",
      },
    ],
  };

  const gridConfig = createGridConfig(isDark, true);
  const options: ChartOptions<"radar"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "nearest",
      intersect: false,
    },
    animation: {
      duration: 600,
      easing: "easeInOutCubic",
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        ...createTooltipConfig(isDark),
        callbacks: {
          title: (context) => {
            return data[context[0].dataIndex].category_name;
          },
          label: (context) => {
            return `${context.parsed.r.toFixed(1)}%`;
          },
        },
      },
    },
    scales: {
      r: {
        min: 0,
        max: 100,
        beginAtZero: true,
        ticks: {
          stepSize: 25,
          ...gridConfig.ticks,
          callback: (value) => value === 0 ? "0" : `${value}`,
          backdropColor: "transparent",
          showLabelBackdrop: false,
          font: {
            size: 10,
          },
        },
        grid: {
          ...gridConfig.grid,
          circular: true,
          lineWidth: 0.5,
        },
        angleLines: {
          display: false,
        },
        pointLabels: {
          ...gridConfig.ticks,
          font: {
            size: 11,
            weight: "normal" as const,
          },
          padding: 12,
        },
      },
    },
  };

  return (
    <ChartCard
      icon={Target}
      title="Category Comparison"
      description="Your performance across all categories"
      loading={loading}
      error={error}
      hasData={data.length > 0}
      emptyMessage="No category data available yet. Start taking quizzes to see your performance!"
      height="400px"
    >
      <div style={{ height: "400px" }}>
        <Radar data={chartData} options={options} />
      </div>
    </ChartCard>
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

// Heatmap helper functions
function getHeatmapColor(questions: number): string {
  if (questions === 0) return HEATMAP_COLORS.empty;
  if (questions <= 5) return HEATMAP_COLORS.level1;
  if (questions <= 10) return HEATMAP_COLORS.level2;
  if (questions <= 20) return HEATMAP_COLORS.level3;
  if (questions <= 30) return HEATMAP_COLORS.level4;
  return HEATMAP_COLORS.level5;
}

interface DateRange {
  periodStart: Date;
  periodEnd: Date;
  startDate: Date;
  endDate: Date;
}

function calculateDateRange(currentPeriodStart: Date, monthsToShow: number): DateRange {
  const periodEnd = new Date(currentPeriodStart);
  periodEnd.setHours(0, 0, 0, 0);

  const periodStart = new Date(periodEnd);
  periodStart.setMonth(periodStart.getMonth() - monthsToShow + 1);
  periodStart.setDate(1);

  // Find the first Sunday on or before the period start
  const startDate = new Date(periodStart);
  const dayOfWeek = startDate.getDay();
  startDate.setDate(startDate.getDate() - dayOfWeek);

  // End on the last day of the end month
  const endDate = new Date(periodEnd.getFullYear(), periodEnd.getMonth() + 1, 0);

  return { periodStart, periodEnd, startDate, endDate };
}

function buildDaysArray(startDate: Date, endDate: Date, dataMap: Map<string, HeatmapData>): HeatmapData[] {
  const allDays: HeatmapData[] = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split("T")[0];
    const dayData = dataMap.get(dateStr) || { date: dateStr, quizzes: 0, questions: 0 };
    allDays.push(dayData);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return allDays;
}

function groupIntoWeeks(allDays: HeatmapData[]): HeatmapData[][] {
  const weeks: HeatmapData[][] = [];
  for (let i = 0; i < allDays.length; i += 7) {
    const week = allDays.slice(i, i + 7);
    if (week.length === 7) {
      weeks.push(week);
    }
  }
  return weeks;
}

function calculateMonthLabels(weeks: HeatmapData[][]): Array<{ month: string; weekIndex: number }> {
  const monthLabels: Array<{ month: string; weekIndex: number }> = [];
  let lastMonth = "";

  weeks.forEach((week, weekIndex) => {
    const weekStartDate = new Date(week[0].date);
    const monthName = weekStartDate.toLocaleDateString("en-US", { month: "short" });

    if (monthName !== lastMonth) {
      monthLabels.push({ month: monthName, weekIndex });
      lastMonth = monthName;
    }
  });

  return monthLabels;
}

function formatPeriodDescription(periodStart: Date, periodEnd: Date): string {
  const startMonth = periodStart.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  const endMonth = periodEnd.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  return startMonth === endMonth ? startMonth : `${startMonth} - ${endMonth}`;
}

function formatDayTooltip(day: HeatmapData): string {
  const date = new Date(day.date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const questionText = `${day.questions} question${day.questions !== 1 ? "s" : ""}`;
  const quizText = `${day.quizzes} quiz${day.quizzes !== 1 ? "zes" : ""}`;
  return `${date}\n${questionText}\n${quizText}`;
}

// Hook for responsive month calculation
function useResponsiveMonths(containerRef: React.RefObject<HTMLDivElement>) {
  const [monthsToShow, setMonthsToShow] = useState(12);

  useEffect(() => {
    const updateMonthsToShow = () => {
      if (!containerRef.current) return;

      const containerWidth = containerRef.current.offsetWidth;
      const availableWidth = containerWidth - 56; // Account for day labels and padding
      const weeksPerMonth = 4.33;
      const minWidthPerWeek = 15;
      const maxWeeks = Math.floor(availableWidth / minWidthPerWeek);

      // Determine months: 12, 6, 4, or 3
      let months: number;
      if (maxWeeks >= weeksPerMonth * 12) months = 12;
      else if (maxWeeks >= weeksPerMonth * 6) months = 6;
      else if (maxWeeks >= weeksPerMonth * 4) months = 4;
      else months = 3;

      setMonthsToShow(months);
    };

    const resizeObserver = new ResizeObserver(updateMonthsToShow);

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
      updateMonthsToShow();
    }

    return () => resizeObserver.disconnect();
  }, [containerRef]);

  return monthsToShow;
}

export function ActivityHeatmap({
  data = [],
  stats = null,
  loading = false,
}: ActivityHeatmapProps) {
  const [error] = useState<string | null>(null);
  const [currentPeriodStart, setCurrentPeriodStart] = useState(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const monthsToShow = useResponsiveMonths(containerRef);

  // Create a map for quick lookup
  const dataMap = new Map(data.map((d) => [d.date, d]));

  // Calculate dates and build data structures
  const { periodStart, periodEnd, startDate, endDate } = calculateDateRange(currentPeriodStart, monthsToShow);
  const allDays = buildDaysArray(startDate, endDate, dataMap);
  const weeks = groupIntoWeeks(allDays);
  const monthLabels = calculateMonthLabels(weeks);

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
    if (newStart <= now) {
      setCurrentPeriodStart(newStart);
    }
  };

  const goToToday = () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    setCurrentPeriodStart(now);
  };

  const canGoForward = () => {
    const newStart = new Date(currentPeriodStart);
    newStart.setMonth(newStart.getMonth() + monthsToShow);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return newStart <= now;
  };

  const isCurrentPeriod = () => {
    const now = new Date();
    return (
      currentPeriodStart.getMonth() === now.getMonth() &&
      currentPeriodStart.getFullYear() === now.getFullYear()
    );
  };

  const hasStats = stats && (stats.avgQuestionsPerDay > 0 || stats.longestStreak > 0 || stats.currentStreak > 0);

  const navigationButtons = (
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
        disabled={isCurrentPeriod()}
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
  );

  return (
    <ChartCard
      icon={Calendar}
      title="Activity Calendar"
      description={formatPeriodDescription(periodStart, periodEnd)}
      loading={loading}
      error={error}
      hasData={data.length > 0}
      emptyMessage="No activity data available yet."
      height="200px"
      headerRight={navigationButtons}
    >
      <div className="space-y-4">
        {/* Statistics - Only show if there's activity */}
        {hasStats && (
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
                      className={`rounded-sm ${getHeatmapColor(day.questions)} ${hasActivity ? "cursor-pointer hover:ring-1 hover:ring-primary" : "cursor-default"} transition-all duration-150 min-w-[10px] min-h-[10px]`}
                      title={formatDayTooltip(day)}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ChartCard>
  );
}
