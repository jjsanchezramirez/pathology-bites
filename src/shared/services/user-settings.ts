// src/shared/services/user-settings.ts
// Service for managing user settings

export interface QuizSettings {
  default_question_count: number
  default_mode: 'tutor' | 'practice'
  default_timing: 'timed' | 'untimed'
  default_question_type: 'all' | 'unused' | 'needsReview' | 'marked' | 'mastered'
  default_category_selection: 'all' | 'ap_only' | 'cp_only' | 'custom'
}

export interface NotificationSettings {
  email_notifications: boolean
  quiz_reminders: boolean
  progress_updates: boolean
}

export interface UISettings {
  theme: 'light' | 'dark' | 'system'
  font_size: 'small' | 'medium' | 'large'
  text_zoom: number
  dashboard_theme: string
  sidebar_collapsed: boolean
  welcome_message_seen: boolean
}

export interface UserSettings {
  quiz_settings: QuizSettings
  notification_settings: NotificationSettings
  ui_settings: UISettings
  created_at: string
  updated_at: string
}

export type SettingsSection = 'quiz_settings' | 'notification_settings' | 'ui_settings'

// Mapping between old and new question types for backward compatibility
const QUESTION_TYPE_MAPPING = {
  // Old -> New
  'incorrect': 'needsReview' as const,
  'correct': 'mastered' as const,
  // New -> Old (for saving to database)
  'needsReview': 'incorrect' as const,
  'mastered': 'correct' as const,
  // Unchanged
  'all': 'all' as const,
  'unused': 'unused' as const,
  'marked': 'marked' as const
}

function mapQuestionTypeFromDatabase(dbType: string): QuizSettings['default_question_type'] {
  // Map old database types to new frontend types
  switch (dbType) {
    case 'incorrect':
      return 'needsReview'
    case 'correct':
      return 'mastered'
    default:
      return dbType as QuizSettings['default_question_type']
  }
}

function mapQuestionTypeToDatabase(frontendType: QuizSettings['default_question_type']): string {
  // Map new frontend types to old database types
  switch (frontendType) {
    case 'needsReview':
      return 'incorrect'
    case 'mastered':
      return 'correct'
    default:
      return frontendType
  }
}

class UserSettingsService {
  private baseUrl = '/api/user/settings'

  /**
   * Get all user settings
   */
  async getUserSettings(): Promise<UserSettings> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        // Check if response is JSON before trying to parse it
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
          const error = await response.json()
          // If user not found (404), they may have been deleted - redirect to login
          if (response.status === 404) {
            if (typeof window !== 'undefined') {
              window.location.href = '/login'
            }
            throw new Error('User not found')
          }
          throw new Error(error.error || 'Failed to fetch user settings')
        } else {
          // Response is not JSON (likely HTML error page)
          console.error('User settings API returned non-JSON response:', response.status, response.statusText)
          if (response.status === 401 || response.status === 403) {
            if (typeof window !== 'undefined') {
              window.location.href = '/login'
            }
            throw new Error('Authentication required')
          }
          throw new Error(`Server error: ${response.status} ${response.statusText}`)
        }
      }

      // Verify response is JSON before parsing
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Invalid response format from user settings API')
      }

      const result = await response.json()
      const data = result.data

      // Map question type from database format to frontend format
      if (data?.quiz_settings?.default_question_type) {
        data.quiz_settings.default_question_type = mapQuestionTypeFromDatabase(data.quiz_settings.default_question_type)
      }

      return data
    } catch (fetchError) {
      console.error('Error in getUserSettings:', fetchError)
      throw fetchError
    }
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
    // Map question type to database format if updating quiz settings
    let mappedSettings = settings
    if (section === 'quiz_settings' && settings && typeof settings === 'object') {
      const quizSettings = settings as Partial<QuizSettings>
      if (quizSettings.default_question_type) {
        mappedSettings = {
          ...settings,
          default_question_type: mapQuestionTypeToDatabase(quizSettings.default_question_type)
        } as typeof settings
      }
    }

    const response = await fetch(this.baseUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        section,
        settings: mappedSettings
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
        progress_updates: true
      }
    }
  }

  /**
   * Mark welcome message as seen for first-time users
   */
  async markWelcomeMessageSeen(): Promise<void> {
    try {
      await this.updateUISettings({ welcome_message_seen: true })
    } catch (error) {
      console.error('Error marking welcome message as seen:', error)
      throw error
    }
  }

  /**
   * Check if user has seen the welcome message
   */
  async hasSeenWelcomeMessage(): Promise<boolean> {
    try {
      const userSettings = await this.getUserSettings()
      return userSettings.ui_settings.welcome_message_seen ?? false
    } catch (error) {
      console.error('Error checking welcome message status:', error)
      // Default to true to avoid showing welcome message on error
      return true
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
        text_zoom: 1.0,
        dashboard_theme: 'default',
        sidebar_collapsed: false,
        welcome_message_seen: true
      }
    }
  }
}

// Export singleton instance
export const userSettingsService = new UserSettingsService()
export default userSettingsService
