// src/features/user/performance/components/alternative-charts.tsx
"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/shared/components/ui/card";
import { Bar, PolarArea, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  RadialLinearScale,
  PolarAreaController,
  DoughnutController,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from "chart.js";
import { useTheme } from "next-themes";
import { BarChart3, Circle, Grid3x3, Layers } from "lucide-react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  RadialLinearScale,
  PolarAreaController,
  DoughnutController,
  Title,
  Tooltip,
  Legend
);

interface CategoryData {
  category_name: string;
  accuracy: number;
}

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
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(hueToRgb(p, q, h + 1 / 3) * 255);
  const g = Math.round(hueToRgb(p, q, h) * 255);
  const b = Math.round(hueToRgb(p, q, h - 1 / 3) * 255);

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function getThemeColors() {
  const primary = getCSSVariable("--primary");
  return hslToHex(primary);
}

function generateColorPalette(count: number): string[] {
  const primary = getThemeColors();
  const colors: string[] = [];

  for (let i = 0; i < count; i++) {
    const opacity = 0.3 + (i / count) * 0.7;
    colors.push(`${primary}${Math.floor(opacity * 255).toString(16).padStart(2, "0")}`);
  }

  return colors;
}

const THEME_COLORS = {
  dark: {
    grid: "#27272a",
    ticks: "#a1a1aa",
  },
  light: {
    grid: "#f4f4f5",
    ticks: "#52525b",
  },
} as const;

function useChartTheme() {
  const { theme, systemTheme } = useTheme();
  const currentTheme = theme === "system" ? systemTheme : theme;
  const isDark = currentTheme === "dark";
  const colors = isDark ? THEME_COLORS.dark : THEME_COLORS.light;

  return { isDark, colors };
}

/**
 * Lollipop Chart
 */
