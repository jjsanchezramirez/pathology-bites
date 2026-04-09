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
  default_mode: "tutor" as const,
  default_timing: "untimed" as const,
  default_question_type: "unused" as const,
  default_category_selection: "all" as const,
};

/**
 * Default notification settings for new users
 */
export const DEFAULT_NOTIFICATION_SETTINGS = {
  email_notifications: true,
  quiz_reminders: true,
  progress_updates: true,
};

/**
 * Default UI settings for new users
 *
 * Field explanations:
 * - text_zoom: Zoom level multiplier (0.8 to 1.5)
 * - dashboard_theme_admin: Dashboard theme for admin/creator/reviewer mode (always 'default')
 * - dashboard_theme_user: Dashboard theme for student mode (default 'tangerine', can be 'notebook' or 'tangerine')
 * - theme: Color mode preference ('light', 'dark', or 'system') - synced with next-themes
 * - welcome_message_seen: Whether user has seen the welcome message
 * - v1_release_dismissed: Whether user has dismissed the v1.0 release announcement
 */
export const DEFAULT_UI_SETTINGS = {
  text_zoom: 1.0,
  dashboard_theme_admin: "default",
  dashboard_theme_user: "tangerine",
  theme: "system",
  welcome_message_seen: false,
  v1_release_dismissed: false,
};

/**
 * Cell counter config types (server-persisted portion only — counts stay in localStorage)
 */
export interface CounterCellTypeConfig {
  id: string;
  name: string;
  key: string;
  color: string;
}

export interface CounterSettingsConfig {
  countLimit: number;
  enableLimit: boolean;
  enableUndo: boolean;
  maxUndoHistory: number;
}

export interface SavedPreset {
  id: string;
  name: string;
  cellTypes: CounterCellTypeConfig[];
  settings: CounterSettingsConfig;
}

export interface CounterConfig {
  cellTypes: CounterCellTypeConfig[];
  settings: CounterSettingsConfig;
  presetType: "peripheral-blood" | "bone-marrow" | "custom";
  savedPresets?: SavedPreset[];
}

export const DEFAULT_COUNTER_SETTINGS: CounterConfig = {
  cellTypes: [
    { id: "pb1", name: "Segmented neutrophil", key: "k", color: "bg-amber-600" },
    { id: "pb2", name: "Band neutrophil", key: "j", color: "bg-rose-600" },
    { id: "pb3", name: "Lymphocyte", key: "l", color: "bg-pink-600" },
    { id: "pb4", name: "Monocyte", key: ";", color: "bg-indigo-600" },
    { id: "pb5", name: "Eosinophil", key: "n", color: "bg-lime-600" },
    { id: "pb6", name: "Basophil", key: "m", color: "bg-purple-600" },
  ],
  settings: {
    countLimit: 100,
    enableLimit: true,
    enableUndo: true,
    maxUndoHistory: 50,
  },
  presetType: "peripheral-blood",
  savedPresets: [],
};

/**
 * Complete default user settings object
 */
export const DEFAULT_USER_SETTINGS = {
  quiz_settings: DEFAULT_QUIZ_SETTINGS,
  notification_settings: DEFAULT_NOTIFICATION_SETTINGS,
  ui_settings: DEFAULT_UI_SETTINGS,
  counter_settings: null as CounterConfig | null,
};

/**
 * Type definitions for settings
 */
export type QuizSettings = typeof DEFAULT_QUIZ_SETTINGS;
export type NotificationSettings = typeof DEFAULT_NOTIFICATION_SETTINGS;
export type UISettings = typeof DEFAULT_UI_SETTINGS;
export type UserSettings = typeof DEFAULT_USER_SETTINGS;
