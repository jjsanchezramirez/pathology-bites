// src/shared/utils/auth-helpers.ts
/**
 * Centralized authorization utilities
 * Reduces duplicate role-checking logic across API routes
 */

import { type User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

export type UserRole = "admin" | "creator" | "reviewer" | "user";

export interface AuthUser extends User {
  app_metadata: {
    role?: UserRole;
  };
  user_metadata: {
    role?: UserRole;
  };
}

/**
 * Get user role from JWT (fastest, no database call)
 * Falls back to database if not in JWT
 */
export async function getUserRole(supabase: SupabaseClient, user: User): Promise<UserRole> {
  // Try to get role from JWT first (stored in app_metadata by Supabase)
  const authUser = user as AuthUser;
  const roleFromJWT = authUser.app_metadata?.role || authUser.user_metadata?.role;

  if (roleFromJWT && isValidRole(roleFromJWT)) {
    return roleFromJWT;
  }

  // Fallback: query database (should rarely happen)
  const { data, error } = await supabase.from("users").select("role").eq("id", user.id).single();

  if (error || !data) {
    return "user"; // Default to least privileged
  }

  return data.role as UserRole;
}

/**
 * Check if user has required role(s)
 */
export function hasRole(userRole: UserRole, requiredRoles: UserRole[]): boolean {
  return requiredRoles.includes(userRole);
}

/**
 * Check if user is admin
 */
export function isAdmin(role: UserRole): boolean {
  return role === "admin";
}

/**
 * Check if user is admin, creator, or reviewer
 */
export function isContentRole(role: UserRole): boolean {
  return ["admin", "creator", "reviewer"].includes(role);
}

/**
 * Validate role string
 */
export function isValidRole(role: string): role is UserRole {
  return ["admin", "creator", "reviewer", "user"].includes(role);
}

/**
 * Authorization result with detailed info
 */
export interface AuthResult {
  authorized: boolean;
  role: UserRole;
  userId: string;
  reason?: string;
}

/**
 * Get user ID from request headers (set by middleware)
 * This is much faster than calling supabase.auth.getUser()
 */
export function getUserIdFromHeaders(request: Request): string | null {
  return request.headers.get("x-user-id");
}

/**
 * Get user role from database using user ID
 * Used when we have userId from headers but need role info
 */
export async function getUserRoleById(supabase: SupabaseClient, userId: string): Promise<UserRole> {
  const { data, error } = await supabase.from("users").select("role").eq("id", userId).single();

  if (error || !data) {
    return "user"; // Default to least privileged
  }

  return data.role as UserRole;
}

/**
 * Authorize user for API route using x-user-id header (OPTIMIZED)
 * This avoids calling supabase.auth.getUser() by reading from headers
 *
 * Use this in API routes instead of authorizeUser() for better performance
 */
export async function authorizeRequest(
  request: Request,
  supabase: SupabaseClient,
  requiredRoles?: UserRole[]
): Promise<AuthResult> {
  // Get user ID from headers (set by middleware)
  const userId = getUserIdFromHeaders(request);

  if (!userId) {
    return {
      authorized: false,
      role: "user",
      userId: "",
      reason: "Not authenticated",
    };
  }

  // Get user role from database if needed
  let role: UserRole = "user";
  if (requiredRoles && requiredRoles.length > 0) {
    role = await getUserRoleById(supabase, userId);

    // Check authorization
    if (!hasRole(role, requiredRoles)) {
      return {
        authorized: false,
        role,
        userId,
        reason: `Requires one of: ${requiredRoles.join(", ")}`,
      };
    }
  }

  return {
    authorized: true,
    role,
    userId,
  };
}

/**
 * Authorize user for API route (LEGACY - uses getUser())
 * Returns structured result for consistent error handling
 *
 * DEPRECATED: Use authorizeRequest() instead for better performance
 */
export async function authorizeUser(
  supabase: SupabaseClient,
  requiredRoles: UserRole[]
): Promise<AuthResult> {
  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      authorized: false,
      role: "user",
      userId: "",
      reason: "Not authenticated",
    };
  }

  // Get user role
  const role = await getUserRole(supabase, user);

  // Check authorization
  if (!hasRole(role, requiredRoles)) {
    return {
      authorized: false,
      role,
      userId: user.id,
      reason: `Requires one of: ${requiredRoles.join(", ")}`,
    };
  }

  return {
    authorized: true,
    role,
    userId: user.id,
  };
}