export function LollipopChart({ data = [] }: { data?: CategoryData[] }) {
  const { isDark, colors } = useChartTheme();
  const [primaryColor, setPrimaryColor] = useState("#000000");

  useEffect(() => {
    setPrimaryColor(getThemeColors());
  }, [isDark]);

  const sortedData = [...data].sort((a, b) => b.accuracy - a.accuracy);

  const chartData = {
    labels: sortedData.map((d) => d.category_name),
    datasets: [
      {
        label: "Accuracy",
        data: sortedData.map((d) => d.accuracy),
        backgroundColor: primaryColor,
        borderColor: primaryColor,
        borderWidth: 3,
        pointRadius: 8,
        pointHoverRadius: 10,
        showLine: false,
        type: "line" as const,
      },
      {
        label: "Baseline",
        data: sortedData.map(() => 0),
        backgroundColor: "transparent",
        borderColor: colors.grid,
        borderWidth: 2,
        type: "bar" as const,
        barThickness: 2,
      },
    ],
  };

  const options: ChartOptions<"line"> = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => `${context.parsed.x.toFixed(1)}%`,
        },
      },
    },
    scales: {
      x: {
        min: 0,
        max: 100,
        grid: { color: colors.grid },
        ticks: {
          color: colors.ticks,
          callback: (value) => `${value}%`,
        },
      },
      y: {
        grid: { display: false },
        ticks: { color: colors.ticks },
      },
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Lollipop Chart
        </CardTitle>
        <CardDescription>Clean, modern visualization</CardDescription>
      </CardHeader>
      <CardContent>
        <div style={{ height: "300px" }}>
          <Bar data={chartData as any} options={options as any} />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Polar Area Chart
 */
export function PolarAreaChart({ data = [] }: { data?: CategoryData[] }) {
  const { isDark } = useChartTheme();
  const [primaryColor, setPrimaryColor] = useState("#000000");

  useEffect(() => {
    setPrimaryColor(getThemeColors());
  }, [isDark]);

  const colors = generateColorPalette(data.length);

  const chartData = {
    labels: data.map((d) => d.category_name),
    datasets: [
      {
        label: "Accuracy",
        data: data.map((d) => d.accuracy),
        backgroundColor: colors,
        borderColor: primaryColor,
        borderWidth: 2,
      },
    ],
  };

  const options: ChartOptions<"polarArea"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => `${context.label}: ${context.parsed.r.toFixed(1)}%`,
        },
      },
    },
    scales: {
      r: {
        min: 0,
        max: 100,
        ticks: {
          stepSize: 25,
          backdropColor: "transparent",
        },
      },
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Circle className="h-5 w-5" />
          Polar Area Chart
        </CardTitle>
        <CardDescription>Area-based radial visualization</CardDescription>
      </CardHeader>
      <CardContent>
        <div style={{ height: "300px" }}>
          <PolarArea data={chartData} options={options} />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Treemap (CSS Grid-based)
 */
export function TreemapChart({ data = [] }: { data?: CategoryData[] }) {
  const [primaryColor, setPrimaryColor] = useState("#000000");
  const { isDark } = useChartTheme();

  useEffect(() => {
    setPrimaryColor(getThemeColors());
  }, [isDark]);

  const totalAccuracy = data.reduce((sum, d) => sum + d.accuracy, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Grid3x3 className="h-5 w-5" />
          Treemap
        </CardTitle>
        <CardDescription>Size shows relative performance</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className="grid gap-1"
          style={{
            height: "300px",
            gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
            gridAutoRows: "minmax(60px, 1fr)",
          }}
        >
          {data.map((category, i) => {
            const size = (category.accuracy / totalAccuracy) * 100;
            const opacity = 0.3 + (category.accuracy / 100) * 0.7;

            return (
              <div
                key={i}
                className="flex flex-col items-center justify-center p-2 rounded-md hover:scale-105 transition-transform cursor-pointer"
                style={{
                  backgroundColor: `${primaryColor}${Math.floor(opacity * 255).toString(16).padStart(2, "0")}`,
                  gridColumn: size > 15 ? "span 2" : "span 1",
                  gridRow: size > 20 ? "span 2" : "span 1",
                }}
                title={`${category.category_name}: ${category.accuracy}%`}
              >
                <span className="text-xs font-medium text-center line-clamp-2">
                  {category.category_name}
                </span>
                <span className="text-lg font-bold">{category.accuracy}%</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Heatmap Matrix
 */
export function HeatmapMatrix({ data = [] }: { data?: CategoryData[] }) {
  const [primaryColor, setPrimaryColor] = useState("#000000");
  const { isDark } = useChartTheme();

  useEffect(() => {
    setPrimaryColor(getThemeColors());
  }, [isDark]);

  const getColor = (accuracy: number) => {
    const opacity = (accuracy / 100) * 0.9 + 0.1;
    return `${primaryColor}${Math.floor(opacity * 255).toString(16).padStart(2, "0")}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Heatmap Matrix
        </CardTitle>
        <CardDescription>Color intensity shows performance</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-2" style={{ height: "300px" }}>
          {data.map((category, i) => (
            <div
              key={i}
              className="flex flex-col items-center justify-center p-3 rounded-lg hover:scale-105 transition-all cursor-pointer"
              style={{
                backgroundColor: getColor(category.accuracy),
              }}
              title={`${category.category_name}: ${category.accuracy}%`}
            >
              <span className="text-xs font-medium text-center line-clamp-2 mb-1">
                {category.category_name}
              </span>
              <span className="text-xl font-bold">{category.accuracy}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Radial Bar Chart (using Doughnut with rotation)
 */
export function RadialBarChart({ data = [] }: { data?: CategoryData[] }) {
  const { isDark } = useChartTheme();
  const [primaryColor, setPrimaryColor] = useState("#000000");

  useEffect(() => {
    setPrimaryColor(getThemeColors());
  }, [isDark]);

  const colors = generateColorPalette(data.length);

  const chartData = {
    labels: data.map((d) => d.category_name),
    datasets: [
      {
        label: "Accuracy",
        data: data.map((d) => d.accuracy),
        backgroundColor: colors,
        borderColor: primaryColor,
        borderWidth: 2,
        circumference: 270,
        rotation: 135,
      },
    ],
  };

  const options: ChartOptions<"doughnut"> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "50%",
    plugins: {
      legend: { position: "bottom" as const },
      tooltip: {
        callbacks: {
          label: (context) => `${context.label}: ${context.parsed.toFixed(1)}%`,
        },
      },
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Circle className="h-5 w-5" />
          Radial Bar Chart
        </CardTitle>
        <CardDescription>Circular bar arrangement</CardDescription>
      </CardHeader>
      <CardContent>
        <div style={{ height: "300px" }}>
          <Doughnut data={chartData} options={options} />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Bullet Chart (Horizontal bars with zones)
 */
export function BulletChart({ data = [] }: { data?: CategoryData[] }) {
  const { colors, isDark } = useChartTheme();
  const [primaryColor, setPrimaryColor] = useState("#000000");

  useEffect(() => {
    setPrimaryColor(getThemeColors());
  }, [isDark]);

  const sortedData = [...data].sort((a, b) => b.accuracy - a.accuracy);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Bullet Chart
        </CardTitle>
        <CardDescription>Performance with target zones</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3" style={{ height: "300px", overflowY: "auto" }}>
          {sortedData.map((category, i) => (
            <div key={i} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium">{category.category_name}</span>
                <span className="text-muted-foreground">{category.accuracy}%</span>
              </div>
              <div className="relative h-6 rounded-full overflow-hidden bg-muted/30">
                {/* Poor zone (0-60%) */}
                <div className="absolute inset-0 bg-red-500/20" style={{ width: "60%" }} />
                {/* Good zone (60-80%) */}
                <div className="absolute left-[60%] inset-y-0 bg-yellow-500/20" style={{ width: "20%" }} />
                {/* Excellent zone (80-100%) */}
                <div className="absolute left-[80%] inset-y-0 bg-green-500/20" style={{ width: "20%" }} />
                {/* Actual performance bar */}
                <div
                  className="absolute inset-y-0 left-0 transition-all duration-1000 ease-out"
                  style={{
                    width: `${category.accuracy}%`,
                    backgroundColor: primaryColor,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
