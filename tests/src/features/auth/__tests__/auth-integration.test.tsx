// src/features/auth/__tests__/auth-integration.test.ts
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useAuth } from "../hooks/use-auth-status";
import { AuthProvider } from "../components/auth-provider";
import { SecurityMonitor } from "../components/security-monitor";
import { ErrorDisplay } from "../components/error-display";
import { AuthErrorType } from "../utils/error-handling";

// Mock Supabase client
const mockSupabase = {
  auth: {
    getSession: jest.fn(),
    getUser: jest.fn(),
    onAuthStateChange: jest.fn(),
    refreshSession: jest.fn(),
  },
};

jest.mock("@/shared/services/client", () => ({
  createClient: () => mockSupabase,
}));

// Test component that uses auth
function TestAuthComponent() {
  const { user, isAuthenticated, isLoading, error, securityRisk, refreshAuth } =
    useAuth();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.userMessage}</div>;
  if (!isAuthenticated) return <div>Not authenticated</div>;

  return (
    <div>
      <div>User: {user?.email}</div>
      <div>Security Risk: {securityRisk}</div>
      <button onClick={refreshAuth}>Refresh</button>
      <SecurityMonitor />
    </div>
  );
}

describe("Auth Integration Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    mockSupabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    });
  });

  describe("Authentication Flow", () => {
    it("should show loading state initially", () => {
      render(
        <AuthProvider>
          <TestAuthComponent />
        </AuthProvider>,
      );

      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("should show not authenticated when no session", async () => {
      render(
        <AuthProvider>
          <TestAuthComponent />
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("Not authenticated")).toBeInTheDocument();
      });
    });

    it("should show user info when authenticated", async () => {
      const mockUser = {
        id: "123",
        email: "test@example.com",
        user_metadata: {},
        app_metadata: {},
      };

      const mockSession = {
        user: mockUser,
        access_token: "token",
        refresh_token: "refresh",
      };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      render(
        <AuthProvider>
          <TestAuthComponent />
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("User: test@example.com")).toBeInTheDocument();
        expect(screen.getByText("Security Risk: low")).toBeInTheDocument();
      });
    });

    it("should handle session errors", async () => {
      const mockError = new Error("Session error");
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: mockError,
      });

      render(
        <AuthProvider>
          <TestAuthComponent />
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText(/Error:/)).toBeInTheDocument();
      });
    });

    it("should handle auth state changes", async () => {
      let authStateCallback: any;

      mockSupabase.auth.onAuthStateChange.mockImplementation((callback) => {
        authStateCallback = callback;
        return {
          data: { subscription: { unsubscribe: jest.fn() } },
        };
      });

      render(
        <AuthProvider>
          <TestAuthComponent />
        </AuthProvider>,
      );

      // Simulate sign in
      const mockUser = {
        id: "123",
        email: "test@example.com",
        user_metadata: {},
        app_metadata: {},
      };

      const mockSession = {
        user: mockUser,
        access_token: "token",
        refresh_token: "refresh",
      };

      await waitFor(() => {
        authStateCallback("SIGNED_IN", mockSession);
      });

      await waitFor(() => {
        expect(screen.getByText("User: test@example.com")).toBeInTheDocument();
      });

      // Simulate sign out
      await waitFor(() => {
        authStateCallback("SIGNED_OUT", null);
      });

      await waitFor(() => {
        expect(screen.getByText("Not authenticated")).toBeInTheDocument();
      });
    });

    it("should handle refresh auth", async () => {
      const mockUser = {
        id: "123",
        email: "test@example.com",
        user_metadata: {},
        app_metadata: {},
      };

      const mockSession = {
        user: mockUser,
        access_token: "token",
        refresh_token: "refresh",
      };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      render(
        <AuthProvider>
          <TestAuthComponent />
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("User: test@example.com")).toBeInTheDocument();
      });

      const refreshButton = screen.getByText("Refresh");
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(mockSupabase.auth.refreshSession).toHaveBeenCalled();
      });
    });
  });

  describe("Security Features", () => {
    it("should detect security risks", async () => {
      // Mock session security to return high risk
      jest.doMock("../utils/session-security", () => ({
        sessionSecurity: {
          validateSession: () => ({
            isValid: false,
            risk: "high",
            issues: ["User agent changed"],
          }),
          clearSession: jest.fn(),
        },
      }));

      const mockUser = {
        id: "123",
        email: "test@example.com",
        user_metadata: {},
        app_metadata: {},
      };

      const mockSession = {
        user: mockUser,
        access_token: "token",
        refresh_token: "refresh",
      };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      render(
        <AuthProvider>
          <TestAuthComponent />
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("Security Risk: high")).toBeInTheDocument();
      });
    });
  });

  describe("Error Handling", () => {
    it("should display network errors correctly", () => {
      const networkError = {
        type: AuthErrorType.NETWORK_ERROR,
        message: "Network failed",
        retryable: true,
        severity: "medium" as const,
        userMessage: "Please check your internet connection and try again.",
      };

      const mockRetry = jest.fn();

      render(
        <ErrorDisplay
          error={networkError}
          onRetry={mockRetry}
          showDetails={true}
        />,
      );

      expect(
        screen.getByText(
          "Please check your internet connection and try again.",
        ),
      ).toBeInTheDocument();
      expect(screen.getByText("Retry")).toBeInTheDocument();

      const retryButton = screen.getByText("Retry");
      fireEvent.click(retryButton);

      expect(mockRetry).toHaveBeenCalled();
    });

    it("should display authentication errors correctly", () => {
      const authError = {
        type: AuthErrorType.AUTHENTICATION_FAILED,
        message: "Invalid credentials",
        retryable: false,
        severity: "medium" as const,
        userMessage: "Please check your email and password and try again.",
      };

      render(<ErrorDisplay error={authError} />);

      expect(
        screen.getByText("Please check your email and password and try again."),
      ).toBeInTheDocument();
      expect(screen.queryByText("Retry")).not.toBeInTheDocument();
    });

    it("should show technical details when requested", () => {
      const errorWithDetails = {
        type: AuthErrorType.SERVER_ERROR,
        message: "Server error",
        retryable: true,
        severity: "high" as const,
        userMessage: "Server is temporarily unavailable.",
        technicalDetails: {
          status: 500,
          endpoint: "/api/auth",
        },
      };

      render(<ErrorDisplay error={errorWithDetails} showDetails={true} />);

      const showDetailsButton = screen.getByText("Show Details");
      fireEvent.click(showDetailsButton);

      expect(screen.getByText("Type:")).toBeInTheDocument();
      expect(screen.getByText("SERVER_ERROR")).toBeInTheDocument();
      expect(screen.getByText("Severity:")).toBeInTheDocument();
      expect(screen.getByText("high")).toBeInTheDocument();
    });
  });

  describe("Security Monitor", () => {
    it("should not show for unauthenticated users", () => {
      render(
        <AuthProvider>
          <SecurityMonitor />
        </AuthProvider>,
      );

      // Should not render anything for unauthenticated users
      expect(screen.queryByText(/security/i)).not.toBeInTheDocument();
    });

    it("should show security warnings for authenticated users with risks", async () => {
      // Mock high security risk
      jest.doMock("../hooks/use-auth-status", () => ({
        useAuth: () => ({
          securityRisk: "high",
          isAuthenticated: true,
          refreshAuth: jest.fn(),
        }),
      }));

      const { useAuth: mockUseAuth } = require("../hooks/use-auth-status");

      function TestSecurityMonitor() {
        const auth = mockUseAuth();
        return <SecurityMonitor />;
      }

      render(<TestSecurityMonitor />);

      await waitFor(() => {
        expect(
          screen.getByText(/High security risk detected/),
        ).toBeInTheDocument();
      });
    });
  });
});
