/**
 * Quiz Completion and Results API Tests
 *
 * Tests for POST /api/user/quiz/sessions/[id]/complete (complete quiz)
 * Tests for GET /api/user/quiz/sessions/[id]/results (get results)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "@/app/api/user/quiz/sessions/[id]/complete/route";
import { GET } from "@/app/api/user/quiz/sessions/[id]/results/route";
import {
  createAuthenticatedRequest,
  createMockRequest,
  getResponseJson,
  createMockQuizResultData,
  createMockAnswerSubmission,
} from "./api-test-helpers";

// Mock dependencies
vi.mock("@/shared/services/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/features/user/quiz/services/quiz-service", () => ({
  quizService: {
    getQuizSession: vi.fn(),
    completeQuiz: vi.fn(),
    getQuizResults: vi.fn(),
  },
}));

vi.mock("@/features/user/quiz/services/analytics-service", () => ({
  quizAnalyticsService: {
    updateQuizSessionAnalytics: vi.fn(),
  },
}));

vi.mock("@/features/user/achievements/services/achievement-service.server", () => ({
  awardAchievements: vi.fn(),
  getRecentUnshownAchievements: vi.fn(),
}));

import { createClient } from "@/shared/services/server";
import { quizService } from "@/features/user/quiz/services/quiz-service";
import { quizAnalyticsService } from "@/features/user/quiz/services/analytics-service";
import {
  awardAchievements,
  getRecentUnshownAchievements,
} from "@/features/user/achievements/services/achievement-service.server";

describe("POST /api/user/quiz/sessions/[id]/complete (Complete Quiz)", () => {
  const mockUserId = "test-user-123";
  const mockSessionId = "session-456";
  const mockParams = Promise.resolve({ id: mockSessionId });
  let mockQuery: any;
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockQuery = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: [], error: null }),
      single: vi.fn().mockResolvedValue({
        data: {
          user_id: mockUserId,
          status: "in_progress",
        },
        error: null,
      }),
    };

    mockSupabase = {
      from: vi.fn().mockReturnValue(mockQuery),
      auth: { getUser: vi.fn() },
    };

    (createClient as any).mockResolvedValue(mockSupabase);
    (quizAnalyticsService.updateQuizSessionAnalytics as any).mockResolvedValue(undefined);
    (awardAchievements as any).mockResolvedValue({
      newAchievements: [],
      metadata: {},
    });
  });

  describe("Authentication", () => {
    it("should return 401 when user is not authenticated", async () => {
      const request = createMockRequest({
        method: "POST",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}/complete`,
        body: {},
      });

      const response = await POST(request, { params: mockParams });
      const json = await getResponseJson(response);

      expect(response.status).toBe(401);
      expect(json.error).toBe("Unauthorized");
    });
  });

  describe("Authorization", () => {
    it("should return 404 when quiz session not found", async () => {
      mockQuery.single.mockResolvedValue({ data: null, error: { message: "Not found" } });

      const request = createAuthenticatedRequest(mockUserId, {
        method: "POST",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}/complete`,
        body: {},
      });

      const response = await POST(request, { params: mockParams });
      const json = await getResponseJson(response);

      expect(response.status).toBe(404);
      expect(json.error).toBe("Quiz session not found");
    });

    it("should return 403 when user tries to complete another user's quiz", async () => {
      mockQuery.single.mockResolvedValue({
        data: {
          user_id: "different-user-789",
          status: "in_progress",
        },
        error: null,
      });

      const request = createAuthenticatedRequest(mockUserId, {
        method: "POST",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}/complete`,
        body: {},
      });

      const response = await POST(request, { params: mockParams });
      const json = await getResponseJson(response);

      expect(response.status).toBe(403);
      expect(json.error).toContain("Forbidden");
    });
  });

  describe("Idempotency", () => {
    it("should return existing results if quiz already completed", async () => {
      mockQuery.single.mockResolvedValue({
        data: {
          user_id: mockUserId,
          status: "completed",
        },
        error: null,
      });

      const mockResults = createMockQuizResultData();
      (quizService.getQuizResults as any).mockResolvedValue(mockResults);

      const request = createAuthenticatedRequest(mockUserId, {
        method: "POST",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}/complete`,
        body: {},
      });

      const response = await POST(request, { params: mockParams });
      const json = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.message).toContain("already completed");
      expect(json.data).toEqual(mockResults);
    });
  });

  describe("Successful Completion", () => {
    it("should complete quiz without answers", async () => {
      const mockResults = createMockQuizResultData({
        score: 80,
        totalQuestions: 10,
        correctAnswers: 8,
        totalTimeSpent: 300,
      });

      (quizService.completeQuiz as any).mockResolvedValue(mockResults);

      const request = createAuthenticatedRequest(mockUserId, {
        method: "POST",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}/complete`,
        body: {},
      });

      const response = await POST(request, { params: mockParams });
      const json = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toEqual(mockResults);
      expect(quizService.completeQuiz).toHaveBeenCalledWith(mockSessionId, mockSupabase);
    });

    it("should complete quiz with final answers", async () => {
      const answers = [
        createMockAnswerSubmission({ questionId: "q-9" }),
        createMockAnswerSubmission({ questionId: "q-10" }),
      ];

      const mockResults = createMockQuizResultData();
      (quizService.completeQuiz as any).mockResolvedValue(mockResults);

      const request = createAuthenticatedRequest(mockUserId, {
        method: "POST",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}/complete`,
        body: { answers },
      });

      const response = await POST(request, { params: mockParams });
      const json = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith("quiz_attempts");
    });

    it("should prevent duplicate answer submissions during completion", async () => {
      // Mock existing attempts
      mockQuery.in.mockResolvedValue({
        data: [{ question_id: "q-9" }],
        error: null,
      });

      mockQuery.insert = vi.fn().mockReturnThis();

      const answers = [
        createMockAnswerSubmission({ questionId: "q-9" }), // Already exists
        createMockAnswerSubmission({ questionId: "q-10" }), // New
      ];

      const mockResults = createMockQuizResultData();
      (quizService.completeQuiz as any).mockResolvedValue(mockResults);

      const request = createAuthenticatedRequest(mockUserId, {
        method: "POST",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}/complete`,
        body: { answers },
      });

      const response = await POST(request, { params: mockParams });

      expect(response.status).toBe(200);
      // Should only insert q-10, not q-9
      expect(mockQuery.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            question_id: "q-10",
          }),
        ])
      );
    });
  });

  describe("Analytics Update", () => {
    it("should update analytics after completion", async () => {
      const mockResults = createMockQuizResultData();
      (quizService.completeQuiz as any).mockResolvedValue(mockResults);

      const request = createAuthenticatedRequest(mockUserId, {
        method: "POST",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}/complete`,
        body: {},
      });

      const response = await POST(request, { params: mockParams });

      expect(response.status).toBe(200);
      expect(quizAnalyticsService.updateQuizSessionAnalytics).toHaveBeenCalledWith(
        mockSessionId,
        expect.anything()
      );
    });

    it("should not fail completion if analytics update fails", async () => {
      const mockResults = createMockQuizResultData();
      (quizService.completeQuiz as any).mockResolvedValue(mockResults);
      (quizAnalyticsService.updateQuizSessionAnalytics as any).mockRejectedValue(
        new Error("Analytics error")
      );

      const request = createAuthenticatedRequest(mockUserId, {
        method: "POST",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}/complete`,
        body: {},
      });

      const response = await POST(request, { params: mockParams });

      expect(response.status).toBe(200);
      expect(quizAnalyticsService.updateQuizSessionAnalytics).toHaveBeenCalled();
    });
  });

  describe("Achievement Awarding", () => {
    it("should award achievements based on client-provided IDs", async () => {
      const mockResults = createMockQuizResultData();
      (quizService.completeQuiz as any).mockResolvedValue(mockResults);

      const clientAchievementIds = ["achievement-1", "achievement-2"];
      const mockNewAchievements = [
        { id: "achievement-1", title: "First Quiz" },
        { id: "achievement-2", title: "Quiz Master" },
      ];

      (awardAchievements as any).mockResolvedValue({
        newAchievements: mockNewAchievements,
        metadata: { totalQuizzes: 10 },
      });

      const request = createAuthenticatedRequest(mockUserId, {
        method: "POST",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}/complete`,
        body: { achievementIds: clientAchievementIds },
      });

      const response = await POST(request, { params: mockParams });
      const json = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(awardAchievements).toHaveBeenCalledWith(mockUserId, clientAchievementIds);
      expect(json.newAchievements).toEqual(mockNewAchievements);
      expect(json.metadata).toEqual({ totalQuizzes: 10 });
    });

    it("should award achievements with empty array when none provided", async () => {
      const mockResults = createMockQuizResultData();
      (quizService.completeQuiz as any).mockResolvedValue(mockResults);

      (awardAchievements as any).mockResolvedValue({
        newAchievements: [],
        metadata: {},
      });

      const request = createAuthenticatedRequest(mockUserId, {
        method: "POST",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}/complete`,
        body: {},
      });

      const response = await POST(request, { params: mockParams });
      const json = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(awardAchievements).toHaveBeenCalledWith(mockUserId, []);
      expect(json.newAchievements).toEqual([]);
    });

    it("should not fail completion if achievement check fails", async () => {
      const mockResults = createMockQuizResultData();
      (quizService.completeQuiz as any).mockResolvedValue(mockResults);
      (awardAchievements as any).mockRejectedValue(new Error("Achievement error"));

      const request = createAuthenticatedRequest(mockUserId, {
        method: "POST",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}/complete`,
        body: {},
      });

      const response = await POST(request, { params: mockParams });

      expect(response.status).toBe(200);
    });
  });

  describe("Error Handling", () => {
    it("should return 400 when result is invalid", async () => {
      (quizService.completeQuiz as any).mockResolvedValue({
        // Missing required properties
        sessionId: mockSessionId,
      });

      const request = createAuthenticatedRequest(mockUserId, {
        method: "POST",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}/complete`,
        body: {},
      });

      const response = await POST(request, { params: mockParams });
      const json = await getResponseJson(response);

      expect(response.status).toBe(400);
      expect(json.error).toContain("Invalid quiz completion result");
    });

    it("should return 400 when service throws an Error", async () => {
      (quizService.completeQuiz as any).mockRejectedValue(new Error("Failed to calculate score"));

      const request = createAuthenticatedRequest(mockUserId, {
        method: "POST",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}/complete`,
        body: {},
      });

      const response = await POST(request, { params: mockParams });
      const json = await getResponseJson(response);

      expect(response.status).toBe(400);
      expect(json.error).toBe("Failed to calculate score");
    });

    it("should return 500 when service throws unknown error", async () => {
      (quizService.completeQuiz as any).mockRejectedValue("Unknown error");

      const request = createAuthenticatedRequest(mockUserId, {
        method: "POST",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}/complete`,
        body: {},
      });

      const response = await POST(request, { params: mockParams });
      const json = await getResponseJson(response);

      expect(response.status).toBe(500);
      expect(json.error).toBe("Failed to complete quiz");
    });
  });
});

describe("GET /api/user/quiz/sessions/[id]/results (Get Quiz Results)", () => {
  const mockUserId = "test-user-123";
  const mockSessionId = "session-456";
  const mockParams = Promise.resolve({ id: mockSessionId });
  const mockSupabase = {
    from: vi.fn(),
    auth: { getUser: vi.fn() },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (createClient as any).mockResolvedValue(mockSupabase);
    (getRecentUnshownAchievements as any).mockResolvedValue([]);
  });

  describe("Authentication", () => {
    it("should return 401 when user is not authenticated", async () => {
      const request = createMockRequest({
        method: "GET",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}/results`,
      });

      const response = await GET(request, { params: mockParams });
      const json = await getResponseJson(response);

      expect(response.status).toBe(401);
      expect(json.error).toBe("Unauthorized");
    });
  });

  describe("Authorization", () => {
    it("should return 404 when quiz session not found", async () => {
      (quizService.getQuizSession as any).mockResolvedValue(null);

      const request = createAuthenticatedRequest(mockUserId, {
        method: "GET",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}/results`,
      });

      const response = await GET(request, { params: mockParams });
      const json = await getResponseJson(response);

      expect(response.status).toBe(404);
      expect(json.error).toBe("Quiz session not found");
    });

    it("should return 403 when user tries to access another user's results", async () => {
      const mockSession = {
        id: mockSessionId,
        userId: "different-user-789",
        status: "completed",
      };

      (quizService.getQuizSession as any).mockResolvedValue(mockSession);

      const request = createAuthenticatedRequest(mockUserId, {
        method: "GET",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}/results`,
      });

      const response = await GET(request, { params: mockParams });
      const json = await getResponseJson(response);

      expect(response.status).toBe(403);
      expect(json.error).toContain("Forbidden");
    });
  });

  describe("Results Not Available", () => {
    it("should return 404 when results are not available", async () => {
      const mockSession = {
        id: mockSessionId,
        userId: mockUserId,
        status: "in_progress",
      };

      (quizService.getQuizSession as any).mockResolvedValue(mockSession);
      (quizService.getQuizResults as any).mockResolvedValue(null);

      const request = createAuthenticatedRequest(mockUserId, {
        method: "GET",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}/results`,
      });

      const response = await GET(request, { params: mockParams });
      const json = await getResponseJson(response);

      expect(response.status).toBe(404);
      expect(json.error).toContain("Quiz results not available");
    });
  });

  describe("Successful Fetch", () => {
    it("should return quiz results", async () => {
      const mockSession = {
        id: mockSessionId,
        userId: mockUserId,
        status: "completed",
      };

      const mockResults = createMockQuizResultData({
        sessionId: mockSessionId,
        score: 80,
        totalQuestions: 10,
        correctAnswers: 8,
        completedAt: "2024-01-01T00:00:00Z",
      });

      (quizService.getQuizSession as any).mockResolvedValue(mockSession);
      (quizService.getQuizResults as any).mockResolvedValue(mockResults);

      const request = createAuthenticatedRequest(mockUserId, {
        method: "GET",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}/results`,
      });

      const response = await GET(request, { params: mockParams });
      const json = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toMatchObject({
        sessionId: mockSessionId,
        score: 80,
        totalQuestions: 10,
        correctAnswers: 8,
      });
    });

    it("should include recent unshown achievements", async () => {
      const mockSession = {
        id: mockSessionId,
        userId: mockUserId,
        status: "completed",
      };

      const mockResults = createMockQuizResultData({
        completedAt: "2024-01-01T00:00:00Z",
      });

      const mockAchievements = [
        { id: "ach-1", title: "Achievement 1" },
        { id: "ach-2", title: "Achievement 2" },
      ];

      (quizService.getQuizSession as any).mockResolvedValue(mockSession);
      (quizService.getQuizResults as any).mockResolvedValue(mockResults);
      (getRecentUnshownAchievements as any).mockResolvedValue(mockAchievements);

      const request = createAuthenticatedRequest(mockUserId, {
        method: "GET",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}/results`,
      });

      const response = await GET(request, { params: mockParams });
      const json = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(json.data.newAchievements).toEqual(mockAchievements);
      expect(getRecentUnshownAchievements).toHaveBeenCalledWith(mockUserId, "2024-01-01T00:00:00Z");
    });

    it("should not fail if achievement fetch fails", async () => {
      const mockSession = {
        id: mockSessionId,
        userId: mockUserId,
        status: "completed",
      };

      const mockResults = createMockQuizResultData();

      (quizService.getQuizSession as any).mockResolvedValue(mockSession);
      (quizService.getQuizResults as any).mockResolvedValue(mockResults);
      (getRecentUnshownAchievements as any).mockRejectedValue(new Error("Achievement error"));

      const request = createAuthenticatedRequest(mockUserId, {
        method: "GET",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}/results`,
      });

      const response = await GET(request, { params: mockParams });
      const json = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(json.data.newAchievements).toEqual([]);
    });
  });

  describe("Error Handling", () => {
    it("should return 400 when service throws an Error", async () => {
      const mockSession = {
        id: mockSessionId,
        userId: mockUserId,
        status: "completed",
      };

      (quizService.getQuizSession as any).mockResolvedValue(mockSession);
      (quizService.getQuizResults as any).mockRejectedValue(new Error("Failed to fetch results"));

      const request = createAuthenticatedRequest(mockUserId, {
        method: "GET",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}/results`,
      });

      const response = await GET(request, { params: mockParams });
      const json = await getResponseJson(response);

      expect(response.status).toBe(400);
      expect(json.error).toBe("Failed to fetch results");
    });

    it("should return 500 when service throws unknown error", async () => {
      const mockSession = {
        id: mockSessionId,
        userId: mockUserId,
        status: "completed",
      };

      (quizService.getQuizSession as any).mockResolvedValue(mockSession);
      (quizService.getQuizResults as any).mockRejectedValue("Unknown error");

      const request = createAuthenticatedRequest(mockUserId, {
        method: "GET",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}/results`,
      });

      const response = await GET(request, { params: mockParams });
      const json = await getResponseJson(response);

      expect(response.status).toBe(500);
      expect(json.error).toBe("Failed to fetch quiz results");
    });
  });
});
