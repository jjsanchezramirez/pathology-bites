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
import { Target } from "lucide-react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { type CategoryData, useThemeColors } from "./chart-utils";

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
