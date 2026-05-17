# API Testing Documentation

This directory contains comprehensive API tests for the Pathology Bites quiz endpoints.

## Overview

We have **70 API tests** covering all quiz-related endpoints:
- Quiz session creation (POST /api/user/quiz/sessions)
- Quiz session listing (GET /api/user/quiz/sessions)
- Individual session operations (GET, PATCH, DELETE /api/user/quiz/sessions/[id])
- Quiz completion (POST /api/user/quiz/sessions/[id]/complete)
- Quiz results (GET /api/user/quiz/sessions/[id]/results)

## Test Files

```
dev/test/api/
├── README.md                          # This file
├── api-test-helpers.ts                # Shared test utilities
├── quiz-sessions.test.ts              # Session creation & listing (22 tests)
├── quiz-session-detail.test.ts        # Session CRUD operations (22 tests)
└── quiz-completion-results.test.ts    # Completion & results (26 tests)
```

## Running API Tests

```bash
# Run all API tests
npm run test:run -- dev/test/api

# Run specific test file
npm run test:run -- dev/test/api/quiz-sessions.test.ts

# Run in watch mode
npm test -- dev/test/api

# Run with verbose output
npm run test:unit -- dev/test/api
```

## Test Coverage

### POST /api/user/quiz/sessions (Create Quiz Session)

**Tests covered:**
- ✅ Authentication (401 when unauthorized)
- ✅ Validation (missing title, mode, questionCount)
- ✅ Question count bounds (1-100)
- ✅ Category selection validation
- ✅ Successful creation with valid data
- ✅ Error handling (service errors)

**Example:**
```typescript
it("should create quiz session with valid data", async () => {
  const mockSession = { id: "session-123", title: "Test Quiz", totalQuestions: 10 };
  (quizService.createQuizSession as any).mockResolvedValue(mockSession);

  const request = createAuthenticatedRequest(mockUserId, {
    method: "POST",
    url: "http://localhost:3000/api/user/quiz/sessions",
    body: createMockQuizFormData(),
  });

  const response = await POST(request);
  const json = await getResponseJson(response);

  expect(response.status).toBe(200);
  expect(json.data.sessionId).toBe("session-123");
});
```

### GET /api/user/quiz/sessions (List Sessions)

**Tests covered:**
- ✅ Authentication (401 when unauthorized)
- ✅ Default pagination (limit=10, offset=0)
- ✅ Custom limit/offset parameters
- ✅ Status filtering
- ✅ Response field mapping
- ✅ Empty results handling
- ✅ Database error handling

### GET /api/user/quiz/sessions/[id] (Get Session)

**Tests covered:**
- ✅ Authentication & authorization
- ✅ Session not found (404)
- ✅ Forbidden access (403)
- ✅ Successful fetch for owned session
- ✅ Error handling

### PATCH /api/user/quiz/sessions/[id] (Update Session)

**Tests covered:**
- ✅ Authentication & authorization
- ✅ Session not found/forbidden
- ✅ Completed quiz protection
- ✅ Answer submission during completion
- ✅ Quiz actions (start, pause, resume)
- ✅ Regular progress updates
- ✅ Duplicate answer prevention
- ✅ Error handling

**Key Features Tested:**
```typescript
// Prevents updating completed quizzes
if (existingSession.status === "completed") {
  // Blocks status changes but accepts answer submissions
}

// Optimized answer submission (no separate API call needed!)
if (updates.answers && updates.answers.length > 0) {
  // Submit answers during progress update
  // Automatically deduplicates existing attempts
}
```

### DELETE /api/user/quiz/sessions/[id] (Delete Session)

**Tests covered:**
- ✅ Authentication & authorization
- ✅ Session not found/forbidden
- ✅ Successful deletion (cascades to quiz_attempts)
- ✅ Error handling

### POST /api/user/quiz/sessions/[id]/complete (Complete Quiz)

**Tests covered:**
- ✅ Authentication & authorization
- ✅ Session not found/forbidden
- ✅ Idempotency (already completed)
- ✅ Completion without answers
- ✅ Completion with final answers
- ✅ Duplicate answer prevention
- ✅ Analytics update (non-blocking)
- ✅ Activity generation (non-blocking)
- ✅ Achievement awarding
- ✅ Error handling

**Key Features Tested:**
```typescript
// Idempotent completion
if (session.status === "completed") {
  return existingResults; // Don't fail, return existing data
}

// Non-blocking side effects
try {
  await quizAnalyticsService.updateQuizSessionAnalytics(id);
} catch {
  // Don't fail completion if analytics fails
}

// Client-driven achievement calculation
const achievementResult = await awardAchievements(userId, clientAchievementIds);
```

