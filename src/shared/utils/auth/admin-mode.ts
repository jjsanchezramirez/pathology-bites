// src/shared/utils/admin-mode.ts
/**
 * Utilities for admin mode detection and management
 *
 * Admin mode is which area a staff member is looking at, and so which
 * dashboard theme is available:
 * - admin (the /admin area; admins and anyone holding a permission): only 'default'
 * - user (the student dashboard): 'notebook' and 'tangerine'
 * What a staff member can do inside /admin depends on their permissions, not the mode.
 */

export type AdminMode = "admin" | "user";

const ADMIN_MODE_COOKIE_NAME = "admin-mode";
const ADMIN_MODE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * Get admin mode from cookie with fallback logic
 *
 * @param isStaff - Whether the user may open the admin area (admin or any permission)
 * @returns The current admin mode
 *
 * Logic: a valid cookie wins (old "creator"/"reviewer" values read as "admin");
 * otherwise staff default to "admin" and everyone else to "user".
 */
export function getAdminModeFromCookie(isStaff: boolean = false): AdminMode {
  if (typeof document === "undefined") {
    return isStaff ? "admin" : "user";
  }

  const adminModeCookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${ADMIN_MODE_COOKIE_NAME}=`))
    ?.split("=")[1];

  if (adminModeCookie === "user") return "user";
  if (adminModeCookie) return isStaff ? "admin" : "user";
  return isStaff ? "admin" : "user";
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
 * Check if a mode is the admin-area mode
 */
export function isAdminTypeMode(mode: AdminMode): boolean {
  return mode === "admin";
}
