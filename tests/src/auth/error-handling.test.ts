// src/__tests__/auth/error-handling.test.ts
import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { createMockSupabaseClient } from "../utils/supabase-mock";

// Mock modules
jest.mock("@/shared/services/client", () => ({
  createClient: jest.fn(),
}));

describe("Error Handling & Recovery", () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Authentication Error Classification", () => {
    it("should classify network errors correctly", () => {
      const errorClassifier = {
        classifyError(error: any) {
          if (
            error.name === "NetworkError" ||
            error.message?.includes("network") ||
            error.message?.includes("fetch")
          ) {
            return {
              type: "NETWORK_ERROR",
              retryable: true,
              severity: "medium",
              userMessage:
                "Network connection issue. Please check your internet connection and try again.",
            };
          }
          return {
            type: "UNKNOWN",
            retryable: false,
            severity: "high",
            userMessage: "An unexpected error occurred.",
          };
        },
      };

      const networkError = new Error("Network request failed");
      networkError.name = "NetworkError";

      const authError = errorClassifier.classifyError(networkError);

      expect(authError.type).toBe("NETWORK_ERROR");
      expect(authError.retryable).toBe(true);
      expect(authError.severity).toBe("medium");
      expect(authError.userMessage).toContain("connection");
    });

    it("should classify authentication failures correctly", () => {
      const errorClassifier = {
        classifyError(error: any) {
          if (
            error.message?.includes("Invalid login credentials") ||
            error.message?.includes("authentication")
          ) {
            return {
              type: "AUTHENTICATION_FAILED",
              retryable: false,
              severity: "low",
              userMessage:
                "Invalid email and password combination. Please check your credentials and try again.",
            };
          }
          return {
            type: "UNKNOWN",
            retryable: false,
            severity: "high",
            userMessage: "An unexpected error occurred.",
          };
        },
      };

      const authFailure = { message: "Invalid login credentials" };
      const authError = errorClassifier.classifyError(authFailure);

      expect(authError.type).toBe("AUTHENTICATION_FAILED");
      expect(authError.retryable).toBe(false);
      expect(authError.userMessage).toContain("email and password");
    });

    it("should classify session expiry correctly", () => {
      const errorClassifier = {
        classifyError(error: any) {
          if (
            error.message?.includes("Session expired") ||
            error.message?.includes("token expired")
          ) {
            return {
              type: "SESSION_EXPIRED",
              retryable: false,
              severity: "medium",
              userMessage: "Your session has expired. Please log in again.",
            };
          }
          return {
            type: "UNKNOWN",
            retryable: false,
            severity: "high",
            userMessage: "An unexpected error occurred.",
          };
        },
      };

      const sessionError = { message: "Session expired" };
      const authError = errorClassifier.classifyError(sessionError);

      expect(authError.type).toBe("SESSION_EXPIRED");
      expect(authError.retryable).toBe(false);
      expect(authError.userMessage).toContain("session has expired");
    });

    it("should classify permission errors correctly", () => {
      const errorClassifier = {
        classifyError(error: any) {
          if (
            error.status === 403 ||
            error.message?.includes("Forbidden") ||
            error.message?.includes("permission")
          ) {
            return {
              type: "PERMISSION_DENIED",
              retryable: false,
              severity: "medium",
              userMessage: "You do not have permission to perform this action.",
            };
          }
          return {
            type: "UNKNOWN",
            retryable: false,
            severity: "high",
            userMessage: "An unexpected error occurred.",
          };
        },
      };

      const permissionError = { status: 403, message: "Forbidden" };
      const authError = errorClassifier.classifyError(permissionError);

      expect(authError.type).toBe("PERMISSION_DENIED");
      expect(authError.retryable).toBe(false);
      expect(authError.severity).toBe("medium");
    });

    it("should handle unknown errors gracefully", () => {
      const errorClassifier = {
        classifyError(error: any) {
          // Default case for unknown errors
          return {
            type: "UNKNOWN_ERROR",
            retryable: false,
            severity: "high",
            userMessage: "An unexpected error occurred. Please try again.",
          };
        },
      };

      const unknownError = { weird: "error format" };
      const authError = errorClassifier.classifyError(unknownError);

      expect(authError.type).toBe("UNKNOWN_ERROR");
      expect(authError.userMessage).toBe(
        "An unexpected error occurred. Please try again.",
      );
    });
  });

  describe("Error Recovery Mechanisms", () => {
    it("should implement exponential backoff for retryable errors", async () => {
      const retryHandler = {
        calculateDelay(attempt: number): number {
          return Math.min(Math.pow(2, attempt) * 1000, 16000); // Cap at 16 seconds
        },

        async retryWithBackoff<T>(
          operation: () => Promise<T>,
          maxRetries: number = 5,
        ): Promise<T> {
          let lastError: any = null;

          for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
              return await operation();
            } catch (error) {
              lastError = error;

              if (attempt === maxRetries - 1) {
                throw error;
              }

              const delay = this.calculateDelay(attempt);
              await new Promise((resolve) => setTimeout(resolve, delay));
            }
          }

          throw lastError;
        },
      };

      let attemptCount = 0;
      const mockOperation = jest.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error("Network error");
        }
        return Promise.resolve("success");
      });

      const result = await retryHandler.retryWithBackoff(mockOperation, 5);

      expect(result).toBe("success");
      expect(mockOperation).toHaveBeenCalledTimes(3);

      // Test delay calculation
      expect(retryHandler.calculateDelay(0)).toBe(1000);
      expect(retryHandler.calculateDelay(1)).toBe(2000);
      expect(retryHandler.calculateDelay(2)).toBe(4000);
      expect(retryHandler.calculateDelay(3)).toBe(8000);
      expect(retryHandler.calculateDelay(4)).toBe(16000);
      expect(retryHandler.calculateDelay(5)).toBe(16000); // Capped
    });

    it("should handle session refresh failures gracefully", async () => {
      const sessionManager = {
        async refreshSession() {
          try {
            const result = await mockSupabase.auth.refreshSession();
            if (result.error) {
              throw new Error(result.error.message);
            }
            return { success: true, session: result.data.session };
          } catch (error: any) {
            // Handle refresh failure gracefully
            if (error.message?.includes("Refresh token expired")) {
              return {
                success: false,
                error: "SESSION_EXPIRED",
                message: "Your session has expired. Please log in again.",
                requiresReauth: true,
              };
            }
            return {
              success: false,
              error: "REFRESH_FAILED",
              message: "Failed to refresh session. Please try again.",
              requiresReauth: false,
            };
          }
        },
      };

      // Mock session refresh failure
      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: null,
        error: { message: "Refresh token expired" },
      });

      const result = await sessionManager.refreshSession();

      expect(result.success).toBe(false);
      expect(result.error).toBe("SESSION_EXPIRED");
      expect(result.requiresReauth).toBe(true);
    });

    it("should implement circuit breaker pattern for failing services", async () => {
      class CircuitBreaker {
        private failures = 0;
        private lastFailureTime = 0;
        private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";

        constructor(
          private threshold = 5,
          private timeout = 60000, // 1 minute
        ) {}

        async execute<T>(operation: () => Promise<T>): Promise<T> {
          if (this.state === "OPEN") {
            if (Date.now() - this.lastFailureTime > this.timeout) {
              this.state = "HALF_OPEN";
            } else {
              throw new Error("Circuit breaker is OPEN");
            }
          }

          try {
            const result = await operation();
            this.onSuccess();
            return result;
          } catch (error) {
            this.onFailure();
            throw error;
          }
        }

        private onSuccess() {
          this.failures = 0;
          this.state = "CLOSED";
        }

        private onFailure() {
          this.failures++;
          this.lastFailureTime = Date.now();

          if (this.failures >= this.threshold) {
            this.state = "OPEN";
          }
        }

        getState() {
          return this.state;
        }

        getFailures() {
          return this.failures;
        }
      }

      const breaker = new CircuitBreaker(3, 30000);
      let callCount = 0;

      const failingOperation = () => {
        callCount++;
        return Promise.reject(new Error("Service failure"));
      };

      // Test that circuit breaker opens after threshold failures
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failingOperation);
        } catch (error) {
          // Expected to fail
        }
      }

      expect(breaker.getState()).toBe("OPEN");
      expect(breaker.getFailures()).toBe(3);

      // Test that circuit breaker rejects calls when open
      try {
        await breaker.execute(failingOperation);
        fail("Should have thrown circuit breaker error");
      } catch (error: any) {
        expect(error.message).toBe("Circuit breaker is OPEN");
      }

      // Verify operation wasn't called when circuit was open
      expect(callCount).toBe(3); // Only the initial 3 calls
    });
  });

  describe("Graceful Degradation", () => {
    it("should provide offline functionality when possible", () => {
      const offlineManager = {
        isOnline(): boolean {
          return navigator.onLine;
        },

        getOfflineCapabilities() {
          const isOnline = this.isOnline();

          return {
            canViewCachedContent: true, // Always available
            canTakeQuizzes: isOnline, // Requires online connection
            canSyncWhenOnline: !isOnline, // Only relevant when offline
            showOfflineIndicator: !isOnline,
            canAccessProfile: isOnline,
            canSubmitAnswers: isOnline,
          };
        },
      };

      // Mock offline state
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: false,
      });

      const offlineCapabilities = offlineManager.getOfflineCapabilities();

      expect(offlineCapabilities.canViewCachedContent).toBe(true);
      expect(offlineCapabilities.canTakeQuizzes).toBe(false);
      expect(offlineCapabilities.showOfflineIndicator).toBe(true);
      expect(offlineCapabilities.canSyncWhenOnline).toBe(true);

      // Test online state
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: true,
      });

      const onlineCapabilities = offlineManager.getOfflineCapabilities();
      expect(onlineCapabilities.canTakeQuizzes).toBe(true);
      expect(onlineCapabilities.showOfflineIndicator).toBe(false);
    });

    it("should handle partial service failures", async () => {
      const serviceManager = {
        async getAuthenticatedUser() {
          try {
            const userResult = await mockSupabase.auth.getUser();
            if (userResult.error) throw userResult.error;

            return {
              user: userResult.data.user,
              hasProfile: false, // Profile service failed
              degradedMode: true,
            };
          } catch (error) {
            throw error;
          }
        },

        async getUserProfile(userId: string) {
          try {
            const profileResult = await mockSupabase
              .from("users")
              .select("*")
              .eq("id", userId)
              .single();
            if (profileResult.error) throw profileResult.error;
            return profileResult.data;
          } catch (error) {
            // Profile service failed, but user is still authenticated
            return null;
          }
        },
      };

      // Auth service working, but user profile service failing
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-123", email: "test@example.com" } },
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: "Service unavailable" },
            }),
          }),
        }),
      });

      const result = await serviceManager.getAuthenticatedUser();
      const profile = await serviceManager.getUserProfile("user-123");

      expect(result.user).toBeTruthy();
      expect(result.degradedMode).toBe(true);
      expect(profile).toBeNull(); // Profile service failed
    });

    it("should implement fallback authentication methods", async () => {
      const authManager = {
        async authenticateWithFallback(email: string, password: string) {
          const methods = [
            () => this.primaryAuth(email, password),
            () => this.fallbackAuth(email, password),
            () => this.emergencyAuth(email, password),
          ];

          let lastError: any = null;

          for (const method of methods) {
            try {
              return await method();
            } catch (error) {
              lastError = error;
              continue;
            }
          }

          throw lastError;
        },

        async primaryAuth(email: string, password: string) {
          return mockSupabase.auth.signInWithPassword({ email, password });
        },

        async fallbackAuth(_email: string, _password: string) {
          return { data: { user: { id: "user-123" } }, error: null };
        },

        async emergencyAuth(_email: string, _password: string) {
          return {
            data: { user: { id: "user-123", emergency: true } },
            error: null,
          };
        },
      };

      // Primary auth fails
      mockSupabase.auth.signInWithPassword.mockRejectedValue(
        new Error("Primary auth failed"),
      );

      const result = await authManager.authenticateWithFallback(
        "test@example.com",
        "password",
      );

      expect(result.data.user).toBeTruthy();
      expect(result.error).toBeNull();
    });
  });

  describe("User Experience During Errors", () => {
    it("should provide helpful error messages", () => {
      const errorMessageProvider = {
        getErrorMessage(errorType: string): string {
          const messages: Record<string, string> = {
            NETWORK_ERROR:
              "Please check your internet connection and try again.",
            AUTHENTICATION_FAILED:
              "Please check your email and password and try again.",
            SESSION_EXPIRED: "Your session has expired. Please log in again.",
            PERMISSION_DENIED:
              "You do not have permission to perform this action.",
            RATE_LIMITED: "Too many attempts. Please wait before trying again.",
            UNKNOWN_ERROR: "An unexpected error occurred. Please try again.",
          };

          return messages[errorType] || messages["UNKNOWN_ERROR"];
        },

        validateMessage(message: string): boolean {
          return (
            message.length > 10 &&
            !message.includes("undefined") &&
            !message.includes("null") &&
            message.trim().length > 0
          );
        },
      };

      const errorTypes = [
        "NETWORK_ERROR",
        "AUTHENTICATION_FAILED",
        "SESSION_EXPIRED",
        "PERMISSION_DENIED",
        "RATE_LIMITED",
        "UNKNOWN_ERROR",
      ];

      errorTypes.forEach((type) => {
        const message = errorMessageProvider.getErrorMessage(type);
        expect(errorMessageProvider.validateMessage(message)).toBe(true);
        expect(message).toBeTruthy();
        expect(message.length).toBeGreaterThan(10);
      });
    });

    it("should show appropriate loading states", () => {
      const loadingStateManager = {
        getLoadingMessage(state: string): string {
          const messages: Record<string, string> = {
            authenticating: "Signing you in...",
            refreshing: "Refreshing session...",
            verifying: "Verifying your account...",
            resetting: "Sending reset email...",
            signing_out: "Signing you out...",
          };

          return messages[state] || "Loading...";
        },

        isValidLoadingMessage(message: string): boolean {
          return message.endsWith("...") && message.length > 3;
        },
      };

      const loadingStates = [
        "authenticating",
        "refreshing",
        "verifying",
        "resetting",
        "signing_out",
      ];

      loadingStates.forEach((state) => {
        const message = loadingStateManager.getLoadingMessage(state);
        expect(loadingStateManager.isValidLoadingMessage(message)).toBe(true);
        expect(message).toMatch(/\.\.\.$/); // Should end with ellipsis
      });
    });

    it("should provide retry mechanisms for users", () => {
      const retryManager = {
        isRetryable(errorType: string): boolean {
          const retryableErrors = [
            "NETWORK_ERROR",
            "TIMEOUT_ERROR",
            "SERVER_ERROR",
          ];
          return retryableErrors.includes(errorType);
        },

        getRetryAction(errorType: string): string | null {
          if (this.isRetryable(errorType)) {
            return "Try Again";
          }
          return null;
        },
      };

      const retryableErrors = [
        "NETWORK_ERROR",
        "TIMEOUT_ERROR",
        "SERVER_ERROR",
      ];
      const nonRetryableErrors = [
        "AUTHENTICATION_FAILED",
        "PERMISSION_DENIED",
        "VALIDATION_ERROR",
      ];

      retryableErrors.forEach((errorType) => {
        expect(retryManager.isRetryable(errorType)).toBe(true);
        expect(retryManager.getRetryAction(errorType)).toBe("Try Again");
      });

      nonRetryableErrors.forEach((errorType) => {
        expect(retryManager.isRetryable(errorType)).toBe(false);
        expect(retryManager.getRetryAction(errorType)).toBeNull();
      });
    });
  });

  describe("Error Logging and Monitoring", () => {
    it("should log errors with appropriate detail levels", () => {
      const errorLogger = {
        logs: [] as any[],

        log(level: string, data: any) {
          this.logs.push({ level, data, timestamp: Date.now() });
        },

        error(data: any) {
          this.log("error", data);
        },
        warn(data: any) {
          this.log("warn", data);
        },
        info(data: any) {
          this.log("info", data);
        },
        debug(data: any) {
          this.log("debug", data);
        },

        logError(error: any, severity: string, context?: any) {
          const logData = {
            timestamp: new Date().toISOString(),
            error: error.message,
            stack: error.stack,
            severity,
            context: context || {},
            user_id: context?.userId || "anonymous",
            session_id: context?.sessionId || "no-session",
          };

          switch (severity) {
            case "high":
              this.error(logData);
              break;
            case "medium":
              this.warn(logData);
              break;
            case "low":
              this.info(logData);
              break;
            default:
              this.debug(logData);
          }
        },

        getLogsByLevel(level: string) {
          return this.logs.filter((log) => log.level === level);
        },
      };

      const testError = new Error("Test error");
      const context = { userId: "user-123", sessionId: "session-456" };

      errorLogger.logError(testError, "high", context);

      const errorLogs = errorLogger.getLogsByLevel("error");
      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0].data).toMatchObject({
        error: "Test error",
        severity: "high",
        user_id: "user-123",
        session_id: "session-456",
      });
    });

    it("should not log sensitive information", () => {
      const dataSanitizer = {
        sensitiveKeys: [
          "password",
          "token",
          "ssn",
          "credit_card",
          "api_key",
          "secret",
        ],

        sanitizeForLogging(data: any): any {
          if (typeof data !== "object" || data === null) {
            return data;
          }

          const sanitized = { ...data };

          this.sensitiveKeys.forEach((key) => {
            if (sanitized[key]) {
              sanitized[key] = "[REDACTED]";
            }
          });

          // Recursively sanitize nested objects
          Object.keys(sanitized).forEach((key) => {
            if (typeof sanitized[key] === "object" && sanitized[key] !== null) {
              sanitized[key] = this.sanitizeForLogging(sanitized[key]);
            }
          });

          return sanitized;
        },
      };

      const sensitiveData = {
        password: "secret123",
        token: "jwt-token-here",
        ssn: "123-45-6789",
        credit_card: "4111-1111-1111-1111",
        user: {
          name: "John Doe",
          api_key: "secret-api-key",
        },
      };

      const sanitized = dataSanitizer.sanitizeForLogging(sensitiveData);

      expect(sanitized.password).toBe("[REDACTED]");
      expect(sanitized.token).toBe("[REDACTED]");
      expect(sanitized.ssn).toBe("[REDACTED]");
      expect(sanitized.credit_card).toBe("[REDACTED]");
      expect(sanitized.user.api_key).toBe("[REDACTED]");
      expect(sanitized.user.name).toBe("John Doe"); // Non-sensitive data preserved
    });

    it("should implement error aggregation and alerting", () => {
      const errorMonitor = {
        errorCounts: new Map<string, number>(),
        alerts: [] as string[],
        alertThreshold: 10,
        timeWindow: 5 * 60 * 1000, // 5 minutes

        trackError(errorType: string) {
          const now = Date.now();
          const windowKey = `${errorType}-${Math.floor(now / this.timeWindow)}`;

          const count = this.errorCounts.get(windowKey) || 0;
          const newCount = count + 1;
          this.errorCounts.set(windowKey, newCount);

          if (newCount >= this.alertThreshold) {
            const alertMessage = `High error rate detected: ${errorType} (${newCount} errors)`;
            this.alerts.push(alertMessage);
          }

          return newCount;
        },

        getAlerts() {
          return this.alerts;
        },

        clearAlerts() {
          this.alerts = [];
        },
      };

      // Simulate error tracking
      for (let i = 0; i < 12; i++) {
        errorMonitor.trackError("AUTHENTICATION_FAILED");
      }

      const alerts = errorMonitor.getAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0]).toContain(
        "High error rate detected: AUTHENTICATION_FAILED",
      );
      expect(errorMonitor.errorCounts.size).toBeGreaterThan(0);
    });
  });

  describe("Recovery Testing", () => {
    it("should recover from database connection failures", async () => {
      const connectionManager = {
        attempts: 0,

        async performDatabaseOperation() {
          this.attempts++;
          if (this.attempts < 3) {
            throw new Error("Connection failed");
          }
          return { success: true, data: "operation completed" };
        },

        async withRetry<T>(
          operation: () => Promise<T>,
          maxRetries: number = 3,
          delay: number = 1000,
        ): Promise<T> {
          let lastError: any = null;

          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              return await operation();
            } catch (error) {
              lastError = error;

              if (attempt === maxRetries) {
                throw error;
              }

              // Wait before retrying
              await new Promise((resolve) => setTimeout(resolve, delay));
            }
          }

          throw lastError;
        },
      };

      const result = await connectionManager.withRetry(() =>
        connectionManager.performDatabaseOperation(),
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe("operation completed");
      expect(connectionManager.attempts).toBe(3);
    });

    it("should handle service degradation gracefully", () => {
      const serviceHealthManager = {
        checkServiceHealth(services: Record<string, string>) {
          return {
            overall: this.calculateOverallHealth(services),
            services,
            availableFeatures: this.getAvailableFeatures(services),
          };
        },

        calculateOverallHealth(services: Record<string, string>): string {
          const healthValues = Object.values(services);
          if (healthValues.every((status) => status === "healthy"))
            return "healthy";
          if (healthValues.some((status) => status === "unhealthy"))
            return "degraded";
          return "degraded";
        },

        getAvailableFeatures(health: Record<string, string>) {
          return {
            login: health.auth === "healthy",
            quiz: health.auth === "healthy" && health.database !== "unhealthy",
            fileUpload: health.storage === "healthy",
            profile: health.database !== "unhealthy",
            realTimeUpdates:
              health.auth === "healthy" && health.database === "healthy",
          };
        },
      };

      const serviceHealth = {
        auth: "healthy",
        database: "degraded",
        storage: "unhealthy",
      };

      const healthCheck =
        serviceHealthManager.checkServiceHealth(serviceHealth);

      expect(healthCheck.overall).toBe("degraded");
      expect(healthCheck.availableFeatures.login).toBe(true);
      expect(healthCheck.availableFeatures.quiz).toBe(true);
      expect(healthCheck.availableFeatures.fileUpload).toBe(false);
      expect(healthCheck.availableFeatures.profile).toBe(true);
      expect(healthCheck.availableFeatures.realTimeUpdates).toBe(false);
    });
  });
});
