// Cell quiz scoring — shared by the client (live score) and the API route
// (authoritative score). The server recomputes from per-question results, so a
// forged request can only claim answers/timings, never an arbitrary total.

export const QUESTIONS_PER_ROUND = 10;
const BASE_POINTS = 100;
const MAX_SPEED_BONUS = 50;
const SPEED_WINDOW_MS = 10_000;
export const MAX_ROUND_SCORE = QUESTIONS_PER_ROUND * (BASE_POINTS + MAX_SPEED_BONUS);
/** Fastest a human could plausibly finish a round; the DB enforces 5s total. */
export const MIN_ANSWER_MS = 400;

export interface RoundAnswer {
  correct: boolean;
  ms: number;
}

export function pointsForAnswer(a: RoundAnswer): number {
  if (!a.correct) return 0;
  const speed = Math.max(0, 1 - a.ms / SPEED_WINDOW_MS);
  return BASE_POINTS + Math.round(MAX_SPEED_BONUS * speed);
}

export function scoreRound(answers: RoundAnswer[]) {
  const correct = answers.filter((a) => a.correct).length;
  const score = answers.reduce((sum, a) => sum + pointsForAnswer(a), 0);
  const durationMs = answers.reduce((sum, a) => sum + a.ms, 0);
  return { correct, score, durationMs };
}
