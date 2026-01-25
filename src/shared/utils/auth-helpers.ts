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
 * Get user ID from request headers (set by middleware)
 * This is much faster than calling supabase directly
 */
export function getUserIdFromHeaders(request: Request): string | null {
  return request.headers.get("x-user-id");
}
