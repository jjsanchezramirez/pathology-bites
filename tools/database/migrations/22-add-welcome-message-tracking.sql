-- Migration: Add welcome message tracking to user settings
-- This migration adds welcome_message_seen field to track first-time users
-- Date: 2024-12-16

-- Description:
-- - Adds welcome_message_seen field to existing user_settings records
-- - Updates the get_user_settings function to include the new field
-- - Ensures all existing users have the field set to true (since they're not first-time users)

BEGIN;

-- Step 1: Update existing user_settings records to include welcome_message_seen
UPDATE user_settings 
SET ui_settings = ui_settings || '{"welcome_message_seen": true}'::jsonb
WHERE ui_settings ? 'welcome_message_seen' = false;

-- Step 2: Update the get_user_settings function to handle the new field
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
  
  -- If no settings exist, create default settings (new users get welcome_message_seen = false)
  IF NOT FOUND THEN
    INSERT INTO user_settings (user_id)
    VALUES (p_user_id)
    RETURNING * INTO settings_record;
  END IF;
  
  -- Ensure welcome_message_seen field exists (for existing records)
  IF NOT (settings_record.ui_settings ? 'welcome_message_seen') THEN
    UPDATE user_settings
    SET ui_settings = ui_settings || '{"welcome_message_seen": true}'::jsonb
    WHERE user_id = p_user_id
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

-- Step 3: Add comment for documentation
COMMENT ON FUNCTION get_user_settings(uuid) IS 'Get user settings with automatic creation of defaults if none exist, includes welcome message tracking for first-time users';

COMMIT;