### GET /api/user/quiz/sessions/[id]/results (Get Results)

**Tests covered:**
- ✅ Authentication & authorization
- ✅ Session not found/forbidden
- ✅ Results not available (quiz not completed)
- ✅ Successful fetch
- ✅ Recent achievements inclusion
- ✅ Non-blocking achievement fetch
- ✅ Error handling

## Test Utilities

### `api-test-helpers.ts`

Provides reusable utilities for API testing:

```typescript
// Create mock request
const request = createMockRequest({
  method: "POST",
  url: "http://localhost:3000/api/test",
  headers: { "x-custom": "value" },
  body: { data: "test" },
  searchParams: { filter: "active" },
});

// Create authenticated request
const authedRequest = createAuthenticatedRequest(userId, {
  method: "GET",
  url: "http://localhost:3000/api/resource",
});

// Parse response
const json = await getResponseJson(response);

// Assert response status
const json = await assertResponse(response, 200);

// Mock Supabase client
const { client, query } = createMockSupabaseClient();

// Create mock data
const formData = createMockQuizFormData({ questionCount: 20 });
const sessionData = createMockQuizSessionData({ status: "completed" });
const resultData = createMockQuizResultData({ score: 90 });
const answer = createMockAnswerSubmission({ questionId: "q-1" });
```

## Mocking Strategy

### Mocking Dependencies

All external dependencies are mocked at the module level:

```typescript
// Mock Supabase client creation
vi.mock("@/shared/services/server", () => ({
  createClient: vi.fn(),
}));

// Mock quiz service
vi.mock("@/features/user/quiz/services/quiz-service", () => ({
  quizService: {
    createQuizSession: vi.fn(),
    getQuizSession: vi.fn(),
    // ... other methods
  },
}));

// Mock analytics service
vi.mock("@/features/user/quiz/services/analytics-service", () => ({
  quizAnalyticsService: {
    updateQuizSessionAnalytics: vi.fn(),
  },
}));
```

### Mocking Supabase Query Chains

Supabase uses a fluent API with method chaining. We mock this pattern:

```typescript
const mockQuery = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  range: vi.fn().mockResolvedValue({ data: [], error: null }),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
};

const mockSupabase = {
  from: vi.fn().mockReturnValue(mockQuery),
};
```

## Best Practices

### 1. Test Structure (AAA Pattern)

```typescript
it("should do something", async () => {
  // Arrange - Set up mocks and test data
  const mockData = createMockQuizSessionData();
  (quizService.getQuizSession as any).mockResolvedValue(mockData);

  // Act - Execute the code under test
  const request = createAuthenticatedRequest(userId, {...});
  const response = await GET(request, { params });

  // Assert - Verify the outcome
  expect(response.status).toBe(200);
  expect(json.data).toEqual(mockData);
});
```

### 2. Test What Matters

**✅ Good - Test behavior:**
```typescript
it("should return 403 when user tries to access another user's quiz", async () => {
  // Test the authorization logic, not implementation details
  const mockSession = { id: "123", userId: "different-user" };
  (quizService.getQuizSession as any).mockResolvedValue(mockSession);

  const response = await GET(request, { params });

  expect(response.status).toBe(403);
});
```

**❌ Bad - Test implementation:**
```typescript
it("should call getUserIdFromHeaders", async () => {
  // Don't test that internal functions are called
  await GET(request, { params });
  expect(getUserIdFromHeaders).toHaveBeenCalled();
});
```

### 3. Clear Test Names

Use descriptive names that explain the scenario and expected outcome:

```typescript
// ✅ Good
it("should return 400 when questionCount is greater than 100")
it("should prevent duplicate answer submissions")
it("should not fail completion if analytics update fails")

// ❌ Bad
it("works")
it("test validation")
it("handles errors")
```

### 4. Mock Reset

Always clear mocks in `beforeEach`:

```typescript
beforeEach(() => {
  vi.clearAllMocks();
  // Reset mock implementations
  mockQuery.range.mockResolvedValue({ data: [], error: null });
});
```

### 5. Non-Blocking Operations

Test that failures in non-critical operations don't break the main flow:

```typescript
it("should not fail completion if analytics update fails", async () => {
  (quizService.completeQuiz as any).mockResolvedValue(mockResults);
  (quizAnalyticsService.updateQuizSessionAnalytics as any).mockRejectedValue(
    new Error("Analytics error")
  );

  const response = await POST(request, { params });

  // Main operation should succeed despite analytics failure
  expect(response.status).toBe(200);
});
```

