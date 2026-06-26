"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { TrendingUp } from "lucide-react";
import { cn } from "@/shared/utils";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  TIMELINE_RANGES,
  type TimelineData,
  type TimelineRange,
  bucketTimeline,
  useThemeColors,
} from "./chart-utils";

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
