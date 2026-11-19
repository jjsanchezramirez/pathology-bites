/**
 * awardAchievements — the quiz results pop-up reads `newAchievements` from the
 * /complete response, so it must still return the unlocked definitions and the
 * cache-validation metadata now that its reads run in parallel.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const tables = vi.hoisted(() => ({
  rows: {} as Record<string, unknown>,
  inserted: [] as unknown[],
}));

// Thenable query builder: every filter returns itself; awaiting it (or
// .single()) resolves to the rows registered for its table.
function makeQuery(table: string) {
  const result = () => {
    const data = tables.rows[table];
    return { data, error: null };
  };
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "not", "order", "limit"]) q[m] = vi.fn(() => q);
  q.single = vi.fn(async () => {
    const data = tables.rows[table];
    return { data: Array.isArray(data) ? (data[0] ?? null) : data, error: null };
  });
  q.then = (resolve: (v: unknown) => unknown) => resolve(result());
  return q;
}

vi.mock("@/shared/services/server", () => ({
  createClient: vi.fn(async () => ({ from: (t: string) => makeQuery(t) })),
}));

vi.mock("@/shared/services/service-role-client", () => ({
  createServiceRoleClient: vi.fn(() => ({
    from: () => ({
      insert: (rows: unknown[]) => {
        tables.inserted.push(...rows);
        return {
          select: async () => ({
            data: rows.map((r) => ({
              achievement_id: (r as { achievement_id: string }).achievement_id,
            })),
            error: null,
          }),
        };
      },
    }),
  })),
}));

import { awardAchievements } from "@/features/user/achievements/services/achievement-service.server";

describe("awardAchievements", () => {
  beforeEach(() => {
    tables.inserted.length = 0;
    tables.rows = {
      quiz_sessions: [
        {
          score: 80,
          created_at: "2026-11-18T23:21:04Z",
          completed_at: "2026-11-18T23:26:00Z",
          total_questions: 5,
          total_time_spent: 120,
        },
      ],
      quiz_attempts: [],
      questions: [{ category_id: "c1" }],
      user_achievements: [],
    };
  });

  it("unlocks the first-quiz achievement and returns it for the pop-up", async () => {
    const result = await awardAchievements("user-1", ["quiz-1"]);

    expect(result.newAchievements.map((a) => a.id)).toContain("quiz-1");
    expect(tables.inserted).toContainEqual({ user_id: "user-1", achievement_id: "quiz-1" });
    expect(result.metadata).toEqual({
      totalQuizzes: 1,
      lastQuizTimestamp: "2026-11-18T23:26:00Z",
    });
  });

  it("returns nothing new when the achievement is already unlocked", async () => {
    tables.rows.user_achievements = [{ achievement_id: "quiz-1" }];

    const result = await awardAchievements("user-1", ["quiz-1"]);

    expect(result.newAchievements.map((a) => a.id)).not.toContain("quiz-1");
    expect(tables.inserted).not.toContainEqual({ user_id: "user-1", achievement_id: "quiz-1" });
  });
});