## Common Patterns

### Testing Authentication

```typescript
it("should return 401 when user is not authenticated", async () => {
  const request = createMockRequest({
    method: "POST",
    url: "http://localhost:3000/api/endpoint",
    // No x-user-id header
  });

  const response = await POST(request);
  const json = await getResponseJson(response);

  expect(response.status).toBe(401);
  expect(json.error).toBe("Unauthorized");
});
```

### Testing Authorization

```typescript
it("should return 403 when user tries to access another user's resource", async () => {
  const mockResource = { userId: "different-user-789" };
  (service.getResource as any).mockResolvedValue(mockResource);

  const request = createAuthenticatedRequest(mockUserId, {...});
  const response = await GET(request, { params });

  expect(response.status).toBe(403);
  expect(json.error).toContain("Forbidden");
});
```

### Testing Validation

```typescript
it("should return 400 when required field is missing", async () => {
  const request = createAuthenticatedRequest(mockUserId, {
    method: "POST",
    url: "http://localhost:3000/api/endpoint",
    body: { /* missing required field */ },
  });

  const response = await POST(request);
  const json = await getResponseJson(response);

  expect(response.status).toBe(400);
  expect(json.error).toContain("Missing required fields");
});
```

### Testing Error Handling

```typescript
it("should return 500 when service throws unknown error", async () => {
  (quizService.method as any).mockRejectedValue("Unknown error");

  const request = createAuthenticatedRequest(mockUserId, {...});
  const response = await POST(request);

  expect(response.status).toBe(500);
  expect(json.error).toBe("Failed to perform operation");
});
```

## Debugging Tests

### Enable Verbose Logging

```bash
# See detailed test output
npm run test:unit -- dev/test/api

# See which test is failing
npm run test:run -- dev/test/api --reporter=verbose
```

### Use Test UI

```bash
# Visual test runner
npm run test:ui

# Then navigate to: http://localhost:51204/__vitest__/
```

### Debug Individual Tests

Use `.only` to run a single test:

```typescript
it.only("should do something", async () => {
  // Only this test will run
});
```

### Log Mock Calls

```typescript
it("should call service with correct params", async () => {
  await POST(request);

  console.log("Mock calls:", mockService.method.mock.calls);
  expect(mockService.method).toHaveBeenCalledWith(expectedParams);
});
```

## Integration with CI/CD

These tests are designed to run in CI/CD pipelines:

```yaml
# .github/workflows/test.yml
- name: Run API Tests
  run: npm run test:run -- dev/test/api
```

### Fast Execution

- All 70 API tests run in **< 300ms**
- No database or network calls
- Fully mocked dependencies
- Perfect for CI/CD pipelines

## Limitations

### What These Tests DON'T Cover

❌ **Real Database Operations**
- Tests use mocked Supabase clients
- Actual SQL queries are not executed
- Database constraints are not tested

❌ **Real Network Calls**
- No actual HTTP requests are made
- External API integrations are mocked

❌ **End-to-End Flows**
- UI interactions are not tested
- Browser behavior is not tested
- Multi-step user journeys are not tested

### What You Should Test Manually

See `dev/MANUAL_TESTING_PLAN.md` for comprehensive manual testing scenarios.

## Contributing

When adding new API endpoints:

1. Create tests in the appropriate file (or create a new one)
2. Follow the existing patterns (AAA structure, clear names)
3. Mock all external dependencies
4. Test authentication, authorization, validation, success, and error cases
5. Ensure all tests pass before committing

### Checklist for New API Tests

- [ ] Authentication tests (401)
- [ ] Authorization tests (403)
- [ ] Validation tests (400)
- [ ] Not found tests (404)
- [ ] Success tests (200)
- [ ] Error handling tests (500)
- [ ] Edge cases (idempotency, duplicates, etc.)

## Summary

Your API testing infrastructure is production-ready with:
- ✅ **70 API tests** covering all quiz endpoints
- ✅ **100% pass rate** (160/160 total tests including unit tests)
- ✅ **Fast execution** (< 300ms for API tests)
- ✅ **Comprehensive coverage** (auth, validation, success, errors, edge cases)
- ✅ **Reusable utilities** (api-test-helpers.ts)
- ✅ **Clear documentation** (this file)
- ✅ **CI/CD ready** (no external dependencies)

**Next steps:**
1. Run manual testing (see `dev/MANUAL_TESTING_PLAN.md`)
2. Set up CI/CD pipeline to run tests automatically
