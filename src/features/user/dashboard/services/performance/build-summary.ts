// Pure calculators for the summary block: attempt flattening, overall/average
// scores, and percentile-RPC result mapping.

import type { FlattenedAttempt, SessionWithAttempts } from "./types";

export interface ScoreSummary {
  totalAttempts: number;
  correctAttempts: number;
  overallScore: number;
  avgScore: number;
}

/** Row shape returned by the get_user_percentile RPC. */
export interface PercentileRow {
  percentile: number | null;
  rank: number | null;
  total_users: number | string | null;
}

export interface PercentileSummary {
  userPercentile: number;
  peerRank: number;
  totalUsers: number;
}

/** Flatten the windowed sessions' attempts, tagging each with session context. */
export function flattenSessionAttempts(sessions: SessionWithAttempts[]): FlattenedAttempt[] {
  return sessions.flatMap((s) =>
    (s.quiz_attempts || []).map((a) => ({
      ...a,
      session_id: s.id,
      session_created_at: s.created_at,
      session_completed_at: s.completed_at,
      session_score: s.score,
      session_status: s.status,
    }))
  );
}

/**
 * Overall accuracy across all windowed attempts, plus the average score of
 * completed windowed sessions (the latter feeds the percentile RPC).
 */
export function calculateScoreSummary(
  allAttempts: FlattenedAttempt[],
  completedSessions: SessionWithAttempts[]
): ScoreSummary {
  const totalAttempts = allAttempts.length;
  const correctAttempts = allAttempts.filter((a) => a.is_correct).length;
  const overallScore = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;

  const avgScore =
    completedSessions.length > 0
      ? Math.round(
          completedSessions.reduce((sum, s) => sum + (s.score || 0), 0) / completedSessions.length
        )
      : 0;

  return { totalAttempts, correctAttempts, overallScore, avgScore };
}

/**
 * Map the get_user_percentile RPC result onto the response fields.
 *
 * IMPORTANT: use ?? (nullish coalescing), NOT ||. The SQL function can legitimately
 * return percentile=0 (bottom of the pool — PERCENT_RANK starts at 0) or rank=1 with
 * total_users=1 (you're the only user in the pool). Both cases used to silently get
 * overwritten by the || defaults, baking nonsense values into the cache forever.
 */
export function resolvePercentile(percentileData: PercentileRow[] | null): PercentileSummary {
  const userPercentile = percentileData?.[0]?.percentile ?? 50;
  const peerRank = percentileData?.[0]?.rank ?? 50;
  const totalUsers = Number(percentileData?.[0]?.total_users ?? 100);

  return { userPercentile, peerRank, totalUsers };
}
