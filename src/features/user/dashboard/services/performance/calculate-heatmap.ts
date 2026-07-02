// Activity heatmap post-processing: bigint→number conversion, per-day
// aggregates, and streak calculation over the get_user_activity_heatmap RPC
// result (row order is preserved; the RPC returns days oldest-first).

import type { HeatmapDay, HeatmapStats } from "./types";

/** Raw RPC row — counts arrive as bigint (string or number depending on driver). */
export interface RawHeatmapRow {
  date: string;
  quizzes: number | string;
  questions: number | string;
}

export interface HeatmapSection {
  data: HeatmapDay[];
  stats: HeatmapStats;
}

export function calculateHeatmap(rawHeatmapData: RawHeatmapRow[] | null): HeatmapSection {
  // Convert bigint to number and ensure date is string
  const heatmapData: HeatmapDay[] = (rawHeatmapData || []).map((day) => ({
    date: day.date,
    quizzes: Number(day.quizzes),
    questions: Number(day.questions),
  }));

  // Calculate heatmap statistics
  const daysWithActivity = heatmapData.filter((d) => d.questions > 0).length;
  const totalQuestions = heatmapData.reduce((sum, d) => sum + d.questions, 0);
  const totalQuizzes = heatmapData.reduce((sum, d) => sum + d.quizzes, 0);

  const avgQuestionsPerDay =
    daysWithActivity > 0 ? Math.round(totalQuestions / daysWithActivity) : 0;
  const avgQuizzesPerDay =
    daysWithActivity > 0 ? (totalQuizzes / daysWithActivity).toFixed(1) : "0";

  // Calculate streaks
  let longestStreak = 0;
  let currentStreak = 0;
  let tempStreak = 0;

  for (let i = heatmapData.length - 1; i >= 0; i--) {
    if (heatmapData[i].questions > 0) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);

      if (i === heatmapData.length - 1 || currentStreak > 0 || i === heatmapData.length - 2) {
        currentStreak = tempStreak;
      }
    } else {
      if (i >= heatmapData.length - 2) {
        currentStreak = 0;
      }
      tempStreak = 0;
    }
  }

  return {
    data: heatmapData,
    stats: {
      avgQuestionsPerDay,
      avgQuizzesPerDay,
      longestStreak,
      currentStreak,
      totalQuestions,
      totalQuizzes,
      daysWithActivity,
    },
  };
}
