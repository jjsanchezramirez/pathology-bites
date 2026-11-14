// Leaderboard activity registry (server-side). The `leaderboard_scores` table is
// activity-agnostic; each activity decides here how a submission is validated
// and how the authoritative score is computed. The client never sends a total —
// it sends the raw payload and the server derives `score`.
//
// To add an activity: register it below, then render <Leaderboard activity="..."/>
// and POST to /api/public/leaderboard/<activity>.
import {
  MIN_ANSWER_MS,
  QUESTIONS_PER_ROUND,
  scoreRound,
  type RoundAnswer,
} from "@/features/public/tools/cell-quiz/scoring";

interface ValidatedSubmission {
  score: number;
  durationMs: number | null;
  meta: Record<string, unknown>;
}

interface LeaderboardActivity {
  /** Returns null when the payload is malformed or implausible. */
  validate(payload: unknown): ValidatedSubmission | null;
}

const cellQuiz: LeaderboardActivity = {
  validate(payload) {
    const answers = (payload as { answers?: RoundAnswer[] } | null)?.answers;
    if (
      !Array.isArray(answers) ||
      answers.length !== QUESTIONS_PER_ROUND ||
      !answers.every(
        (a) =>
          a &&
          typeof a.correct === "boolean" &&
          Number.isFinite(a.ms) &&
          a.ms >= MIN_ANSWER_MS &&
          a.ms <= 10 * 60_000
      )
    ) {
      return null;
    }
    const { score, correct, durationMs } = scoreRound(
      answers.map((a) => ({ correct: a.correct, ms: Math.round(a.ms) }))
    );
    return { score, durationMs, meta: { correct, total: QUESTIONS_PER_ROUND } };
  },
};

export const LEADERBOARD_ACTIVITIES: Record<string, LeaderboardActivity> = {
  "cell-quiz": cellQuiz,
};
