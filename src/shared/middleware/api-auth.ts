// src/shared/middleware/api-auth.ts
/**
 * API route authorization middleware
 * Provides reusable authorization for API routes
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/services/server";
import { authorizeUser, type UserRole, type AuthResult } from "@/shared/utils/auth-helpers";

export interface AuthorizedRequest extends NextRequest {
  auth: AuthResult;
}

/**
 * Wrap an API route handler with authorization
 *
 * @example
 * export const GET = withAuth(['admin', 'creator'], async (request) => {
 *   // request.auth contains { authorized, role, userId }
 *   const userId = request.auth.userId
 *   // ... your handler code
 * })
 */
export function withAuth<T extends unknown[]>(
  requiredRoles: UserRole[],
  handler: (request: AuthorizedRequest, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const supabase = await createClient();

    // Authorize user
    const auth = await authorizeUser(supabase, requiredRoles);

    if (!auth.authorized) {
      return NextResponse.json(
        {
          error: auth.reason || "Unauthorized",
          requiredRoles,
        },
        { status: auth.userId ? 403 : 401 } // 401 if not logged in, 403 if wrong role
      );
    }

    // Attach auth to request
    const authorizedRequest = request as AuthorizedRequest;
    authorizedRequest.auth = auth;

    // Call handler
    return handler(authorizedRequest, ...args);
  };
}

/**
 * Simpler version that just checks authentication (any logged-in user)
 */
export function requireAuth<T extends unknown[]>(
  handler: (request: AuthorizedRequest, ...args: T) => Promise<NextResponse>
) {
  return withAuth(["admin", "creator", "reviewer", "user"], handler);
}

/**
 * Admin-only routes
 */
export function requireAdmin<T extends unknown[]>(
  handler: (request: AuthorizedRequest, ...args: T) => Promise<NextResponse>
) {
  return withAuth(["admin"], handler);
}

/**
 * Content roles (admin, creator, reviewer)
 */
export function requireContentRole<T extends unknown[]>(
  handler: (request: AuthorizedRequest, ...args: T) => Promise<NextResponse>
) {
  return withAuth(["admin", "creator", "reviewer"], handler);
}
