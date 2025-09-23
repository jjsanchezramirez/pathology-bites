// This file contains test utilities for authentication testing - not actual tests

import React from "react";
import { render, RenderOptions } from "@testing-library/react";
import { AuthProvider } from "@/features/auth/components/auth-provider";
import {
  mockUser,
  mockSession,
  createMockSupabaseClient,
} from "./supabase-mock";

// Mock the Supabase client modules
jest.mock("@/shared/services/client", () => ({
  createClient: jest.fn(),
}));

jest.mock("@/shared/services/server", () => ({
  createClient: jest.fn(),
}));

// Custom render function with auth context
interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
  user?: any;
  session?: any;
  isLoading?: boolean;
  supabaseOverrides?: any;
}

export function renderWithAuth(
  ui: React.ReactElement,
  {
    user = mockUser,
    session = mockSession,
    isLoading = false,
    supabaseOverrides = {},
    ...renderOptions
  }: CustomRenderOptions = {},
) {
  // Mock the Supabase client
  const mockClient = createMockSupabaseClient({
    auth: {
      ...createMockSupabaseClient().auth,
      getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }),
      getSession: jest
        .fn()
        .mockResolvedValue({ data: { session }, error: null }),
      onAuthStateChange: jest.fn().mockImplementation((callback) => {
        if (!isLoading) {
          setTimeout(() => callback("SIGNED_IN", session), 0);
        }
        return {
          data: {
            subscription: {
              unsubscribe: jest.fn(),
            },
          },
        };
      }),
      ...supabaseOverrides.auth,
    },
    ...supabaseOverrides,
  });

  // Mock the client creation functions
  const { createClient } = require("@/shared/services/client");
  createClient.mockReturnValue(mockClient);

  function Wrapper({ children }: { children: React.ReactNode }) {
    return <AuthProvider>{children}</AuthProvider>;
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    mockClient,
  };
}

// Render without auth (unauthenticated state)
export function renderWithoutAuth(
  ui: React.ReactElement,
  options: Omit<CustomRenderOptions, "user" | "session"> = {},
) {
  return renderWithAuth(ui, {
    ...options,
    user: null,
    session: null,
  });
}

// Render with admin user
export function renderWithAdminAuth(
  ui: React.ReactElement,
  options: CustomRenderOptions = {},
) {
  const adminUser = {
    ...mockUser,
    id: "admin-user-id",
    email: "admin@example.com",
    user_metadata: {
      ...mockUser.user_metadata,
      role: "admin",
    },
  };

  const adminSession = {
    ...mockSession,
    user: adminUser,
  };

  return renderWithAuth(ui, {
    ...options,
    user: adminUser,
    session: adminSession,
    supabaseOverrides: {
      ...options.supabaseOverrides,
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: adminUser.id, role: "admin", email: adminUser.email },
              error: null,
            }),
          }),
        }),
      }),
    },
  });
}

// Mock form data helper
export function createMockFormData(data: Record<string, string>) {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    formData.append(key, value);
  });
  return formData;
}

// Mock next/navigation functions
export const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  prefetch: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
};

export const mockRedirect = jest.fn();

// Setup mocks for navigation
export function setupNavigationMocks() {
  // The mocks are already set up in jest.setup.js
  // Just return the mock objects for use in tests
  return { mockRouter, mockRedirect };
}

// Reset all mocks
export function resetAllMocks() {
  jest.clearAllMocks();
  mockRouter.push.mockClear();
  mockRouter.replace.mockClear();
  mockRouter.refresh.mockClear();
  mockRedirect.mockClear();
}

// Wait for auth state to settle
export function waitForAuth() {
  return new Promise((resolve) => setTimeout(resolve, 100));
}
