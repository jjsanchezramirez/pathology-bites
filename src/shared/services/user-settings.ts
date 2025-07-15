// src/shared/services/user-settings.ts
// Service for managing user settings

export interface QuizSettings {
  default_question_count: number
  default_mode: 'tutor' | 'practice'
  default_timing: 'timed' | 'untimed'
  default_question_type: 'all' | 'unused' | 'incorrect' | 'marked' | 'correct'
  default_category_selection: 'all' | 'ap_only' | 'cp_only' | 'custom'
}

export interface NotificationSettings {
  email_notifications: boolean
  quiz_reminders: boolean
  progress_updates: boolean
  marketing_emails: boolean
}

export interface UISettings {
  theme: 'light' | 'dark' | 'system'
  font_size: 'small' | 'medium' | 'large'
  sidebar_collapsed: boolean
}

export interface UserSettings {
  quiz_settings: QuizSettings
  notification_settings: NotificationSettings
  ui_settings: UISettings
  created_at: string
  updated_at: string
}

export type SettingsSection = 'quiz_settings' | 'notification_settings' | 'ui_settings'

class UserSettingsService {
  private baseUrl = '/api/user/settings'

  /**
   * Get all user settings
   */
  async getUserSettings(): Promise<UserSettings> {
    const response = await fetch(this.baseUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch user settings')
    }

    const result = await response.json()
    return result.data
  }

  /**
   * Update a specific section of user settings
   */
  async updateSettingsSection<T extends SettingsSection>(
    section: T,
    settings: T extends 'quiz_settings' ? Partial<QuizSettings> :
              T extends 'notification_settings' ? Partial<NotificationSettings> :
              T extends 'ui_settings' ? Partial<UISettings> : never
  ): Promise<any> {
    const response = await fetch(this.baseUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        section,
        settings
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update user settings')
    }

    const result = await response.json()
    return result.data
  }

  /**
   * Update quiz settings specifically
   */
  async updateQuizSettings(settings: Partial<QuizSettings>): Promise<QuizSettings> {
    return this.updateSettingsSection('quiz_settings', settings)
  }

  /**
   * Update notification settings specifically
   */
  async updateNotificationSettings(settings: Partial<NotificationSettings>): Promise<NotificationSettings> {
    return this.updateSettingsSection('notification_settings', settings)
  }

  /**
   * Update UI settings specifically
   */
  async updateUISettings(settings: Partial<UISettings>): Promise<UISettings> {
    return this.updateSettingsSection('ui_settings', settings)
  }

  /**
   * Get quiz settings with fallback to defaults
   */
  async getQuizSettings(): Promise<QuizSettings> {
    try {
      const userSettings = await this.getUserSettings()
      return userSettings.quiz_settings
    } catch (error) {
      console.error('Error fetching quiz settings, using defaults:', error)
      // Return default quiz settings if fetch fails
      return {
        default_question_count: 10,
        default_mode: 'tutor',
        default_timing: 'untimed',
        default_question_type: 'unused',
        default_category_selection: 'all'
      }
    }
  }

  /**
   * Get notification settings with fallback to defaults
   */
  async getNotificationSettings(): Promise<NotificationSettings> {
    try {
      const userSettings = await this.getUserSettings()
      return userSettings.notification_settings
    } catch (error) {
      console.error('Error fetching notification settings, using defaults:', error)
      // Return default notification settings if fetch fails
      return {
        email_notifications: true,
        quiz_reminders: true,
        progress_updates: true,
        marketing_emails: false
      }
    }
  }

  /**
   * Get UI settings with fallback to defaults
   */
  async getUISettings(): Promise<UISettings> {
    try {
      const userSettings = await this.getUserSettings()
      return userSettings.ui_settings
    } catch (error) {
      console.error('Error fetching UI settings, using defaults:', error)
      // Return default UI settings if fetch fails
      return {
        theme: 'system',
        font_size: 'medium',
        sidebar_collapsed: false
      }
    }
  }
}

// Export singleton instance
export const userSettingsService = new UserSettingsService()
export default userSettingsService
