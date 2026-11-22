"use client";

import { useState } from "react";
import { SectionCard } from "@/shared/components/ui/page-layout";
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

  const heading = {
    title: "Category Comparison",
    description: "Your performance across all categories",
    icon: Target,
  };

  if (loading) {
    return (
      <SectionCard {...heading}>
        <Skeleton className="h-[400px] w-full" />
      </SectionCard>
    );
  }

  if (error) {
    return (
      <SectionCard {...heading}>
        <div className="flex h-[400px] items-center justify-center text-sm text-destructive">
          Error loading category data: {error}
        </div>
      </SectionCard>
    );
  }

  if (data.length === 0) {
    return (
      <SectionCard {...heading} contentClassName="flex h-[300px] items-center justify-center">
        <p className="px-4 text-center text-sm text-muted-foreground">
          No category data available yet. Start taking quizzes to see your performance!
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard {...heading}>
      <ResponsiveContainer width="100%" height={400}>
        {/* Smaller radius + shortened labels leave room for the category names, which
            otherwise clip at the card edge on phones. */}
        <RadarChart data={data} outerRadius="65%">
          <PolarGrid stroke={primaryColor} opacity={0.2} />
          <PolarAngleAxis
            dataKey="category_name"
            tick={{ fontSize: 11, fill: foregroundColor }}
            tickFormatter={(name: string) => (name.length > 16 ? `${name.slice(0, 15)}…` : name)}
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
    </SectionCard>
  );
}
