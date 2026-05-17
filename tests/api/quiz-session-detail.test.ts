/**
 * Quiz Session Detail API Tests
 *
 * Tests for GET /api/user/quiz/sessions/[id] (get session)
 * Tests for PATCH /api/user/quiz/sessions/[id] (update session)
 * Tests for DELETE /api/user/quiz/sessions/[id] (delete session)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, PATCH, DELETE } from "@/app/api/user/quiz/sessions/[id]/route";
import {
  createAuthenticatedRequest,
  createMockRequest,
  getResponseJson,
  createMockAnswerSubmission,
} from "./api-test-helpers";

// Mock dependencies
vi.mock("@/shared/services/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/features/user/quiz/services/quiz-service", () => ({
  quizService: {
    getQuizSession: vi.fn(),
    updateQuizSession: vi.fn(),
    startQuizSession: vi.fn(),
    pauseQuizSession: vi.fn(),
    resumeQuizSession: vi.fn(),
  },
}));

vi.mock("@/shared/utils/auth/auth-helpers", () => ({
  getUserIdFromHeaders: vi.fn(),
}));

import { createClient } from "@/shared/services/server";
import { quizService } from "@/features/user/quiz/services/quiz-service";
import { getUserIdFromHeaders } from "@/shared/utils/auth/auth-helpers";

describe("GET /api/user/quiz/sessions/[id] (Get Quiz Session)", () => {
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
    (getUserIdFromHeaders as any).mockReturnValue(mockUserId);
  });

  describe("Authentication", () => {
    it("should return 401 when user is not authenticated", async () => {
      (getUserIdFromHeaders as any).mockReturnValue(null);

      const request = createMockRequest({
        method: "GET",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}`,
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
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}`,
      });

      const response = await GET(request, { params: mockParams });
      const json = await getResponseJson(response);

      expect(response.status).toBe(404);
      expect(json.error).toBe("Quiz session not found");
    });

    it("should return 403 when user tries to access another user's quiz", async () => {
      const mockSession = {
        id: mockSessionId,
        userId: "different-user-789", // Different user
        title: "Test Quiz",
        status: "in_progress",
      };

      (quizService.getQuizSession as any).mockResolvedValue(mockSession);

      const request = createAuthenticatedRequest(mockUserId, {
        method: "GET",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}`,
      });

      const response = await GET(request, { params: mockParams });
      const json = await getResponseJson(response);

      expect(response.status).toBe(403);
      expect(json.error).toContain("Forbidden");
    });
  });

  describe("Successful Fetch", () => {
    it("should return quiz session when user owns it", async () => {
      const mockSession = {
        id: mockSessionId,
        userId: mockUserId,
        title: "Test Quiz",
        status: "in_progress",
        questions: [],
        config: { mode: "practice" },
      };

      (quizService.getQuizSession as any).mockResolvedValue(mockSession);

      const request = createAuthenticatedRequest(mockUserId, {
        method: "GET",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}`,
      });

      const response = await GET(request, { params: mockParams });
      const json = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.id).toBe(mockSessionId);
      expect(json.data.userId).toBe(mockUserId);
    });
  });

  describe("Error Handling", () => {
    it("should return 500 when service throws error", async () => {
      (quizService.getQuizSession as any).mockRejectedValue(new Error("Database error"));

      const request = createAuthenticatedRequest(mockUserId, {
        method: "GET",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}`,
      });

      const response = await GET(request, { params: mockParams });
      const json = await getResponseJson(response);

      expect(response.status).toBe(500);
      expect(json.error).toBe("Failed to fetch quiz session");
    });
  });
});

describe("PATCH /api/user/quiz/sessions/[id] (Update Quiz Session)", () => {
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
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: [], error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    mockSupabase = {
      from: vi.fn().mockReturnValue(mockQuery),
      auth: { getUser: vi.fn() },
    };

    (createClient as any).mockResolvedValue(mockSupabase);
    (getUserIdFromHeaders as any).mockReturnValue(mockUserId);
  });

  describe("Authentication", () => {
    it("should return 401 when user is not authenticated", async () => {
      (getUserIdFromHeaders as any).mockReturnValue(null);

      const request = createMockRequest({
        method: "PATCH",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}`,
        body: { status: "in_progress" },
      });

      const response = await PATCH(request, { params: mockParams });
      const json = await getResponseJson(response);

      expect(response.status).toBe(401);
      expect(json.error).toBe("Unauthorized");
    });
  });

  describe("Authorization", () => {
    it("should return 404 when quiz session not found", async () => {
      (quizService.getQuizSession as any).mockResolvedValue(null);

      const request = createAuthenticatedRequest(mockUserId, {
        method: "PATCH",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}`,
        body: { status: "in_progress" },
      });

      const response = await PATCH(request, { params: mockParams });
      const json = await getResponseJson(response);

      expect(response.status).toBe(404);
      expect(json.error).toBe("Quiz session not found");
    });

    it("should return 403 when user tries to update another user's quiz", async () => {
      const mockSession = {
        id: mockSessionId,
        userId: "different-user-789",
        status: "in_progress",
      };

      (quizService.getQuizSession as any).mockResolvedValue(mockSession);

      const request = createAuthenticatedRequest(mockUserId, {
        method: "PATCH",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}`,
        body: { status: "paused" },
      });

      const response = await PATCH(request, { params: mockParams });
      const json = await getResponseJson(response);

      expect(response.status).toBe(403);
      expect(json.error).toContain("Forbidden");
    });
  });

  describe("Completed Quiz Protection", () => {
    it("should block updates to completed quizzes (except answers)", async () => {
      const mockSession = {
        id: mockSessionId,
        userId: mockUserId,
        status: "completed",
      };

      (quizService.getQuizSession as any).mockResolvedValue(mockSession);

      const request = createAuthenticatedRequest(mockUserId, {
        method: "PATCH",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}`,
        body: { status: "in_progress" }, // Trying to change status
      });

      const response = await PATCH(request, { params: mockParams });
      const json = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(json.message).toContain("already completed");
    });

    it("should accept answers for completed quizzes", async () => {
      const mockSession = {
        id: mockSessionId,
        userId: mockUserId,
        status: "completed",
      };

      (quizService.getQuizSession as any).mockResolvedValue(mockSession);

      const request = createAuthenticatedRequest(mockUserId, {
        method: "PATCH",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}`,
        body: {
          answers: [createMockAnswerSubmission()],
        },
      });

      const response = await PATCH(request, { params: mockParams });
      const json = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
    });
  });

  describe("Quiz Actions", () => {
    beforeEach(() => {
      (quizService.getQuizSession as any).mockResolvedValue({
        id: mockSessionId,
        userId: mockUserId,
        status: "not_started",
      });
    });

    it("should start quiz when action is 'start'", async () => {
      (quizService.startQuizSession as any).mockResolvedValue(undefined);

      const request = createAuthenticatedRequest(mockUserId, {
        method: "PATCH",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}`,
        body: { action: "start" },
      });

      const response = await PATCH(request, { params: mockParams });
      const json = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(quizService.startQuizSession).toHaveBeenCalledWith(mockSessionId, mockSupabase);
      expect(json.success).toBe(true);
    });

    it("should pause quiz when action is 'pause'", async () => {
      (quizService.getQuizSession as any).mockResolvedValue({
        id: mockSessionId,
        userId: mockUserId,
        status: "in_progress",
      });

      (quizService.pauseQuizSession as any).mockResolvedValue(undefined);

      const request = createAuthenticatedRequest(mockUserId, {
        method: "PATCH",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}`,
        body: { action: "pause", timeRemaining: 300 },
      });

      const response = await PATCH(request, { params: mockParams });
      const json = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(quizService.pauseQuizSession).toHaveBeenCalledWith(mockSessionId, 300, mockSupabase);
      expect(json.success).toBe(true);
    });

    it("should resume quiz when action is 'resume'", async () => {
      (quizService.getQuizSession as any).mockResolvedValue({
        id: mockSessionId,
        userId: mockUserId,
        status: "paused",
      });

      (quizService.resumeQuizSession as any).mockResolvedValue(undefined);

      const request = createAuthenticatedRequest(mockUserId, {
        method: "PATCH",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}`,
        body: { action: "resume" },
      });

      const response = await PATCH(request, { params: mockParams });
      const json = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(quizService.resumeQuizSession).toHaveBeenCalledWith(mockSessionId, mockSupabase);
      expect(json.success).toBe(true);
    });

    it("should update quiz for regular updates", async () => {
      (quizService.updateQuizSession as any).mockResolvedValue(undefined);

      const request = createAuthenticatedRequest(mockUserId, {
        method: "PATCH",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}`,
        body: {
          currentQuestionIndex: 5,
          totalTimeSpent: 150,
        },
      });

      const response = await PATCH(request, { params: mockParams });
      const json = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(quizService.updateQuizSession).toHaveBeenCalledWith(
        mockSessionId,
        expect.objectContaining({
          currentQuestionIndex: 5,
          totalTimeSpent: 150,
        }),
        mockSupabase
      );
      expect(json.success).toBe(true);
    });
  });

  describe("Answer Submission Optimization", () => {
    beforeEach(() => {
      (quizService.getQuizSession as any).mockResolvedValue({
        id: mockSessionId,
        userId: mockUserId,
        status: "in_progress",
      });
      (quizService.updateQuizSession as any).mockResolvedValue(undefined);
    });

    it("should submit answers during progress update", async () => {
      const answers = [
        createMockAnswerSubmission({ questionId: "q-1" }),
        createMockAnswerSubmission({ questionId: "q-2" }),
      ];

      const request = createAuthenticatedRequest(mockUserId, {
        method: "PATCH",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}`,
        body: {
          answers,
          currentQuestionIndex: 2,
        },
      });

      const response = await PATCH(request, { params: mockParams });
      const json = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith("quiz_attempts");
    });

    it("should prevent duplicate answer submissions", async () => {
      // Mock existing attempts
      mockQuery.in.mockResolvedValue({
        data: [{ question_id: "q-1" }],
        error: null,
      });

      mockQuery.insert = vi.fn().mockReturnThis();

      const answers = [
        createMockAnswerSubmission({ questionId: "q-1" }), // Already exists
        createMockAnswerSubmission({ questionId: "q-2" }), // New
      ];

      const request = createAuthenticatedRequest(mockUserId, {
        method: "PATCH",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}`,
        body: { answers },
      });

      const response = await PATCH(request, { params: mockParams });

      expect(response.status).toBe(200);
      // Should only insert q-2, not q-1
      expect(mockQuery.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            question_id: "q-2",
          }),
        ])
      );
    });
  });

  describe("Error Handling", () => {
    it("should return 500 when service throws error", async () => {
      (quizService.getQuizSession as any).mockRejectedValue(new Error("Database error"));

      const request = createAuthenticatedRequest(mockUserId, {
        method: "PATCH",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}`,
        body: { status: "in_progress" },
      });

      const response = await PATCH(request, { params: mockParams });
      const json = await getResponseJson(response);

      expect(response.status).toBe(500);
      expect(json.error).toBe("Failed to update quiz session");
    });
  });
});

describe("DELETE /api/user/quiz/sessions/[id] (Delete Quiz Session)", () => {
  const mockUserId = "test-user-123";
  const mockSessionId = "session-456";
  const mockParams = Promise.resolve({ id: mockSessionId });
  let mockQuery: any;
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockQuery = {
      select: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { user_id: mockUserId },
        error: null,
      }),
    };

    mockSupabase = {
      from: vi.fn().mockReturnValue(mockQuery),
      auth: { getUser: vi.fn() },
    };

    (createClient as any).mockResolvedValue(mockSupabase);
    (getUserIdFromHeaders as any).mockReturnValue(mockUserId);
  });

  describe("Authentication", () => {
    it("should return 401 when user is not authenticated", async () => {
      (getUserIdFromHeaders as any).mockReturnValue(null);

      const request = createMockRequest({
        method: "DELETE",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}`,
      });

      const response = await DELETE(request, { params: mockParams });
      const json = await getResponseJson(response);

      expect(response.status).toBe(401);
      expect(json.error).toBe("Unauthorized");
    });
  });

  describe("Authorization", () => {
    it("should return 404 when quiz session not found", async () => {
      mockQuery.single.mockResolvedValue({ data: null, error: { message: "Not found" } });

      const request = createAuthenticatedRequest(mockUserId, {
        method: "DELETE",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}`,
      });

      const response = await DELETE(request, { params: mockParams });
      const json = await getResponseJson(response);

      expect(response.status).toBe(404);
      expect(json.error).toBe("Quiz session not found");
    });

    it("should return 403 when user tries to delete another user's quiz", async () => {
      mockQuery.single.mockResolvedValue({
        data: { user_id: "different-user-789" },
        error: null,
      });

      const request = createAuthenticatedRequest(mockUserId, {
        method: "DELETE",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}`,
      });

      const response = await DELETE(request, { params: mockParams });
      const json = await getResponseJson(response);

      expect(response.status).toBe(403);
      expect(json.error).toContain("Forbidden");
    });
  });

  describe("Successful Deletion", () => {
    it("should delete quiz session and its attempts", async () => {
      // Need to create separate mock query for delete operations
      const mockDeleteQuery = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      // Override from to return appropriate query based on table name
      mockSupabase.from = vi.fn((tableName: string) => {
        if (tableName === "quiz_sessions") {
          if (mockSupabase.from.mock.calls.length === 1) {
            // First call is for checking ownership
            return mockQuery;
          } else {
            // Second call is for deletion
            return mockDeleteQuery;
          }
        }
        // quiz_attempts deletion
        return mockDeleteQuery;
      });

      const request = createAuthenticatedRequest(mockUserId, {
        method: "DELETE",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}`,
      });

      const response = await DELETE(request, { params: mockParams });
      const json = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.message).toContain("deleted successfully");

      // Should delete quiz attempts first
      expect(mockSupabase.from).toHaveBeenCalledWith("quiz_attempts");
      // Then delete quiz session
      expect(mockSupabase.from).toHaveBeenCalledWith("quiz_sessions");
    });
  });

  describe("Error Handling", () => {
    it("should return 500 when deletion fails", async () => {
      const mockDeleteQuery = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Database error" },
        }),
      };

      // Override from to return delete query for quiz_sessions
      mockSupabase.from = vi.fn((tableName: string) => {
        if (tableName === "quiz_sessions" && mockSupabase.from.mock.calls.length === 1) {
          return mockQuery; // First call for ownership check
        }
        return mockDeleteQuery; // All other calls for deletion
      });

      const request = createAuthenticatedRequest(mockUserId, {
        method: "DELETE",
        url: `http://localhost:3000/api/user/quiz/sessions/${mockSessionId}`,
      });

      const response = await DELETE(request, { params: mockParams });
      const json = await getResponseJson(response);

      expect(response.status).toBe(500);
      expect(json.error).toBe("Failed to delete quiz session");
    });
  });
});
