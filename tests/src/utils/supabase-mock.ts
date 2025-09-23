import { User, Session, AuthError } from "@supabase/supabase-js";

// This file contains mock utilities for testing - not actual tests

// Mock user data
export const mockUser: User = {
  id: "test-user-id",
  aud: "authenticated",
  role: "authenticated",
  email: "test@example.com",
  email_confirmed_at: "2024-01-01T00:00:00.000Z",
  phone: "",
  confirmed_at: "2024-01-01T00:00:00.000Z",
  last_sign_in_at: "2024-01-01T00:00:00.000Z",
  app_metadata: {},
  user_metadata: {
    first_name: "Test",
    last_name: "User",
    user_type: "student",
  },
  identities: [],
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:00:00.000Z",
  is_anonymous: false,
};

export const mockAdminUser: User = {
  ...mockUser,
  id: "admin-user-id",
  email: "admin@example.com",
  user_metadata: {
    first_name: "Admin",
    last_name: "User",
    user_type: "admin",
    role: "admin",
  },
};

export const mockSession: Session = {
  access_token: "mock-access-token",
  refresh_token: "mock-refresh-token",
  expires_in: 3600,
  expires_at: Date.now() / 1000 + 3600,
  token_type: "bearer",
  user: mockUser,
};

export const mockAdminSession: Session = {
  ...mockSession,
  user: mockAdminUser,
};

// Mock auth responses
export const mockAuthSuccess = {
  data: {
    user: mockUser,
    session: mockSession,
  },
  error: null,
};

export const mockAuthError = {
  name: "AuthError",
  message: "Invalid login credentials",
  status: 400,
  code: "test_error",
  __isAuthError: true,
} as unknown as AuthError;

export const mockAuthFailure = {
  data: {
    user: null,
    session: null,
  },
  error: mockAuthError,
};

// Mock Supabase client
export const createMockSupabaseClient = (overrides: any = {}) => {
  const defaultMock = {
    auth: {
      getUser: jest
        .fn()
        .mockResolvedValue({ data: { user: mockUser }, error: null }),
      getSession: jest
        .fn()
        .mockResolvedValue({ data: { session: mockSession }, error: null }),
      signUp: jest.fn().mockResolvedValue(mockAuthSuccess),
      signInWithPassword: jest.fn().mockResolvedValue(mockAuthSuccess),
      signInWithOAuth: jest
        .fn()
        .mockResolvedValue({ data: { url: "https://oauth.url" }, error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
      refreshSession: jest
        .fn()
        .mockResolvedValue({ data: { session: mockSession }, error: null }),
      verifyOtp: jest
        .fn()
        .mockResolvedValue({
          data: { user: mockUser, session: mockSession },
          error: null,
        }),
      onAuthStateChange: jest.fn().mockImplementation((callback) => {
        // Simulate initial auth state
        setTimeout(() => callback("SIGNED_IN", mockSession), 0);
        return {
          data: {
            subscription: {
              unsubscribe: jest.fn(),
            },
          },
        };
      }),
      exchangeCodeForSession: jest.fn().mockResolvedValue(mockAuthSuccess),
    },
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: { id: mockUser.id, role: "user", email: mockUser.email },
      error: null,
    }),
    insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
    update: jest.fn().mockResolvedValue({ data: {}, error: null }),
    delete: jest.fn().mockResolvedValue({ data: {}, error: null }),
  };

  return {
    ...defaultMock,
    ...overrides,
  };
};

// Mock server client
export const createMockServerClient = (overrides: any = {}) => {
  return createMockSupabaseClient(overrides);
};

// Mock browser client
export const createMockBrowserClient = (overrides: any = {}) => {
  return createMockSupabaseClient(overrides);
};
