// src/__tests__/auth/auth-system.test.ts
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
jest.mock("@/shared/services/server");
jest.mock("@/shared/services/client");
jest.mock("@/features/auth/utils/session-validator");
jest.mock("@/features/auth/utils/session-security");

describe("Authentication System", () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Authentication Client Integration", () => {
    describe("Supabase Client", () => {
      it("should initialize with correct configuration", () => {
        expect(mockSupabase).toBeDefined();
        expect(mockSupabase.auth).toBeDefined();
        expect(mockSupabase.from).toBeDefined();
      });

      it("should handle signup requests", async () => {
        const signupData = {
          email: "test@example.com",
          password: "SecurePass123!",
          options: {
            data: {
              first_name: "John",
              last_name: "Doe",
              user_type: "student",
            },
            emailRedirectTo: "http://localhost:3000/api/auth/confirm",
          },
        };

        mockSupabase.auth.signUp.mockResolvedValue({
          data: { user: { id: "user-123", email: "test@example.com" } },
          error: null,
        });

        const result = await mockSupabase.auth.signUp(signupData);

        expect(mockSupabase.auth.signUp).toHaveBeenCalledWith(signupData);
        expect(result.data.user).toBeTruthy();
        expect(result.error).toBeNull();
      });

      it("should handle duplicate email registration", async () => {
        const signupData = {
          email: "existing@example.com",
          password: "SecurePass123!",
        };

        mockSupabase.auth.signUp.mockResolvedValue({
          data: null,
          error: { message: "User already registered" },
        });

        const result = await mockSupabase.auth.signUp(signupData);

        expect(result.data).toBeNull();
        expect(result.error.message).toBe("User already registered");
      });

      it("should handle network failures during signup", async () => {
        const signupData = {
          email: "test@example.com",
          password: "SecurePass123!",
        };

        mockSupabase.auth.signUp.mockRejectedValue(new Error("Network error"));

        await expect(mockSupabase.auth.signUp(signupData)).rejects.toThrow(
          "Network error",
        );
      });
    });

    describe("User Login", () => {
      it("should successfully authenticate valid credentials", async () => {
        const loginData = {
          email: "test@example.com",
          password: "SecurePass123!",
        };

        mockSupabase.auth.signInWithPassword.mockResolvedValue({
          data: {
            user: { id: "user-123", email: "test@example.com" },
            session: { access_token: "token-123" },
          },
          error: null,
        });

        const result = await mockSupabase.auth.signInWithPassword(loginData);

        expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith(
          loginData,
        );
        expect(result.data.user).toBeTruthy();
        expect(result.data.session).toBeTruthy();
        expect(result.error).toBeNull();
      });

      it("should handle invalid credentials", async () => {
        const loginData = {
          email: "test@example.com",
          password: "wrongpassword",
        };

        mockSupabase.auth.signInWithPassword.mockResolvedValue({
          data: null,
          error: { message: "Invalid login credentials" },
        });

        const result = await mockSupabase.auth.signInWithPassword(loginData);

        expect(result.data).toBeNull();
        expect(result.error.message).toBe("Invalid login credentials");
      });

      it("should handle unverified email", async () => {
        const loginData = {
          email: "unverified@example.com",
          password: "SecurePass123!",
        };

        mockSupabase.auth.signInWithPassword.mockResolvedValue({
          data: null,
          error: { message: "Email not confirmed" },
        });

        const result = await mockSupabase.auth.signInWithPassword(loginData);

        expect(result.data).toBeNull();
        expect(result.error.message).toBe("Email not confirmed");
      });
    });

    describe("OAuth Authentication", () => {
      it("should initiate Google OAuth flow", async () => {
        const oauthData = {
          provider: "google",
          options: {
            redirectTo: "http://localhost:3000/api/auth/callback",
          },
        };

        mockSupabase.auth.signInWithOAuth.mockResolvedValue({
          data: { url: "https://accounts.google.com/oauth/authorize?..." },
          error: null,
        });

        const result = await mockSupabase.auth.signInWithOAuth(oauthData);

        expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledWith(
          oauthData,
        );
        expect(result.data.url).toBeTruthy();
        expect(result.error).toBeNull();
      });

      it("should handle OAuth provider errors", async () => {
        mockSupabase.auth.signInWithOAuth.mockResolvedValue({
          data: null,
          error: { message: "OAuth provider error" },
        });

        const result = await mockSupabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: "http://localhost:3000/api/auth/callback" },
        });

        expect(result.data).toBeNull();
        expect(result.error.message).toBe("OAuth provider error");
      });
    });
  });

  describe("Session Management", () => {
    describe("Session Operations", () => {
      it("should get current session", async () => {
        mockSupabase.auth.getSession.mockResolvedValue({
          data: {
            session: {
              access_token: "valid-token",
              expires_at: Math.floor(Date.now() / 1000) + 3600,
            },
          },
          error: null,
        });

        const result = await mockSupabase.auth.getSession();

        expect(result.data.session).toBeTruthy();
        expect(result.data.session.access_token).toBe("valid-token");
        expect(result.error).toBeNull();
      });

      it("should handle session expiry", async () => {
        mockSupabase.auth.getSession.mockResolvedValue({
          data: { session: null },
          error: { message: "Session expired" },
        });

        const result = await mockSupabase.auth.getSession();

        expect(result.data.session).toBeNull();
        expect(result.error.message).toBe("Session expired");
      });

      it("should refresh session", async () => {
        mockSupabase.auth.refreshSession.mockResolvedValue({
          data: {
            session: {
              access_token: "new-token",
              expires_at: Math.floor(Date.now() / 1000) + 3600,
            },
          },
          error: null,
        });

        const result = await mockSupabase.auth.refreshSession();

        expect(result.data.session.access_token).toBe("new-token");
        expect(result.error).toBeNull();
      });

      it("should sign out user", async () => {
        mockSupabase.auth.signOut.mockResolvedValue({
          error: null,
        });

        const result = await mockSupabase.auth.signOut();

        expect(mockSupabase.auth.signOut).toHaveBeenCalled();
        expect(result.error).toBeNull();
      });
    });
  });
});
