// src/shared/services/user-settings.ts
// Service for managing user settings

import {
  DEFAULT_QUIZ_SETTINGS,
  DEFAULT_NOTIFICATION_SETTINGS,
  DEFAULT_UI_SETTINGS,
  type QuizSettings,
  type NotificationSettings,
  type UISettings,
  type CounterConfig,
} from "@/shared/config/user-settings-defaults";

export type { QuizSettings, NotificationSettings, UISettings, CounterConfig };

export interface UserSettings {
  quiz_settings: QuizSettings;
  notification_settings: NotificationSettings;
  ui_settings: UISettings;
  counter_settings: CounterConfig | null;
  created_at: string;
  updated_at: string;
}

export type SettingsSection =
  | "quiz_settings"
  | "notification_settings"
  | "ui_settings"
  | "counter_settings";

class UserSettingsService {
  private baseUrl = "/api/user/settings";
  private csrfToken: string | null = null;

  /**
   * Get CSRF token for authenticated requests
   */
  private async getCSRFToken(): Promise<string> {
    // Return cached token if available
    if (this.csrfToken) {
      return this.csrfToken;
    }

    try {
      const response = await fetch("/api/public/csrf-token", {
        method: "GET",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch CSRF token: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success || !data.token) {
        throw new Error("Invalid CSRF token response");
      }

      this.csrfToken = data.token;
      return data.token;
    } catch (error) {
      console.error("CSRF token fetch error:", error);
      throw new Error("Failed to get CSRF token");
    }
  }

  /**
   * Get all user settings
   */
  async getUserSettings(): Promise<UserSettings> {
    try {
      const response = await fetch(this.baseUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        // Check if response is JSON before trying to parse it
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const error = await response.json();
          // If user not found (404), they may have been deleted - redirect to login
          if (response.status === 404) {
            if (typeof window !== "undefined") {
              window.location.href = "/login";
            }
            throw new Error("User not found");
          }
          throw new Error(error.error || "Failed to fetch user settings");
        } else {
          // Response is not JSON (likely HTML error page)
          console.error(
            "User settings API returned non-JSON response:",
            response.status,
            response.statusText
          );
          if (response.status === 401 || response.status === 403) {
            if (typeof window !== "undefined") {
              window.location.href = "/login";
            }
            throw new Error("Authentication required");
          }
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }
      }

      // Verify response is JSON before parsing
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Invalid response format from user settings API");
      }

      const result = await response.json();
      return result.data;
    } catch (fetchError) {
      console.error("Error in getUserSettings:", fetchError);
      throw fetchError;
    }
  }

  /**
   * Update a specific section of user settings
   */
  async updateSettingsSection<T extends SettingsSection>(
    section: T,
    settings: T extends "quiz_settings"
      ? Partial<QuizSettings>
      : T extends "notification_settings"
        ? Partial<NotificationSettings>
        : T extends "ui_settings"
          ? Partial<UISettings>
          : T extends "counter_settings"
            ? CounterConfig
            : never
  ): Promise<
    T extends "quiz_settings"
      ? QuizSettings
      : T extends "notification_settings"
        ? NotificationSettings
        : T extends "ui_settings"
          ? UISettings
          : T extends "counter_settings"
            ? CounterConfig
            : never
  > {
    // Get CSRF token for the request
    const csrfToken = await this.getCSRFToken();

    const response = await fetch(this.baseUrl, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrfToken,
      },
      credentials: "include",
      body: JSON.stringify({
        section,
        settings,
      }),
    });

    if (!response.ok) {
      let error;
      let responseText = "";
      try {
        responseText = await response.text();
        error = responseText ? JSON.parse(responseText) : {};
      } catch {
        error = { error: "Failed to parse error response", rawResponse: responseText };
      }
      console.error("[UserSettings] Update failed:", {
        status: response.status,
        statusText: response.statusText,
        error: error,
        section,
        settings: settings,
      });
      console.error("[UserSettings] Full error object:", JSON.stringify(error, null, 2));
      console.error("[UserSettings] Raw response:", responseText);
      throw new Error(error.error || error.details || "Failed to update user settings");
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Update quiz settings specifically
   */
  async updateQuizSettings(settings: Partial<QuizSettings>): Promise<QuizSettings> {
    return this.updateSettingsSection("quiz_settings", settings);
  }

  /**
   * Update notification settings specifically
   */
  async updateNotificationSettings(
    settings: Partial<NotificationSettings>
  ): Promise<NotificationSettings> {
    return this.updateSettingsSection("notification_settings", settings);
  }

  /**
   * Update UI settings specifically
   */
  async updateUISettings(settings: Partial<UISettings>): Promise<UISettings> {
    return this.updateSettingsSection("ui_settings", settings);
  }

  /**
   * Get quiz settings with fallback to defaults
   */
  async getQuizSettings(): Promise<QuizSettings> {
    try {
      const userSettings = await this.getUserSettings();
      return userSettings.quiz_settings;
    } catch (error) {
      console.error("Error fetching quiz settings, using defaults:", error);
      return DEFAULT_QUIZ_SETTINGS;
    }
  }

  /**
   * Get notification settings with fallback to defaults
   */
  async getNotificationSettings(): Promise<NotificationSettings> {
    try {
      const userSettings = await this.getUserSettings();
      return userSettings.notification_settings;
    } catch (error) {
      console.error("Error fetching notification settings, using defaults:", error);
      return DEFAULT_NOTIFICATION_SETTINGS;
    }
  }

  /**
   * Mark welcome message as seen for first-time users
   */
  async markWelcomeMessageSeen(): Promise<void> {
    try {
      await this.updateUISettings({ welcome_message_seen: true });
    } catch (error) {
      console.error("Error marking welcome message as seen:", error);
      throw error;
    }
  }

  /**
   * Check if user has seen the welcome message
   */
  async hasSeenWelcomeMessage(): Promise<boolean> {
    try {
      const userSettings = await this.getUserSettings();
      return userSettings.ui_settings.welcome_message_seen ?? false;
    } catch (error) {
      console.error("Error checking welcome message status:", error);
      // Default to true to avoid showing welcome message on error
      return true;
    }
  }

  /**
   * Mark v1.0 release announcement as dismissed
   */
  async markV1ReleaseDismissed(): Promise<void> {
    try {
      await this.updateUISettings({ v1_release_dismissed: true });
    } catch (error) {
      console.error("Error marking v1.0 release announcement as dismissed:", error);
      throw error;
    }
  }

  /**
   * Check if user has dismissed the v1.0 release announcement
   */
  async hasDismissedV1Release(): Promise<boolean> {
    try {
      const userSettings = await this.getUserSettings();
      return userSettings.ui_settings.v1_release_dismissed ?? false;
    } catch (error) {
      console.error("Error checking v1.0 release announcement status:", error);
      // Default to false to show the message on error (better to inform users)
      return false;
    }
  }

  /**
   * Update counter settings (full replacement, not partial merge)
   */
  async updateCounterSettings(settings: CounterConfig): Promise<CounterConfig> {
    return this.updateSettingsSection("counter_settings", settings);
  }

  /**
   * Get counter settings (returns null if not yet saved)
   */
  async getCounterSettings(): Promise<CounterConfig | null> {
    try {
      const userSettings = await this.getUserSettings();
      return userSettings.counter_settings;
    } catch (error) {
      console.error("Error fetching counter settings:", error);
      return null;
    }
  }

  /**
   * Get UI settings with fallback to defaults
   */
  async getUISettings(): Promise<UISettings> {
    try {
      const userSettings = await this.getUserSettings();
      return userSettings.ui_settings;
    } catch (error) {
      console.error("Error fetching UI settings, using defaults:", error);
      return DEFAULT_UI_SETTINGS;
    }
  }
}

// Export singleton instance
export const userSettingsService = new UserSettingsService();
