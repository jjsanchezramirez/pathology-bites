// src/shared/utils/auth-helpers.ts
/**
 * Role helpers. There are two roles, `user` and `admin`; finer access comes
 * from grantable permissions (see ./permissions.ts).
 */

export type UserRole = "admin" | "user";

/**
 * Check if user is admin
 */
export function isAdmin(role: UserRole | null | undefined): boolean {
  return role === "admin";
}

/**
 * Validate role string
 */
export function isValidRole(role: string): role is UserRole {
  return role === "admin" || role === "user";
}

/**
 * Get user ID from request headers (set by middleware)
 * This is much faster than calling supabase directly
 */
export function getUserIdFromHeaders(request: Request): string | null {
  return request.headers.get("x-user-id");
}
