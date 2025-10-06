// src/shared/config/feature-flags.ts
// Hard-coded feature flags to reduce environment variable complexity
// These values rarely change and can be safely hard-coded

/**
 * Application feature flags
 * These are hard-coded constants that were previously environment variables
 */
export const FEATURE_FLAGS = {
  // Coming soon mode - set to true to show coming soon page instead of login
  COMING_SOON_MODE: false,
  
  // Maintenance mode - set to true to show maintenance page for non-admin users
  MAINTENANCE_MODE: false,
  
  // Launch date for countdown timer (ISO date string)
  LAUNCH_DATE: '2025-08-10',
} as const

/**
 * Helper functions for feature flag checks
 */
export const isComingSoonMode = () => FEATURE_FLAGS.COMING_SOON_MODE
export const isMaintenanceMode = () => FEATURE_FLAGS.MAINTENANCE_MODE
export const getLaunchDate = () => FEATURE_FLAGS.LAUNCH_DATE

/**
 * Get feature flags object (for compatibility with existing code)
 */
export const getFeatureFlags = () => ({
  comingSoonMode: FEATURE_FLAGS.COMING_SOON_MODE,
  maintenanceMode: FEATURE_FLAGS.MAINTENANCE_MODE,
})
