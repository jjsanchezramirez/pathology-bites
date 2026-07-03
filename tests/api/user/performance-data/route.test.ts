/**
 * Characterization tests for GET /api/user/performance-data
 *
 * These pin the CURRENT behavior of the unified performance endpoint before
 * refactoring. In particular they lock in:
 *  - `summary.completedQuizzes` comes from the separate lifetime COUNT query,
 *    NOT the 100-row windowed `sessions` array (fixtures make the two differ)
 *  - `??` (not `||`) semantics for the percentile RPC: percentile=0 / rank=0
 *    must survive, never be replaced by the 50/50/100 defaults
 *  - full response shape for a rich user, a zero-score user, and an empty user
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GET } from "@/app/api/user/performance-data/route";
import {
  createAuthenticatedRequest,
  createMockRequest,
  getResponseJson,
} from "@tests/helpers/api-test-helpers";
import { ACHIEVEMENT_DEFINITIONS } from "@/features/user/achievements/services/achievement-checker";

// Mock dependencies
vi.mock("@/shared/services/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/shared/services/service-role-client", () => ({
  createServiceRoleClient: vi.fn(),
}));

vi.mock("@/shared/utils/logging", () => ({
  log: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { createClient } from "@/shared/services/server";
import { createServiceRoleClient } from "@/shared/services/service-role-client";

const ROUTE_URL = "http://localhost:3000/api/user/performance-data";
const USER_ID = "user-123";
// Frozen "now" so 30-day windows / welcome-message timestamps are deterministic
const FIXED_NOW = new Date("2026-07-02T12:00:00.000Z");

// ---------------------------------------------------------------------------
// Mock plumbing
// ---------------------------------------------------------------------------

/**
 * Thenable Supabase query-builder stub: every chained method returns the same
 * object, and awaiting the chain resolves with `result` (matches how the route
 * awaits `.limit()`, `.eq()`, `.order()`, etc. as terminal calls).
 */
