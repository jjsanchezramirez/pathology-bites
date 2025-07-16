-- Migration: Create user_settings table
-- This migration creates a user_settings table to store user preferences and quiz settings
-- Date: 2024-12-15

-- Description:
-- - Creates user_settings table with JSONB columns for flexible settings storage
-- - Includes quiz settings, notification preferences, and UI preferences
-- - Uses proper RLS policies for user data security
-- - Includes default values and constraints

BEGIN;

-- Step 1: Create user_settings table
CREATE TABLE IF NOT EXISTS user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Quiz settings
  quiz_settings jsonb DEFAULT '{
    "default_question_count": 10,
    "default_mode": "tutor",
    "default_timing": "untimed",
    "default_question_type": "unused",
    "default_category_selection": "all"
  }'::jsonb,
  
  -- Notification preferences
  notification_settings jsonb DEFAULT '{
    "email_notifications": true,
    "quiz_reminders": true,
    "progress_updates": true,
    "marketing_emails": false
  }'::jsonb,
  
  -- UI preferences
  ui_settings jsonb DEFAULT '{
    "theme": "system",
    "font_size": "medium",
    "sidebar_collapsed": false,
    "welcome_message_seen": false
  }'::jsonb,
  
  -- Timestamps
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  -- Ensure one settings record per user
  CONSTRAINT user_settings_user_id_unique UNIQUE (user_id)
);

-- Step 2: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- Step 3: Create updated_at trigger
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_settings_updated_at();

-- Step 4: Enable RLS
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies
-- Users can only access their own settings
CREATE POLICY "user_settings_own_data" ON user_settings
  FOR ALL USING (user_id = auth.uid());

-- Step 6: Create helper functions
-- Function to get user settings with defaults
CREATE OR REPLACE FUNCTION get_user_settings(p_user_id uuid)
RETURNS jsonb AS $$
DECLARE
  settings_record user_settings%ROWTYPE;
  result jsonb;
BEGIN
  -- Try to get existing settings
  SELECT * INTO settings_record
  FROM user_settings
  WHERE user_id = p_user_id;
  
  -- If no settings exist, create default settings
  IF NOT FOUND THEN
    INSERT INTO user_settings (user_id)
    VALUES (p_user_id)
    RETURNING * INTO settings_record;
  END IF;
  
  -- Return combined settings
  result := jsonb_build_object(
    'quiz_settings', settings_record.quiz_settings,
    'notification_settings', settings_record.notification_settings,
    'ui_settings', settings_record.ui_settings,
    'created_at', settings_record.created_at,
    'updated_at', settings_record.updated_at
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update specific settings section
CREATE OR REPLACE FUNCTION update_user_settings_section(
  p_user_id uuid,
  p_section text,
  p_settings jsonb
)
RETURNS jsonb AS $$
DECLARE
  settings_record user_settings%ROWTYPE;
BEGIN
  -- Ensure user settings record exists
  INSERT INTO user_settings (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Update the specific section
  CASE p_section
    WHEN 'quiz_settings' THEN
      UPDATE user_settings
      SET quiz_settings = p_settings
      WHERE user_id = p_user_id
      RETURNING * INTO settings_record;
    WHEN 'notification_settings' THEN
      UPDATE user_settings
      SET notification_settings = p_settings
      WHERE user_id = p_user_id
      RETURNING * INTO settings_record;
    WHEN 'ui_settings' THEN
      UPDATE user_settings
      SET ui_settings = p_settings
      WHERE user_id = p_user_id
      RETURNING * INTO settings_record;
    ELSE
      RAISE EXCEPTION 'Invalid settings section: %', p_section;
  END CASE;
  
  -- Return the updated section
  CASE p_section
    WHEN 'quiz_settings' THEN
      RETURN settings_record.quiz_settings;
    WHEN 'notification_settings' THEN
      RETURN settings_record.notification_settings;
    WHEN 'ui_settings' THEN
      RETURN settings_record.ui_settings;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Grant permissions
GRANT SELECT, INSERT, UPDATE ON user_settings TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_settings(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_settings_section(uuid, text, jsonb) TO authenticated;

-- Step 8: Add comments for documentation
COMMENT ON TABLE user_settings IS 'User preferences and settings including quiz defaults, notifications, and UI preferences';
COMMENT ON COLUMN user_settings.quiz_settings IS 'Quiz-related preferences like default question count, mode, timing, etc.';
COMMENT ON COLUMN user_settings.notification_settings IS 'Notification preferences for emails, reminders, etc.';
COMMENT ON COLUMN user_settings.ui_settings IS 'UI preferences like theme, font size, sidebar state, etc.';
COMMENT ON FUNCTION get_user_settings(uuid) IS 'Get user settings with automatic creation of defaults if none exist';
COMMENT ON FUNCTION update_user_settings_section(uuid, text, jsonb) IS 'Update a specific section of user settings (quiz_settings, notification_settings, or ui_settings)';

COMMIT;
