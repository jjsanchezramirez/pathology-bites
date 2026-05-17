# Testing Guide for Pathology Bites

This directory contains the comprehensive test suite for the Pathology Bites application, with a special focus on the quiz-taking functionality which is the core feature of the application.

## Table of Contents

- [Quick Start](#quick-start)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Debugging Tests](#debugging-tests)
- [Test Coverage](#test-coverage)
- [Best Practices](#best-practices)

## Quick Start

### Running All Tests

```bash
# Run all unit tests
npm test

# Run all unit tests with verbose output
npm run test:unit

# Run tests in watch mode (reruns on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests with UI
npm run test:ui
```

### Running Specific Tests

```bash
# Run a specific test file
npm test -- quiz-state-machine.test.ts

# Run tests matching a pattern
npm test -- --grep "SUBMIT_ANSWER"

# Run only achievement tests
npm test -- achievement-checker.test.ts
```

## Test Structure

Tests mirror `src/`. Each test sits at the path matching its source module.

```
tests/
├── README.md                          # This file
├── vitest-config.test.ts              # Framework sanity
├── helpers/                           # Shared mock factories
│   ├── api-test-helpers.ts
│   └── test-helpers.ts
├── api/                               # mirrors src/app/api/
│   ├── admin/lesson-studio/
│   └── user/quiz/sessions/
├── app/                               # mirrors src/app/ (non-API)
│   └── admin/lesson-studio/
│       ├── canvas/
│       └── model/
└── features/                          # mirrors src/features/
    └── user/
        ├── achievements/
        └── quiz/
```

Helpers are imported via the `@tests/*` alias (configured in `tsconfig.json` + `vitest.config.ts`):

```ts
import { createMockConfig } from "@tests/helpers/test-helpers";
```

## Running Tests

### Unit Tests (Vitest)

Unit tests are located in `tests/` and test individual functions, classes, and modules in isolation.

**Key Features:**
- Fast execution (< 1 second for most test suites)
- Uses Happy DOM for browser environment simulation
- Includes mocking utilities for external dependencies
- Code coverage reporting available

**Configuration:**
- Config file: `/vitest.config.ts`
- Setup file: `/vitest.setup.ts`
- Environment: happy-dom

**Examples:**

```bash
# Run all tests once
npm run test:run

# Watch mode for development
npm test

# With coverage
npm run test:coverage

# Specific test file
npm test -- quiz-state-machine.test.ts

# With UI (visual test runner)
npm run test:ui
```

## Writing Tests

### Test File Naming

- Unit tests: `*.test.ts` or `*.test.tsx`
- Place tests in `tests/` directory

### Basic Test Structure

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { functionToTest } from "@/path/to/module";

describe("Feature Name", () => {
  beforeEach(() => {
    // Setup before each test
  });

  describe("Specific Functionality", () => {
    it("should do something expected", () => {
      // Arrange
      const input = "test";

      // Act
      const result = functionToTest(input);

      // Assert
      expect(result).toBe("expected output");
    });
  });
});
```

### Using Test Helpers

We provide several utilities to make testing easier:

```typescript
import {
  createMockQuestion,
  createMockQuizState,
  createMockConfig,
  mockLocalStorage,
  wait,
  waitFor,
} from "./utils/test-helpers";

import {
  createMockSession,
  createMockQuestionWithDetails,
  createMockQuizResult,
} from "./utils/mock-data";

// Example: Create mock quiz data
const questions = createMockQuestions(5);
const quizState = createMockQuizState({ questions });
const config = createMockConfig({ mode: "tutor", timing: "timed" });
```

### Testing Async Code

```typescript
it("should handle async operations", async () => {
  const result = await someAsyncFunction();
  expect(result).toBeDefined();
});

it("should wait for condition", async () => {
  let value = false;

  setTimeout(() => {
    value = true;
  }, 100);

  await waitFor(() => value === true, 5000);
  expect(value).toBe(true);
});
```

### Mocking

```typescript
import { vi } from "vitest";

// Mock a function
const mockFn = vi.fn();
mockFn.mockReturnValue("mocked value");

// Mock a module
vi.mock("@/path/to/module", () => ({
  someFunction: vi.fn(() => "mocked"),
}));

// Mock localStorage (already mocked globally)
localStorage.setItem("key", "value");
expect(localStorage.getItem("key")).toBe("value");
```

## Debugging Tests

### Console Logging

All console statements in tests will appear in the test output:

```typescript
it("should debug something", () => {
  console.log("Debug info:", someValue);
  expect(someValue).toBeDefined();
});
```

### Using Vitest UI

The Vitest UI provides a visual interface for debugging:

```bash
npm run test:ui
```

This opens a browser with:
- Visual test explorer
- Real-time test execution
- Detailed error messages
- Code coverage visualization

### Debug Specific Test

```bash
# Run only one test file
npm test -- quiz-state-machine.test.ts

# Use .only to run a single test
it.only("should debug this specific test", () => {
  // This is the only test that will run
});
```

### VS Code Debugging

Add breakpoints in VS Code and use the debug configuration:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Vitest Tests",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "test", "--", "--no-coverage"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

## Test Coverage

### Generating Coverage Reports

```bash
# Run tests with coverage
npm run test:coverage
```

This generates:
- Terminal summary
- HTML report in `coverage/` directory
- JSON report for CI/CD integration

### Viewing Coverage

Open `coverage/index.html` in your browser to see:
- Line coverage
- Branch coverage
- Function coverage
- Uncovered lines highlighted

### Coverage Goals

- **Unit Tests:** Aim for 80%+ coverage
- **Critical Paths:** 100% coverage for quiz state machine and core logic
- **UI Components:** 70%+ coverage

## Best Practices

### 1. Test Behavior, Not Implementation

❌ **Bad:**
```typescript
it("should call internal method", () => {
  const instance = new MyClass();
  const spy = vi.spyOn(instance as any, "_privateMethod");
  instance.publicMethod();
  expect(spy).toHaveBeenCalled();
});
```

✅ **Good:**
```typescript
it("should return correct result", () => {
  const instance = new MyClass();
  const result = instance.publicMethod();
  expect(result).toBe(expectedValue);
});
```

### 2. Use Descriptive Test Names

❌ **Bad:**
```typescript
it("works", () => { /* ... */ });
it("test 1", () => { /* ... */ });
```

✅ **Good:**
```typescript
it("should calculate correct score when all answers are correct", () => { /* ... */ });
it("should navigate to next question after submitting answer", () => { /* ... */ });
```

### 3. Follow the AAA Pattern

```typescript
it("should do something", () => {
  // Arrange - Set up test data
  const input = createMockData();

  // Act - Execute the code under test
  const result = functionUnderTest(input);

  // Assert - Verify the outcome
  expect(result).toBe(expected);
});
```

### 4. Keep Tests Isolated

Each test should be independent and not rely on other tests:

```typescript
// Use beforeEach for setup
beforeEach(() => {
  // Fresh setup for each test
  testData = createMockData();
});

// Don't share mutable state between tests
let sharedState; // ❌ Bad

beforeEach(() => {
  const localState = {}; // ✅ Good
});
```

### 5. Test Edge Cases

```typescript
describe("Answer submission", () => {
  it("should handle correct answer", () => { /* ... */ });
  it("should handle incorrect answer", () => { /* ... */ });
  it("should handle invalid question ID", () => { /* ... */ });
  it("should handle null answer", () => { /* ... */ });
  it("should handle already answered question", () => { /* ... */ });
});
```

### 6. Use Meaningful Assertions

```typescript
// Be specific
expect(result).toBe(42); // ✅ Better than truthy check
expect(array).toHaveLength(3); // ✅ Better than length check
expect(object).toEqual({ key: "value" }); // ✅ Deep equality

// Avoid vague checks
expect(result).toBeTruthy(); // ❌ Too vague
expect(array.length > 0).toBe(true); // ❌ Unclear intention
```

## Continuous Integration

Tests run automatically on:
- Every push to `main` or `develop` branches
- Every pull request

### CI Configuration

See `.github/workflows/test.yml` for GitHub Actions configuration (to be created).

### Required Checks

- All unit tests must pass
- Code coverage must meet thresholds
- No linting errors
- TypeScript compilation successful

## Troubleshooting

### Tests Failing Locally But Passing in CI

1. Clear node_modules and reinstall:
   ```bash
   rm -rf node_modules
   npm install
   ```

2. Check Node version matches CI
3. Clear Vitest cache:
   ```bash
   npm test -- --clearCache
   ```

### Slow Tests

1. Use `test.only` to isolate slow tests
2. Check for unnecessary `await` statements
3. Mock external dependencies
4. Use `test.concurrent` for independent tests

### Memory Issues

```bash
# Increase Node memory limit
NODE_OPTIONS=--max_old_space_size=4096 npm test
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Jest Matchers (Vitest compatible)](https://vitest.dev/api/expect.html)

## Contributing

When adding new features:

1. Write tests first (TDD approach recommended)
2. Ensure all tests pass locally
3. Add tests to appropriate test file or create new one
4. Update this README if adding new test utilities
5. Maintain or improve code coverage

## Questions?

If you have questions about testing or need help:
1. Check this README first
2. Look at existing test files for examples
3. Review Vitest documentation
4. Ask in team chat or create an issue
