// src/shared/utils/admin-mode.ts
/**
 * Utilities for admin mode detection and management
 *
 * Admin mode determines which dashboard theme is available:
 * - admin/creator/reviewer: Only 'default' theme available
 * - user (student): 'notebook' and 'tangerine' themes available
 */

export type AdminMode = "admin" | "creator" | "reviewer" | "user";

const ADMIN_MODE_COOKIE_NAME = "admin-mode";
const ADMIN_MODE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * Get admin mode from cookie with fallback logic
 *
 * @param isAdmin - Whether the user has admin/creator/reviewer role
 * @param userRole - The user's actual role (admin, creator, reviewer, or user)
 * @returns The current admin mode
 *
 * Logic:
 * 1. If cookie exists, use it
 * 2. If no cookie and user has admin-type role, default to their actual role (admin/creator/reviewer)
 * 3. If no cookie and user is regular user, default to 'user' mode
 *
 * Note: The default is ALWAYS admin-type role for admin/creator/reviewer users
 */
export function getAdminModeFromCookie(
  isAdmin: boolean = false,
  userRole?: "admin" | "creator" | "reviewer" | "user"
): AdminMode {
  if (typeof document === "undefined") {
    // Server-side: use role-based default
    return userRole || (isAdmin ? "admin" : "user");
  }

  const adminModeCookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${ADMIN_MODE_COOKIE_NAME}=`))
    ?.split("=")[1] as AdminMode | undefined;

  // If cookie exists, use it
  if (adminModeCookie) {
    return adminModeCookie;
  }

  // If no cookie, default to actual role for admin-type users, 'user' for regular users
  // This ensures admin/creator/reviewer users start in their admin-type role by default
  if (userRole && (userRole === "admin" || userRole === "creator" || userRole === "reviewer")) {
    return userRole;
  }

  return isAdmin ? "admin" : "user";
}

/**
 * Set admin mode cookie
 *
 * @param mode - The admin mode to set
 */
export function setAdminModeCookie(mode: AdminMode): void {
  if (typeof document === "undefined") return;

  document.cookie = `${ADMIN_MODE_COOKIE_NAME}=${mode}; path=/; max-age=${ADMIN_MODE_COOKIE_MAX_AGE}`;
}

/**
 * Clear admin mode cookie
 *
 * This should be called on logout to prevent the cookie from persisting
 * across different user sessions.
 */
export function clearAdminModeCookie(): void {
  if (typeof document === "undefined") return;

  // Set max-age to 0 to delete the cookie
  document.cookie = `${ADMIN_MODE_COOKIE_NAME}=; path=/; max-age=0`;
}

/**
 * Get the theme key for the current admin mode
 *
 * @param mode - The current admin mode
 * @returns The key to use for accessing dashboard theme in ui_settings
 */
export function getThemeKeyForMode(
  mode: AdminMode
): "dashboard_theme_admin" | "dashboard_theme_user" {
  return mode === "user" ? "dashboard_theme_user" : "dashboard_theme_admin";
}

/**
 * Check if a mode is an admin-type mode (admin/creator/reviewer)
 *
 * @param mode - The mode to check
 * @returns True if the mode is admin/creator/reviewer
 */
export function isAdminTypeMode(mode: AdminMode): boolean {
  return mode === "admin" || mode === "creator" || mode === "reviewer";
}
