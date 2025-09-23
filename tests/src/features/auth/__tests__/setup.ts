// src/features/auth/__tests__/setup.ts
import "@testing-library/jest-dom";

// Mock Next.js router
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
  usePathname: () => "/test",
}));

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.NODE_ENV = "test";

// Mock window.location
Object.defineProperty(window, "location", {
  value: {
    href: "http://localhost:3000",
    origin: "http://localhost:3000",
    pathname: "/test",
    search: "",
    hash: "",
    reload: jest.fn(),
    assign: jest.fn(),
    replace: jest.fn(),
  },
  writable: true,
});

// Mock console methods to reduce noise in tests
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === "string" &&
      (args[0].includes("Warning:") ||
        args[0].includes("React does not recognize"))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };

  console.warn = (...args: any[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("componentWillReceiveProps")
    ) {
      return;
    }
    originalWarn.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// Global test utilities
global.testUtils = {
  createMockUser: (overrides = {}) => ({
    id: "123",
    email: "test@example.com",
    user_metadata: {},
    app_metadata: {},
    ...overrides,
  }),

  createMockSession: (user = global.testUtils.createMockUser()) => ({
    user,
    access_token: "mock-access-token",
    refresh_token: "mock-refresh-token",
    expires_at: Date.now() + 3600000, // 1 hour from now
    token_type: "bearer",
  }),

  createMockError: (type = "UNKNOWN_ERROR", message = "Test error") => ({
    type,
    message,
    retryable: false,
    severity: "medium" as const,
    userMessage: "A test error occurred.",
  }),

  waitForNextTick: () => new Promise((resolve) => setTimeout(resolve, 0)),
};

// Extend Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeAuthError(): R;
      toHaveSecurityRisk(level: "low" | "medium" | "high"): R;
    }
  }

  const testUtils: {
    createMockUser: (
      overrides?: Record<string, unknown>,
    ) => Record<string, unknown>;
    createMockSession: (
      user?: Record<string, unknown>,
    ) => Record<string, unknown>;
    createMockError: (
      type?: string,
      message?: string,
    ) => Record<string, unknown>;
    waitForNextTick: () => Promise<void>;
  };
}

expect.extend({
  toBeAuthError(received) {
    const pass =
      received &&
      typeof received.type === "string" &&
      typeof received.message === "string" &&
      typeof received.retryable === "boolean" &&
      typeof received.severity === "string" &&
      typeof received.userMessage === "string";

    if (pass) {
      return {
        message: () => `expected ${received} not to be an auth error`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${received} to be an auth error with required properties`,
        pass: false,
      };
    }
  },

  toHaveSecurityRisk(received, level) {
    const pass = received && received.securityRisk === level;

    if (pass) {
      return {
        message: () => `expected security risk not to be ${level}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected security risk to be ${level}, but got ${received?.securityRisk}`,
        pass: false,
      };
    }
  },
});
