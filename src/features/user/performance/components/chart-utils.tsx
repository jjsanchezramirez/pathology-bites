"use client";

import { useState, useEffect } from "react";

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

export function useThemeColors() {
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

export interface TimelineData {
  date: string;
  accuracy: number;
  quizzes: number;
}

export interface HeatmapData {
  date: string;
  quizzes: number;
  questions: number;
}

export interface HeatmapStats {
  avgQuestionsPerDay: number;
  avgQuizzesPerDay: string;
  longestStreak: number;
  currentStreak: number;
  totalQuestions: number;
  totalQuizzes: number;
  daysWithActivity: number;
}

export interface CategoryData {
  category_name: string;
  accuracy: number;
}

/**
 * Chart 1: Performance Timeline
 */
export type TimelineRange = "1w" | "1m" | "3m" | "6m" | "1y" | "all";

interface TimelineRangeOption {
  value: TimelineRange;
  label: string; // short pill label
  longLabel: string; // used in the card description
  days: number | null; // null = all-time
  bucket: "day" | "week" | "month";
}

export const TIMELINE_RANGES: TimelineRangeOption[] = [
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

export function bucketTimeline(
  data: TimelineData[],
  bucket: "day" | "week" | "month"
): TimelineData[] {
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
