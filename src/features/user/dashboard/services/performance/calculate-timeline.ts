// All-time daily timeline: one point per day with at least one completed
// session, averaging session scores and counting quizzes.

import type { CompletedSessionTimelineRow, TimelinePoint } from "./types";

export function calculateTimeline(
  completedSessions: CompletedSessionTimelineRow[] | null
): TimelinePoint[] {
  const dailyData: Record<string, { scores: number[]; count: number }> = {};

  (completedSessions || []).forEach((session) => {
    if (!session.completed_at) return;
    const date = new Date(session.completed_at).toISOString().split("T")[0];
    if (!dailyData[date]) {
      dailyData[date] = { scores: [], count: 0 };
    }
    dailyData[date].scores.push(session.score || 0);
    dailyData[date].count++;
  });

  return Object.entries(dailyData)
    .map(([date, stats]) => ({
      date,
      accuracy: stats.scores.reduce((sum, score) => sum + score, 0) / stats.scores.length,
      quizzes: stats.count,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
