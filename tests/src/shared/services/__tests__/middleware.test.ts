import { NextRequest } from "next/server";
import { updateSession } from "../middleware";
import {
  createMockServerClient,
  mockUser,
  mockAdminUser,
} from "../../../__tests__/utils/supabase-mock";

// Mock the server client
jest.mock("@supabase/ssr", () => ({
  createServerClient: jest.fn(),
}));

// Mock NextResponse
jest.mock("next/server", () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    next: jest.fn(),
    redirect: jest.fn(),
  },
}));

describe("Middleware", () => {
  let mockClient: any;
  let mockRequest: Partial<NextRequest>;
  let mockResponse: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockResponse = {
      cookies: {
        set: jest.fn(),
      },
    };

    mockRequest = {
      nextUrl: {
        pathname: "/dashboard",
        clone: jest.fn().mockReturnValue({
          pathname: "/dashboard",
          searchParams: {
            set: jest.fn(),
          },
        }),
      } as any,
      cookies: {
        getAll: jest.fn().mockReturnValue([]),
        set: jest.fn(),
      } as any,
    } as any;

    mockClient = createMockServerClient();

    const { createServerClient } = require("@supabase/ssr");
    createServerClient.mockReturnValue(mockClient);

    const { NextResponse } = require("next/server");
    NextResponse.next.mockImplementation(() => mockResponse);
    NextResponse.redirect.mockImplementation((url: any) => ({ redirect: url }));
  });

  it("should bypass middleware for API routes", async () => {
    mockRequest.nextUrl!.pathname = "/api/auth/callback";

    const result = await updateSession(mockRequest as NextRequest);

    // Should return NextResponse.next() directly for API routes
    expect(result).toBe(mockResponse);
    expect(mockClient.auth.getUser).not.toHaveBeenCalled();
  });

  it("should allow access to auth pages without authentication", async () => {
    mockRequest.nextUrl!.pathname = "/login";
    mockClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const result = await updateSession(mockRequest as NextRequest);

    expect(result).toBe(mockResponse);
  });

  it("should redirect unauthenticated users to login for protected routes", async () => {
    mockRequest.nextUrl!.pathname = "/dashboard";
    mockClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const result = await updateSession(mockRequest as NextRequest);

    expect(result).toEqual({ redirect: expect.any(Object) });
  });

  it("should allow authenticated users to access protected routes", async () => {
    mockRequest.nextUrl!.pathname = "/dashboard";
    mockClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const result = await updateSession(mockRequest as NextRequest);

    expect(result).toBe(mockResponse);
  });

  it("should allow admin users to access admin routes", async () => {
    mockRequest.nextUrl!.pathname = "/admin/dashboard";
    mockClient.auth.getUser.mockResolvedValue({
      data: { user: mockAdminUser },
      error: null,
    });

    // Mock database query for admin role
    mockClient.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { role: "admin" },
            error: null,
          }),
        }),
      }),
    });

    const result = await updateSession(mockRequest as NextRequest);

    expect(result).toBe(mockResponse);
  });

  it("should redirect non-admin users from admin routes", async () => {
    mockRequest.nextUrl!.pathname = "/admin/dashboard";
    mockClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    // Mock database query for non-admin role
    mockClient.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { role: "user" },
            error: null,
          }),
        }),
      }),
    });

    const result = await updateSession(mockRequest as NextRequest);

    expect(result).toEqual({ redirect: expect.any(Object) });
  });

  it("should redirect admin users from regular dashboard to admin dashboard", async () => {
    mockRequest.nextUrl!.pathname = "/dashboard";
    mockClient.auth.getUser.mockResolvedValue({
      data: { user: mockAdminUser },
      error: null,
    });

    // Mock database query for admin role
    mockClient.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { role: "admin" },
            error: null,
          }),
        }),
      }),
    });

    const result = await updateSession(mockRequest as NextRequest);

    expect(result).toEqual({ redirect: expect.any(Object) });
  });

  it("should handle role check errors gracefully", async () => {
    mockRequest.nextUrl!.pathname = "/admin/dashboard";
    mockClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    // Mock database error
    mockClient.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockRejectedValue(new Error("Database error")),
        }),
      }),
    });

    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    const result = await updateSession(mockRequest as NextRequest);

    expect(result).toEqual({ redirect: expect.any(Object) });
    expect(consoleSpy).toHaveBeenCalledWith(
      "Error checking admin/reviewer role:",
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });

  it("should check admin role from user metadata first", async () => {
    const adminUserWithMetadata = {
      ...mockUser,
      user_metadata: { role: "admin" },
    };

    mockRequest.nextUrl!.pathname = "/admin/dashboard";
    mockClient.auth.getUser.mockResolvedValue({
      data: { user: adminUserWithMetadata },
      error: null,
    });

    const consoleSpy = jest.spyOn(console, "log").mockImplementation();

    const result = await updateSession(mockRequest as NextRequest);

    expect(result).toBe(mockResponse);
    expect(consoleSpy).toHaveBeenCalledWith(
      "Admin/Reviewer access granted via metadata",
    );

    consoleSpy.mockRestore();
  });

  it("should allow access to root path", async () => {
    mockRequest.nextUrl!.pathname = "/";
    mockClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const result = await updateSession(mockRequest as NextRequest);

    expect(result).toBe(mockResponse);
  });

  it("should handle static file paths", async () => {
    mockRequest.nextUrl!.pathname = "/_next/static/css/app.css";

    const result = await updateSession(mockRequest as NextRequest);

    expect(result).toBe(mockResponse);
  });

  it("should preserve redirect parameter in login URL", async () => {
    const mockClonedUrl = {
      pathname: "/dashboard",
      searchParams: {
        set: jest.fn(),
      },
    };

    mockRequest.nextUrl!.clone = jest.fn().mockReturnValue(mockClonedUrl);
    mockRequest.nextUrl!.pathname = "/protected-page";
    mockClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await updateSession(mockRequest as NextRequest);

    expect(mockClonedUrl.searchParams.set).toHaveBeenCalledWith(
      "redirect",
      "/protected-page",
    );
  });
});
