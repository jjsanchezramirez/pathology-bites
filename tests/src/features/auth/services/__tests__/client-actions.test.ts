/**
 * @jest-environment jsdom
 */
import { renderHook } from "@testing-library/react";
import { useAuthActions } from "../client-actions";
import {
  createMockSupabaseClient,
  mockSession,
} from "../../../../__tests__/utils/supabase-mock";
import { resetAllMocks } from "../../../../__tests__/utils/auth-test-utils";

// Mock the client
jest.mock("@/shared/services/client", () => ({
  createClient: jest.fn(),
}));

// Mock localStorage and sessionStorage
const mockLocalStorage = {
  clear: jest.fn(),
};

const mockSessionStorage = {
  clear: jest.fn(),
};

Object.defineProperty(window, "localStorage", {
  value: mockLocalStorage,
});

Object.defineProperty(window, "sessionStorage", {
  value: mockSessionStorage,
});

describe("useAuthActions", () => {
  let mockClient: any;
  let mockRouter: any;

  beforeEach(() => {
    resetAllMocks();

    // Mock useRouter to return our mock router
    const { useRouter } = require("next/navigation");
    useRouter.mockReturnValue({
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    });

    mockRouter = useRouter();

    mockClient = createMockSupabaseClient();
    const { createClient } = require("@/shared/services/client");
    createClient.mockReturnValue(mockClient);

    // Reset storage mocks
    mockLocalStorage.clear.mockClear();
    mockSessionStorage.clear.mockClear();
  });

  describe("signOut", () => {
    it("should successfully sign out user", async () => {
      mockClient.auth.signOut.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useAuthActions());

      await result.current.signOut();

      expect(mockClient.auth.signOut).toHaveBeenCalled();
      expect(mockLocalStorage.clear).toHaveBeenCalled();
      expect(mockSessionStorage.clear).toHaveBeenCalled();
      expect(window.location.href).toBe("/login");
    });

    it("should handle sign out errors gracefully", async () => {
      const signOutError = new Error("Sign out failed");
      mockClient.auth.signOut.mockResolvedValue({ error: signOutError });

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const { result } = renderHook(() => useAuthActions());

      await result.current.signOut();

      expect(consoleSpy).toHaveBeenCalledWith("Sign out error:", signOutError);
      expect(window.location.href).toBe("/login"); // Should still redirect

      consoleSpy.mockRestore();
    });

    it("should redirect to login even if signOut throws", async () => {
      mockClient.auth.signOut.mockRejectedValue(new Error("Network error"));

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const { result } = renderHook(() => useAuthActions());

      await result.current.signOut();

      expect(consoleSpy).toHaveBeenCalledWith(
        "Error during sign out:",
        expect.any(Error),
      );
      expect(window.location.href).toBe("/login");

      consoleSpy.mockRestore();
    });
  });

  describe("refreshSession", () => {
    it("should successfully refresh session", async () => {
      mockClient.auth.refreshSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const { result } = renderHook(() => useAuthActions());

      const session = await result.current.refreshSession();

      expect(mockClient.auth.refreshSession).toHaveBeenCalled();
      expect(mockRouter.refresh).toHaveBeenCalled();
      expect(session).toEqual(mockSession);
    });

    it("should handle refresh session errors", async () => {
      const refreshError = new Error("Refresh failed");
      mockClient.auth.refreshSession.mockResolvedValue({
        data: { session: null },
        error: refreshError,
      });

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const { result } = renderHook(() => useAuthActions());

      await expect(result.current.refreshSession()).rejects.toThrow(
        "Refresh failed",
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        "Session refresh error:",
        refreshError,
      );

      consoleSpy.mockRestore();
    });

    it("should handle refresh session network errors", async () => {
      const networkError = new Error("Network error");
      mockClient.auth.refreshSession.mockRejectedValue(networkError);

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const { result } = renderHook(() => useAuthActions());

      await expect(result.current.refreshSession()).rejects.toThrow(
        "Network error",
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        "Error refreshing session:",
        networkError,
      );

      consoleSpy.mockRestore();
    });
  });

  describe("getSession", () => {
    it("should successfully get current session", async () => {
      mockClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const { result } = renderHook(() => useAuthActions());

      const session = await result.current.getSession();

      expect(mockClient.auth.getSession).toHaveBeenCalled();
      expect(session).toEqual(mockSession);
    });

    it("should handle get session errors", async () => {
      const sessionError = new Error("Session error");
      mockClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: sessionError,
      });

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const { result } = renderHook(() => useAuthActions());

      await expect(result.current.getSession()).rejects.toThrow(
        "Session error",
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        "Get session error:",
        sessionError,
      );

      consoleSpy.mockRestore();
    });

    it("should handle get session network errors", async () => {
      const networkError = new Error("Network error");
      mockClient.auth.getSession.mockRejectedValue(networkError);

      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const { result } = renderHook(() => useAuthActions());

      await expect(result.current.getSession()).rejects.toThrow(
        "Network error",
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        "Error getting session:",
        networkError,
      );

      consoleSpy.mockRestore();
    });
  });
});
