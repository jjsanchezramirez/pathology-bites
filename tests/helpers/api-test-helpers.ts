/**
 * API Test Helpers
 *
 * Utilities for testing Next.js API routes
 */

import { vi } from "vitest";
import type { NextRequest } from "next/server";

/**
 * Create a mock NextRequest for API route testing
 */
export function createMockRequest(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: any;
  searchParams?: Record<string, string>;
}): NextRequest {
  const {
    method = "GET",
    url = "http://localhost:3000/api/test",
    headers = {},
    body = null,
    searchParams = {},
  } = options;

  // Build URL with search params
  const urlWithParams = new URL(url);
  Object.entries(searchParams).forEach(([key, value]) => {
    urlWithParams.searchParams.set(key, value);
  });

  // Create mock request
  const request = {
    method,
    url: urlWithParams.toString(),
    headers: new Headers(headers),
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(body ? JSON.stringify(body) : ""),
    formData: vi.fn(),
    arrayBuffer: vi.fn(),
    blob: vi.fn(),
  } as unknown as NextRequest;

  return request;
}

/**
 * Create authenticated request with user ID header
 */
export function createAuthenticatedRequest(
  userId: string,
  options: Parameters<typeof createMockRequest>[0] = {}
): NextRequest {
  return createMockRequest({
    ...options,
    headers: {
      ...options.headers,
      "x-user-id": userId,
      "x-request-id": `test-${Date.now()}`,
    },
  });
}

/**
 * Mock Supabase client for API testing
 */
export function createMockSupabaseClient() {
  const mockQuery = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  const mockClient = {
    from: vi.fn().mockReturnValue(mockQuery),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  return { client: mockClient, query: mockQuery };
}

/**
 * Extract JSON from NextResponse
 */
export async function getResponseJson(response: Response): Promise<any> {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

/**
 * Assert response status and get JSON
 */
export async function assertResponse(response: Response, expectedStatus: number): Promise<any> {
  if (response.status !== expectedStatus) {
    const body = await getResponseJson(response);
    throw new Error(
      `Expected status ${expectedStatus}, got ${response.status}. Body: ${JSON.stringify(body)}`
    );
  }
  return getResponseJson(response);
}

/**
 * Mock quiz service methods
 */
export function createMockQuizService() {
  return {
    createQuizSession: vi.fn(),
    getQuizSession: vi.fn(),
    updateQuizSession: vi.fn(),
    startQuizSession: vi.fn(),
    pauseQuizSession: vi.fn(),
    resumeQuizSession: vi.fn(),
    completeQuiz: vi.fn(),
    getQuizResults: vi.fn(),
  };
}

/**
 * Mock quiz session data
 */
export function createMockQuizSessionData(overrides: any = {}) {
  return {
    id: "test-session-123",
    user_id: "test-user-456",
    title: "Test Quiz",
    status: "not_started",
    config: {
      mode: "practice",
      timing: "untimed",
      questionCount: 10,
      questionType: "all",
      categorySelection: "all",
      selectedCategories: [],
      shuffleQuestions: false,
      shuffleAnswers: false,
      showProgress: true,
      showExplanations: false,
    },
    total_questions: 10,
    current_question_index: 0,
    score: null,
    correct_answers: null,
    total_time_spent: 0,
    total_time_limit: null,
    time_remaining: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completed_at: null,
    ...overrides,
  };
}

/**
 * Mock quiz result data
 */
export function createMockQuizResultData(overrides: any = {}) {
  return {
    sessionId: "test-session-123",
    title: "Test Quiz",
    score: 8,
    totalQuestions: 10,
    correctAnswers: 8,
    incorrectAnswers: 2,
    totalTimeSpent: 300,
    completedAt: new Date().toISOString(),
    questions: [],
    ...overrides,
  };
}

/**
 * Mock quiz creation form data
 */
export function createMockQuizFormData(overrides: any = {}) {
  return {
    title: "Test Quiz",
    mode: "practice",
    timing: "untimed",
    questionCount: 10,
    questionType: "all",
    categorySelection: "all",
    selectedCategories: [],
    shuffleQuestions: false,
    shuffleAnswers: false,
    showProgress: true,
    showExplanations: false,
    ...overrides,
  };
}

/**
 * Mock answer submission data
 */
export function createMockAnswerSubmission(overrides: any = {}) {
  return {
    questionId: "q-1",
    selectedAnswerId: "opt-1",
    timeSpent: 30,
    timestamp: Date.now(),
    ...overrides,
  };
}