function chainable(result: any) {
  const chain: any = {};
  for (const method of ["select", "eq", "in", "order", "limit", "not"]) {
    chain[method] = () => chain;
  }
  chain.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

interface MockFixture {
  sessions?: any[];
  sessionsError?: any;
  lifetimeCompletedCount?: number;
  questions?: any[];
  categories?: any[];
  timelineRows?: any[];
  heatmapRows?: any[];
  achievementRows?: any[] | null;
  userAchievements?: any[];
  categoryStatsRows?: any[];
  percentileRows?: any[] | null;
}

/**
 * Wire both Supabase clients (cookie-auth + service-role) with fixture data.
 * quiz_sessions is queried three times, in this fixed order:
 *   1. windowed sessions (limit 100, inner-join quiz_attempts)
 *   2. lifetime completed COUNT
 *   3. all completed sessions for the timeline
 */
function mockClients(fixture: MockFixture) {
  const tableQueues: Record<string, any[]> = {
    quiz_sessions: [
      { data: fixture.sessions ?? [], error: fixture.sessionsError ?? null },
      { count: fixture.lifetimeCompletedCount ?? 0, data: null, error: null },
      { data: fixture.timelineRows ?? [], error: null },
    ],
    questions: [{ data: fixture.questions ?? [], error: null }],
    categories: [{ data: fixture.categories ?? [], error: null }],
    achievements: [{ data: fixture.achievementRows ?? null, error: null }],
    user_achievements: [{ data: fixture.userAchievements ?? [], error: null }],
  };

  const rpcResults: Record<string, any> = {
    get_user_activity_heatmap: { data: fixture.heatmapRows ?? [], error: null },
    get_user_category_stats: { data: fixture.categoryStatsRows ?? [], error: null },
  };

  const supabase = {
    from: vi.fn((table: string) => {
      const queue = tableQueues[table];
      if (!queue || queue.length === 0) {
        throw new Error(`Unexpected query on table: ${table}`);
      }
      return chainable(queue.shift());
    }),
    rpc: vi.fn((fn: string) => Promise.resolve(rpcResults[fn] ?? { data: null, error: null })),
  };

  (createClient as any).mockResolvedValue(supabase);

  const adminRpc = vi.fn().mockResolvedValue({ data: fixture.percentileRows ?? null, error: null });
  (createServiceRoleClient as any).mockReturnValue({ rpc: adminRpc });

  return { supabase, adminRpc };
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

// Global category tree: two level-1 parents + four level-2 subcategories
const CATEGORY_ROWS = [
  { id: "cat-ap", name: "Anatomic Pathology", short_form: null, parent_id: null, level: 1 },
  { id: "cat-d", name: "Chemistry", short_form: "CHEM", parent_id: "cat-cp", level: 2 },
  { id: "cat-cp", name: "Clinical Pathology", short_form: null, parent_id: null, level: 1 },
  { id: "cat-c", name: "Cytopathology (CYTO)", short_form: null, parent_id: "cat-ap", level: 2 },
  { id: "cat-a", name: "Dermatopathology (DP)", short_form: "DP", parent_id: "cat-ap", level: 2 },
  { id: "cat-b", name: "Hematopathology", short_form: null, parent_id: "cat-cp", level: 2 },
];

const QUESTION_ROWS = [
  { id: "q1", category_id: "cat-a" },
  { id: "q2", category_id: "cat-a" },
  { id: "q3", category_id: "cat-b" },
  { id: "q4", category_id: "cat-b" },
  { id: "q5", category_id: "cat-b" },
  { id: "q6", category_id: "cat-a" },
  { id: "q7", category_id: "cat-c" },
  { id: "q8", category_id: "cat-d" },
];

// Small definitions list returned by the `achievements` table (the DB is the
// source of truth; the route only falls back to ACHIEVEMENT_DEFINITIONS when
// the DB fetch fails). Covers every switch branch in the progress calculator.
const DB_ACHIEVEMENT_DEFINITIONS = [
  {
    id: "quiz-5",
    title: "Junior Resident",
    description: "Complete 5 quizzes",
    category: "quiz",
    requirement: 5,
    animation_type: "medal",
  },
  {
    id: "perfect-1",
    title: "Flawless Victory",
    description: "Get 100% on 1 quiz",
    category: "perfect",
    requirement: 1,
    animation_type: "star_medal",
  },
  {
    id: "streak-3",
    title: "Three Day Streak",
    description: "Maintain a 3-day streak",
    category: "streak",
    requirement: 3,
    animation_type: "badge",
  },
  {
    id: "speed-10in6",
    title: "Quick Thinker",
    description: "Get 100% on 10 Qs in 6 minutes or less",
    category: "speed",
    requirement: 1,
    animation_type: "star_badge",
  },
  {
    id: "accuracy-50-3",
    title: "Building Foundations",
    description: "Score 50% or higher over last 3 quizzes",
    category: "accuracy",
    requirement: 50,
    animation_type: "crown",
  },
  {
    id: "differential-100-all",
    title: "Jack Of All Trades",
    description: "Reach 100 correct in all subjects",
    category: "differential",
    requirement: 999,
    animation_type: "trophy_large",
  },
];

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

// Rich user: 5 windowed sessions (4 completed + 1 in progress), 27 attempts
// across 4 categories. Lifetime completed COUNT is 9 — deliberately different
// from the 4 completed sessions in the window.
const RICH_SESSIONS = [
  {
    id: "sess-inprog",
    title: "Morning practice",
    created_at: "2026-07-02T08:00:00Z",
    completed_at: null,
    score: null,
    status: "in_progress",
    total_questions: 5,
    total_time_spent: 10,
    quiz_attempts: [
      { question_id: "q6", is_correct: true, time_spent: 10, attempted_at: "2026-07-02T08:05:00Z" },
    ],
  },
  {
    id: "sess-recent",
    title: "Mixed quiz",
    created_at: "2026-07-01T10:00:00Z",
    completed_at: "2026-07-01T10:30:00Z",
    score: 80,
    status: "completed",
    total_questions: 4,
    total_time_spent: 115,
    quiz_attempts: [
      { question_id: "q1", is_correct: true, time_spent: 30, attempted_at: "2026-07-01T10:05:00Z" },
      {
        question_id: "q2",
        is_correct: false,
        time_spent: 40,
        attempted_at: "2026-07-01T10:10:00Z",
      },
      { question_id: "q3", is_correct: true, time_spent: 20, attempted_at: "2026-07-01T10:15:00Z" },
      { question_id: "q4", is_correct: true, time_spent: 25, attempted_at: "2026-07-01T10:20:00Z" },
    ],
  },
  {
    id: "sess-chem",
    title: "Chem drill",
    created_at: "2026-06-26T10:00:00Z",
    completed_at: "2026-06-26T10:20:00Z",
    score: 30,
    status: "completed",
    total_questions: 10,
    total_time_spent: 50,
    // 10 attempts, 3 correct → 30% accuracy with >= 10 attempts → needsImprovement
    quiz_attempts: range(10).map((i) => ({
      question_id: "q8",
      is_correct: i < 3,
      time_spent: 5,
      attempted_at: `2026-06-26T10:0${i}:00Z`,
    })),
  },
  {
    id: "sess-derm",
    title: "Derm drill",
    created_at: "2026-06-25T10:00:00Z",
    completed_at: "2026-06-25T10:30:00Z",
    score: 90,
    status: "completed",
    total_questions: 10,
    total_time_spent: 100,
    // 10 attempts, 9 correct → 90% accuracy with >= 10 attempts → mastered
    quiz_attempts: range(10).map((i) => ({
      question_id: "q7",
      is_correct: i < 9,
      time_spent: 10,
      attempted_at: `2026-06-25T10:0${i}:00Z`,
    })),
  },
  {
    id: "sess-old",
    title: "Old quiz",
    created_at: "2026-06-20T09:00:00Z",
    completed_at: "2026-06-20T09:30:00Z",
    score: 50,
    status: "completed",
    total_questions: 2,
    total_time_spent: 50,
    quiz_attempts: [
      {
        question_id: "q1",
        is_correct: false,
        time_spent: 35,
        attempted_at: "2026-06-20T09:05:00Z",
      },
      { question_id: "q5", is_correct: true, time_spent: 15, attempted_at: "2026-06-20T09:10:00Z" },
    ],
  },
];

const RICH_FIXTURE: MockFixture = {
  sessions: RICH_SESSIONS,
  lifetimeCompletedCount: 9, // != 4 windowed completed sessions — pins the COUNT path
  questions: QUESTION_ROWS,
  categories: CATEGORY_ROWS,
  timelineRows: [
    { completed_at: "2026-06-20T09:30:00Z", score: 50 },
    { completed_at: "2026-06-25T10:30:00Z", score: 90 },
    { completed_at: "2026-06-26T10:20:00Z", score: 30 },
    { completed_at: "2026-07-01T10:30:00Z", score: 80 },
    { completed_at: "2026-07-01T18:00:00Z", score: 100 },
  ],
  // Strings mimic bigint from Postgres; the route must Number() them
  heatmapRows: [
    { date: "2026-06-28", quizzes: "1", questions: "10" },
    { date: "2026-06-29", quizzes: "0", questions: "0" },
    { date: "2026-06-30", quizzes: "2", questions: "20" },
    { date: "2026-07-01", quizzes: "1", questions: "5" },
    { date: "2026-07-02", quizzes: "1", questions: "4" },
  ],
  achievementRows: DB_ACHIEVEMENT_DEFINITIONS,
  userAchievements: [{ id: "ua-1", achievement_id: "quiz-5", created_at: "2026-06-25T11:00:00Z" }],
  categoryStatsRows: [
    {
      category_id: "cat-a",
      all_count: 50,
      unused_count: 30,
      incorrect_count: 5,
      marked_count: 2,
      correct_count: 15,
    },
    {
      category_id: "cat-b",
      all_count: 60,
      unused_count: 50,
      incorrect_count: 6,
      marked_count: 3,
      correct_count: 4,
    },
    {
      category_id: "cat-c",
      all_count: 40,
      unused_count: 20,
      incorrect_count: 4,
      marked_count: 1,
      correct_count: 10,
    },
    {
      category_id: "cat-d",
      all_count: 30,
      unused_count: 25,
      incorrect_count: 3,
      marked_count: 0,
      correct_count: 2,
    },
  ],
  percentileRows: [{ percentile: 62, rank: 12, total_users: "500" }],
};

const ZERO_STATS = { all: 0, unused: 0, needsReview: 0, marked: 0, mastered: 0 };

describe("GET /api/user/performance-data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ now: FIXED_NOW, toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Authentication", () => {
    it("returns 401 when user is not authenticated", async () => {
      mockClients({});

      const request = createMockRequest({ method: "GET", url: ROUTE_URL });
      const response = await GET(request);
      const json = await getResponseJson(response);

      expect(response.status).toBe(401);
      expect(json.error).toBe("Unauthorized");
    });
  });

  describe("Rich user (multiple sessions, mixed correctness, multiple categories)", () => {
    it("returns the full computed response", async () => {
      mockClients(RICH_FIXTURE);

      const request = createAuthenticatedRequest(USER_ID, { method: "GET", url: ROUTE_URL });
      const response = await GET(request);
      const json = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(json).toEqual({
        success: true,
        data: {
          summary: {
            // 17 correct of 27 attempts → round(62.96) = 63
            overallScore: 63,
            // Lifetime COUNT query result — NOT the 4 completed windowed sessions
            completedQuizzes: 9,
            totalAttempts: 27,
            correctAttempts: 17,
            userPercentile: 62,
            peerRank: 12,
            totalUsers: 500,
          },
          subjects: {
            needsImprovement: [{ name: "Chemistry", score: 30, attempts: 10 }],
            mastered: [{ name: "Cytopathology (CYTO)", score: 90, attempts: 10 }],
          },
          timeline: [
            { date: "2026-06-20", accuracy: 50, quizzes: 1 },
            { date: "2026-06-25", accuracy: 90, quizzes: 1 },
            { date: "2026-06-26", accuracy: 30, quizzes: 1 },
            // Two quizzes that day: (80 + 100) / 2
            { date: "2026-07-01", accuracy: 90, quizzes: 2 },
          ],
          categories: [
            {
              category_id: "cat-a",
              category_name: "Dermatopathology (DP)",
              total_attempts: 4,
              correct_attempts: 2,
              accuracy: 50,
              average_time: 29, // round(115 / 4)
              last_attempt_at: "2026-07-02T08:05:00Z",
              recent_performance: [
                { date: "2026-07-02", accuracy: 100, questions_answered: 1 },
                { date: "2026-07-01", accuracy: 50, questions_answered: 2 },
                { date: "2026-06-20", accuracy: 0, questions_answered: 1 },
              ],
              trend: "stable",
            },
            {
              category_id: "cat-b",
              category_name: "Hematopathology",
              total_attempts: 3,
              correct_attempts: 3,
              accuracy: 100,
              average_time: 20,
              last_attempt_at: "2026-07-01T10:20:00Z",
              recent_performance: [
                { date: "2026-07-01", accuracy: 100, questions_answered: 2 },
                { date: "2026-06-20", accuracy: 100, questions_answered: 1 },
              ],
              trend: "stable",
            },
            {
              category_id: "cat-d",
              category_name: "Chemistry",
              total_attempts: 10,
              correct_attempts: 3,
              accuracy: 30,
              average_time: 5,
              last_attempt_at: "2026-06-26T10:09:00Z",
              recent_performance: [{ date: "2026-06-26", accuracy: 30, questions_answered: 10 }],
              trend: "stable",
            },
            {
              category_id: "cat-c",
              category_name: "Cytopathology (CYTO)",
              total_attempts: 10,
              correct_attempts: 9,
              accuracy: 90,
              average_time: 10,
              last_attempt_at: "2026-06-25T10:09:00Z",
              recent_performance: [{ date: "2026-06-25", accuracy: 90, questions_answered: 10 }],
              trend: "stable",
            },
          ],
          heatmap: {
            data: [
              { date: "2026-06-28", quizzes: 1, questions: 10 },
              { date: "2026-06-29", quizzes: 0, questions: 0 },
              { date: "2026-06-30", quizzes: 2, questions: 20 },
              { date: "2026-07-01", quizzes: 1, questions: 5 },
              { date: "2026-07-02", quizzes: 1, questions: 4 },
            ],
            stats: {
              avgQuestionsPerDay: 10, // round(39 / 4)
              avgQuizzesPerDay: "1.3", // (5 / 4).toFixed(1)
              longestStreak: 3,
              currentStreak: 1,
              totalQuestions: 39,
              totalQuizzes: 5,
              daysWithActivity: 4,
            },
          },
          achievements: {
            stats: {
              totalQuizzes: 9, // lifetime COUNT, not windowed
              perfectScores: 0,
              currentStreak: 1,
              longestStreak: 3,
              accuracyOver3: 67, // round((80 + 30 + 90) / 3)
              accuracyOver5: 0, // only 4 completed sessions in window
              accuracyOver8: 0,
              accuracyOver10: 0,
              accuracyOver12: 0,
              accuracyOver15: 0,
              subjectsWith10Questions: 0,
              subjectsWith25Questions: 0,
              subjectsWith50Questions: 0,
              subjectsWith100Questions: 0,
              totalCategories: 4,
            },
            definitions: DB_ACHIEVEMENT_DEFINITIONS,
            progress: [
              {
                id: "quiz-5",
                requirement: 5,
                isUnlocked: true,
                progress: 5,
                unlockedDate: "2026-06-25T11:00:00Z",
              },
              { id: "perfect-1", requirement: 1, isUnlocked: false, progress: 0 },
              { id: "streak-3", requirement: 3, isUnlocked: false, progress: 3 },
              { id: "speed-10in6", requirement: 1, isUnlocked: false, progress: 0 },
              { id: "accuracy-50-3", requirement: 50, isUnlocked: false, progress: 50 },
              // requirement dynamically rewritten to totalCategories
              { id: "differential-100-all", requirement: 4, isUnlocked: false, progress: 0 },
            ],
          },
          dashboard: {
            allQuestions: 180,
            needsReview: 18,
            mastered: 31,
            unused: 125,
            totalQuestions: 180,
            completedQuestions: 55, // 180 - 125
            averageScore: 63,
            studyStreak: 1,
            recentQuizzes: 4, // windowed completed sessions
            weeklyGoal: 50,
            currentWeekProgress: 4,
            recentActivity: [
              {
                id: "pending-sess-inprog",
                type: "quiz_started",
                title: "Quiz In Progress",
                description: "Morning practice",
                timestamp: "2026-07-02T08:00:00Z",
                navigationUrl: "/dashboard/quiz/sess-inprog",
              },
              {
                id: "session-sess-recent",
                type: "quiz_completed",
                title: "Completed Quiz",
                description: "View detailed results",
                timestamp: "2026-07-01T10:30:00Z",
                score: 80,
                navigationUrl: "/dashboard/quiz/sess-recent/results",
              },
              {
                id: "session-sess-chem",
                type: "quiz_completed",
                title: "Completed Quiz",
                description: "View detailed results",
                timestamp: "2026-06-26T10:20:00Z",
                score: 30,
                navigationUrl: "/dashboard/quiz/sess-chem/results",
              },
              {
                id: "achievement-ua-1",
                type: "achievement_unlocked",
                title: "Achievement Unlocked: Junior Resident",
                description: "Complete 5 quizzes",
                timestamp: "2026-06-25T11:00:00Z",
                navigationUrl: "/dashboard/progress#achievements",
              },
              {
                id: "session-sess-derm",
                type: "quiz_completed",
                title: "Completed Quiz",
                description: "View detailed results",
                timestamp: "2026-06-25T10:30:00Z",
                score: 90,
                navigationUrl: "/dashboard/quiz/sess-derm/results",
              },
              {
                id: "session-sess-old",
                type: "quiz_completed",
                title: "Completed Quiz",
                description: "View detailed results",
                timestamp: "2026-06-20T09:30:00Z",
                score: 50,
                navigationUrl: "/dashboard/quiz/sess-old/results",
              },
            ],
          },
          quizInit: {
            sessionTitles: [
              "Morning practice",
              "Mixed quiz",
              "Chem drill",
              "Derm drill",
              "Old quiz",
            ],
            categories: [
              {
                id: "cat-d",
                name: "Chemistry",
                shortName: "CHEM",
                parent: "CP",
                questionStats: { all: 30, unused: 25, needsReview: 3, marked: 0, mastered: 2 },
              },
              {
                id: "cat-c",
                name: "Cytopathology (CYTO)",
                shortName: "CYTO", // extracted from parentheses (no short_form)
                parent: "AP",
                questionStats: { all: 40, unused: 20, needsReview: 4, marked: 1, mastered: 10 },
              },
              {
                id: "cat-a",
                name: "Dermatopathology (DP)",
                shortName: "DP",
                parent: "AP",
                questionStats: { all: 50, unused: 30, needsReview: 5, marked: 2, mastered: 15 },
              },
              {
                id: "cat-b",
                name: "Hematopathology",
                shortName: "H", // initials fallback (no short_form, no parentheses)
                parent: "CP",
                questionStats: { all: 60, unused: 50, needsReview: 6, marked: 3, mastered: 4 },
              },
            ],
            questionTypeStats: {
              all: { all: 180, unused: 125, needsReview: 18, marked: 6, mastered: 31 },
              ap_only: { all: 90, unused: 50, needsReview: 9, marked: 3, mastered: 25 },
              cp_only: { all: 90, unused: 75, needsReview: 9, marked: 3, mastered: 6 },
            },
          },
        },
      });
    });

    it("takes completedQuizzes from the lifetime COUNT query, not the windowed sessions array", async () => {
      mockClients(RICH_FIXTURE);

      const request = createAuthenticatedRequest(USER_ID, { method: "GET", url: ROUTE_URL });
      const json = await getResponseJson(await GET(request));

      const windowedCompleted = RICH_SESSIONS.filter((s) => s.status === "completed").length;
      expect(windowedCompleted).toBe(4);
      expect(json.data.summary.completedQuizzes).toBe(9);
      expect(json.data.summary.completedQuizzes).not.toBe(windowedCompleted);
      expect(json.data.achievements.stats.totalQuizzes).toBe(9);
      // The windowed count still feeds recentQuizzes / currentWeekProgress
      expect(json.data.dashboard.recentQuizzes).toBe(windowedCompleted);
      expect(json.data.dashboard.currentWeekProgress).toBe(windowedCompleted);
    });

    it("calls the percentile RPC through the service-role client with the computed avg score", async () => {
      const { adminRpc } = mockClients(RICH_FIXTURE);

      const request = createAuthenticatedRequest(USER_ID, { method: "GET", url: ROUTE_URL });
      await GET(request);

      // avg of completed windowed scores: round((80 + 30 + 90 + 50) / 4) = 63
      expect(adminRpc).toHaveBeenCalledWith("get_user_percentile", {
        p_user_id: USER_ID,
        p_avg_score: 63,
      });
    });
  });

  describe("Zero-value user (percentile 0, rank 0, zero-score session)", () => {
    const ZERO_FIXTURE: MockFixture = {
      sessions: [
        {
          id: "sess-zero",
          title: "Zero quiz",
          created_at: "2026-07-01T10:00:00Z",
          completed_at: "2026-07-01T10:30:00Z",
          score: 0,
          status: "completed",
          total_questions: 2,
          total_time_spent: 20,
          quiz_attempts: [
            {
              question_id: "q1",
              is_correct: false,
              time_spent: 10,
              attempted_at: "2026-07-01T10:05:00Z",
            },
            {
              question_id: "q2",
              is_correct: false,
              time_spent: 10,
              attempted_at: "2026-07-01T10:10:00Z",
            },
          ],
        },
      ],
      lifetimeCompletedCount: 1,
      questions: QUESTION_ROWS,
      categories: CATEGORY_ROWS,
      timelineRows: [{ completed_at: "2026-07-01T10:30:00Z", score: 0 }],
      heatmapRows: [],
      achievementRows: DB_ACHIEVEMENT_DEFINITIONS,
      userAchievements: [],
      categoryStatsRows: [],
      // Bottom of the pool: percentile 0 and rank 0 are legitimate values
      percentileRows: [{ percentile: 0, rank: 0, total_users: 1 }],
    };

    it("preserves percentile=0 and rank=0 (?? semantics — no || defaults)", async () => {
      mockClients(ZERO_FIXTURE);

      const request = createAuthenticatedRequest(USER_ID, { method: "GET", url: ROUTE_URL });
      const json = await getResponseJson(await GET(request));

      expect(json.data.summary.userPercentile).toBe(0);
      expect(json.data.summary.peerRank).toBe(0);
      expect(json.data.summary.totalUsers).toBe(1);
    });

    it("returns the full computed response with zero scores intact", async () => {
      mockClients(ZERO_FIXTURE);

      const request = createAuthenticatedRequest(USER_ID, { method: "GET", url: ROUTE_URL });
      const response = await GET(request);
      const json = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(json).toEqual({
        success: true,
        data: {
          summary: {
            overallScore: 0,
            completedQuizzes: 1,
            totalAttempts: 2,
            correctAttempts: 0,
            userPercentile: 0,
            peerRank: 0,
            totalUsers: 1,
          },
          subjects: { needsImprovement: [], mastered: [] },
          timeline: [{ date: "2026-07-01", accuracy: 0, quizzes: 1 }],
          categories: [
            {
              category_id: "cat-a",
              category_name: "Dermatopathology (DP)",
              total_attempts: 2,
              correct_attempts: 0,
              accuracy: 0,
              average_time: 10,
              last_attempt_at: "2026-07-01T10:10:00Z",
              recent_performance: [{ date: "2026-07-01", accuracy: 0, questions_answered: 2 }],
              trend: "stable",
            },
          ],
          heatmap: {
            data: [],
            stats: {
              avgQuestionsPerDay: 0,
              avgQuizzesPerDay: "0",
              longestStreak: 0,
              currentStreak: 0,
              totalQuestions: 0,
              totalQuizzes: 0,
              daysWithActivity: 0,
            },
          },
          achievements: {
            stats: {
              totalQuizzes: 1,
              perfectScores: 0,
              currentStreak: 0,
              longestStreak: 0,
              accuracyOver3: 0,
              accuracyOver5: 0,
              accuracyOver8: 0,
              accuracyOver10: 0,
              accuracyOver12: 0,
              accuracyOver15: 0,
              subjectsWith10Questions: 0,
              subjectsWith25Questions: 0,
              subjectsWith50Questions: 0,
              subjectsWith100Questions: 0,
              totalCategories: 1,
            },
            definitions: DB_ACHIEVEMENT_DEFINITIONS,
            progress: [
              { id: "quiz-5", requirement: 5, isUnlocked: false, progress: 1 },
              { id: "perfect-1", requirement: 1, isUnlocked: false, progress: 0 },
              { id: "streak-3", requirement: 3, isUnlocked: false, progress: 0 },
              { id: "speed-10in6", requirement: 1, isUnlocked: false, progress: 0 },
              { id: "accuracy-50-3", requirement: 50, isUnlocked: false, progress: 0 },
              { id: "differential-100-all", requirement: 1, isUnlocked: false, progress: 0 },
            ],
          },
          dashboard: {
            allQuestions: 0,
            needsReview: 0,
            mastered: 0,
            unused: 0,
            totalQuestions: 0,
            completedQuestions: 0,
            averageScore: 0,
            studyStreak: 0,
            recentQuizzes: 1,
            weeklyGoal: 50,
            currentWeekProgress: 1,
            recentActivity: [
              {
                id: "session-sess-zero",
                type: "quiz_completed",
                title: "Completed Quiz",
                description: "View detailed results",
                timestamp: "2026-07-01T10:30:00Z",
                score: 0,
                navigationUrl: "/dashboard/quiz/sess-zero/results",
              },
            ],
          },
          quizInit: {
            sessionTitles: ["Zero quiz"],
            categories: [
              {
                id: "cat-d",
                name: "Chemistry",
                shortName: "CHEM",
                parent: "CP",
                questionStats: ZERO_STATS,
              },
              {
                id: "cat-c",
                name: "Cytopathology (CYTO)",
                shortName: "CYTO",
                parent: "AP",
                questionStats: ZERO_STATS,
              },
              {
                id: "cat-a",
                name: "Dermatopathology (DP)",
                shortName: "DP",
                parent: "AP",
                questionStats: ZERO_STATS,
              },
              {
                id: "cat-b",
                name: "Hematopathology",
                shortName: "H",
                parent: "CP",
                questionStats: ZERO_STATS,
              },
            ],
            questionTypeStats: {
              all: ZERO_STATS,
              ap_only: ZERO_STATS,
              cp_only: ZERO_STATS,
            },
          },
        },
      });
    });
  });

  describe("Empty user (no sessions at all)", () => {
    const EMPTY_FIXTURE: MockFixture = {
      sessions: [],
      lifetimeCompletedCount: 0,
      questions: [],
      categories: CATEGORY_ROWS,
      timelineRows: [],
      heatmapRows: [],
      achievementRows: null, // DB fetch "fails" → falls back to ACHIEVEMENT_DEFINITIONS
      userAchievements: [],
      categoryStatsRows: [],
      percentileRows: null, // RPC returns nothing → 50 / 50 / 100 defaults apply
    };

    it("returns the default/empty response shape", async () => {
      mockClients(EMPTY_FIXTURE);

      const request = createAuthenticatedRequest(USER_ID, { method: "GET", url: ROUTE_URL });
      const response = await GET(request);
      const json = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(json).toEqual({
        success: true,
        data: {
          summary: {
            overallScore: 0,
            completedQuizzes: 0,
            totalAttempts: 0,
            correctAttempts: 0,
            userPercentile: 50,
            peerRank: 50,
            totalUsers: 100,
          },
          subjects: { needsImprovement: [], mastered: [] },
          timeline: [],
          categories: [],
          heatmap: {
            data: [],
            stats: {
              avgQuestionsPerDay: 0,
              avgQuizzesPerDay: "0",
              longestStreak: 0,
              currentStreak: 0,
              totalQuestions: 0,
              totalQuizzes: 0,
              daysWithActivity: 0,
            },
          },
          achievements: {
            stats: {
              totalQuizzes: 0,
              perfectScores: 0,
              currentStreak: 0,
              longestStreak: 0,
              accuracyOver3: 0,
              accuracyOver5: 0,
              accuracyOver8: 0,
              accuracyOver10: 0,
              accuracyOver12: 0,
              accuracyOver15: 0,
              subjectsWith10Questions: 0,
              subjectsWith25Questions: 0,
              subjectsWith50Questions: 0,
              subjectsWith100Questions: 0,
              totalCategories: 0,
            },
            // Fallback to the hardcoded definitions (camelCase animationType)
            definitions: ACHIEVEMENT_DEFINITIONS.map((d) => ({
              id: d.id,
              title: d.title,
              description: d.description,
              category: d.category,
              requirement: d.requirement,
              animation_type: d.animationType,
            })),
            progress: ACHIEVEMENT_DEFINITIONS.map((d) => ({
              id: d.id,
              requirement: d.requirement,
              isUnlocked: false,
              progress: 0,
            })),
          },
          dashboard: {
            allQuestions: 0,
            needsReview: 0,
            mastered: 0,
            unused: 0,
            totalQuestions: 0,
            completedQuestions: 0,
            averageScore: 0,
            studyStreak: 0,
            recentQuizzes: 0,
            weeklyGoal: 50,
            currentWeekProgress: 0,
            recentActivity: [
              {
                id: "welcome-1",
                type: "welcome",
                title: "Start Your First Quiz",
                description: "Take a quick starter quiz to see how we track your progress.",
                timestamp: FIXED_NOW.toISOString(),
              },
            ],
          },
          quizInit: {
            sessionTitles: [],
            categories: [
              {
                id: "cat-d",
                name: "Chemistry",
                shortName: "CHEM",
                parent: "CP",
                questionStats: ZERO_STATS,
              },
              {
                id: "cat-c",
                name: "Cytopathology (CYTO)",
                shortName: "CYTO",
                parent: "AP",
                questionStats: ZERO_STATS,
              },
              {
                id: "cat-a",
                name: "Dermatopathology (DP)",
                shortName: "DP",
                parent: "AP",
                questionStats: ZERO_STATS,
              },
              {
                id: "cat-b",
                name: "Hematopathology",
                shortName: "H",
                parent: "CP",
                questionStats: ZERO_STATS,
              },
            ],
            questionTypeStats: {
              all: ZERO_STATS,
              ap_only: ZERO_STATS,
              cp_only: ZERO_STATS,
            },
          },
        },
      });
    });
  });

  describe("Error handling", () => {
    it("returns 500 when the sessions query fails", async () => {
      mockClients({ sessionsError: { message: "Database error" } });

      const request = createAuthenticatedRequest(USER_ID, { method: "GET", url: ROUTE_URL });
      const response = await GET(request);
      const json = await getResponseJson(response);

      expect(response.status).toBe(500);
      expect(json.error).toBe("Failed to fetch performance data");
    });
  });
});
