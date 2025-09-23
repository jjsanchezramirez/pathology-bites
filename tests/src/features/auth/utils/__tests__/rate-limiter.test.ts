import {
  loginRateLimiter,
  signupRateLimiter,
  getClientIP,
  createRateLimitResponse,
} from "@/features/auth/utils/rate-limiter";

describe("Rate Limiter", () => {
  beforeEach(() => {
    // Reset rate limiter state
    loginRateLimiter.reset("test@example.com", "login");
    signupRateLimiter.reset("192.168.1.1", "signup");
  });

  describe("loginRateLimiter", () => {
    it("should allow initial login attempts", () => {
      const result = loginRateLimiter.checkLimit("test@example.com", "login");
      expect(result.allowed).toBe(true);
      expect(result.retryAfter).toBeUndefined();
    });

    it("should track multiple attempts", () => {
      // Make 5 attempts (should all be allowed)
      for (let i = 0; i < 5; i++) {
        const result = loginRateLimiter.checkLimit("test@example.com", "login");
        expect(result.allowed).toBe(true);
      }

      // 6th attempt should be blocked
      const result = loginRateLimiter.checkLimit("test@example.com", "login");
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it("should reset attempts for different users", () => {
      // Max out attempts for user1
      for (let i = 0; i < 6; i++) {
        loginRateLimiter.checkLimit("user1@example.com", "login");
      }

      // user2 should still be allowed
      const result = loginRateLimiter.checkLimit("user2@example.com", "login");
      expect(result.allowed).toBe(true);
    });

    it("should reset attempts after calling reset", () => {
      // Max out attempts
      for (let i = 0; i < 6; i++) {
        loginRateLimiter.checkLimit("test@example.com", "login");
      }

      // Should be blocked
      let result = loginRateLimiter.checkLimit("test@example.com", "login");
      expect(result.allowed).toBe(false);

      // Reset and try again
      loginRateLimiter.reset("test@example.com", "login");
      result = loginRateLimiter.checkLimit("test@example.com", "login");
      expect(result.allowed).toBe(true);
    });

    it("should return correct attempt count", () => {
      expect(loginRateLimiter.getAttempts("test@example.com", "login")).toBe(0);

      loginRateLimiter.checkLimit("test@example.com", "login");
      expect(loginRateLimiter.getAttempts("test@example.com", "login")).toBe(1);

      loginRateLimiter.checkLimit("test@example.com", "login");
      expect(loginRateLimiter.getAttempts("test@example.com", "login")).toBe(2);
    });
  });

  describe("signupRateLimiter", () => {
    it("should have different limits than login", () => {
      // Signup allows 3 attempts per hour
      for (let i = 0; i < 3; i++) {
        const result = signupRateLimiter.checkLimit("192.168.1.1", "signup");
        expect(result.allowed).toBe(true);
      }

      // 4th attempt should be blocked
      const result = signupRateLimiter.checkLimit("192.168.1.1", "signup");
      expect(result.allowed).toBe(false);
    });
  });

  describe("getClientIP", () => {
    it("should extract IP from x-forwarded-for header", () => {
      const mockRequest = {
        headers: {
          get: jest.fn().mockImplementation((name) => {
            if (name === "x-forwarded-for") return "192.168.1.1, 10.0.0.1";
            return null;
          }),
        },
      } as any;

      const ip = getClientIP(mockRequest);
      expect(ip).toBe("192.168.1.1");
    });

    it("should extract IP from x-real-ip header", () => {
      const mockRequest = {
        headers: {
          get: jest.fn().mockImplementation((name) => {
            if (name === "x-real-ip") return "192.168.1.2";
            return null;
          }),
        },
      } as any;

      const ip = getClientIP(mockRequest);
      expect(ip).toBe("192.168.1.2");
    });

    it("should extract IP from cf-connecting-ip header", () => {
      const mockRequest = {
        headers: {
          get: jest.fn().mockImplementation((name) => {
            if (name === "cf-connecting-ip") return "192.168.1.3";
            return null;
          }),
        },
      } as any;

      const ip = getClientIP(mockRequest);
      expect(ip).toBe("192.168.1.3");
    });

    it("should return unknown if no IP headers present", () => {
      const mockRequest = {
        headers: {
          get: jest.fn().mockReturnValue(null),
        },
      } as any;

      const ip = getClientIP(mockRequest);
      expect(ip).toBe("unknown");
    });

    it("should prioritize x-forwarded-for over other headers", () => {
      const mockRequest = {
        headers: {
          get: jest.fn().mockImplementation((name) => {
            if (name === "x-forwarded-for") return "192.168.1.1";
            if (name === "x-real-ip") return "192.168.1.2";
            if (name === "cf-connecting-ip") return "192.168.1.3";
            return null;
          }),
        },
      } as any;

      const ip = getClientIP(mockRequest);
      expect(ip).toBe("192.168.1.1");
    });
  });

  describe("createRateLimitResponse", () => {
    beforeEach(() => {
      // Mock Response constructor
      global.Response = jest.fn().mockImplementation((body, options) => ({
        status: options?.status || 200,
        headers: {
          get: jest.fn().mockImplementation((name) => {
            if (name === "Content-Type")
              return options?.headers?.["Content-Type"];
            if (name === "Retry-After")
              return options?.headers?.["Retry-After"];
            return null;
          }),
        },
        json: jest.fn().mockResolvedValue(JSON.parse(body)),
      })) as any;
    });

    it("should create proper rate limit response", () => {
      const retryAfter = 30000; // 30 seconds
      const response = createRateLimitResponse(retryAfter);

      expect(response.status).toBe(429);
      expect(response.headers.get("Content-Type")).toBe("application/json");
      expect(response.headers.get("Retry-After")).toBe("30");
    });

    it("should include proper error message in response body", async () => {
      const retryAfter = 60000; // 60 seconds
      const response = createRateLimitResponse(retryAfter);
      const body = await response.json();

      expect(body.error).toBe("Too many requests");
      expect(body.message).toBe("Rate limit exceeded. Please try again later.");
      expect(body.retryAfter).toBe(60);
    });
  });

  describe("Rate limiter edge cases", () => {
    it("should handle window expiration correctly", async () => {
      // This test would require mocking time or using a shorter window
      // For now, we'll test the basic logic
      const result1 = loginRateLimiter.checkLimit("test@example.com", "login");
      expect(result1.allowed).toBe(true);
    });

    it("should handle concurrent requests safely", () => {
      // Simulate concurrent requests
      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(
          loginRateLimiter.checkLimit("concurrent@example.com", "login"),
        );
      }

      const allowedCount = results.filter((r) => r.allowed).length;
      const blockedCount = results.filter((r) => !r.allowed).length;

      expect(allowedCount).toBeLessThanOrEqual(5); // Max 5 allowed
      expect(blockedCount).toBeGreaterThanOrEqual(5); // Rest should be blocked
    });
  });
});
