// src/shared/constants/user-settings-defaults.ts
/**
 * Centralized default values for user settings
 * 
 * These defaults are used across:
 * - Database function: create_user_settings_for_new_user
 * - API routes: /api/user/settings/*
 * - Frontend services: user-settings.ts
 * 
 * IMPORTANT: Keep these in sync with the database function!
 */

/**
 * Default quiz settings for new users
 */
export const DEFAULT_QUIZ_SETTINGS = {
  default_question_count: 10,
  default_mode: 'tutor' as const,
  default_timing: 'untimed' as const,
  default_question_type: 'unused' as const,
  default_category_selection: 'all' as const,
}

/**
 * Default notification settings for new users
 */
export const DEFAULT_NOTIFICATION_SETTINGS = {
  email_notifications: true,
  quiz_reminders: true,
  progress_updates: true,
}

/**
 * Default UI settings for new users
 *
 * Field explanations:
 * - theme: Color mode (light/dark/system) - controlled by next-themes
 * - font_size: Text size preference (small/medium/large)
 * - text_zoom: Zoom level multiplier (0.8 to 1.5)
 * - dashboard_theme_admin: Dashboard theme for admin/creator/reviewer mode (always 'default')
 * - dashboard_theme_user: Dashboard theme for student mode (default 'tangerine', can be 'notebook' or 'tangerine')
 * - sidebar_collapsed: Whether sidebar is collapsed
 * - welcome_message_seen: Whether user has seen the welcome message
 */
export const DEFAULT_UI_SETTINGS = {
  theme: 'system' as const,
  font_size: 'medium' as const,
  text_zoom: 1.0,
  dashboard_theme_admin: 'default',
  dashboard_theme_user: 'tangerine',
  sidebar_collapsed: false,
  welcome_message_seen: false,
}

/**
 * Complete default user settings object
 */
export const DEFAULT_USER_SETTINGS = {
  quiz_settings: DEFAULT_QUIZ_SETTINGS,
  notification_settings: DEFAULT_NOTIFICATION_SETTINGS,
  ui_settings: DEFAULT_UI_SETTINGS,
}

/**
 * Type definitions for settings
 */
export type QuizSettings = typeof DEFAULT_QUIZ_SETTINGS
export type NotificationSettings = typeof DEFAULT_NOTIFICATION_SETTINGS
export type UISettings = typeof DEFAULT_UI_SETTINGS
export type UserSettings = typeof DEFAULT_USER_SETTINGS

