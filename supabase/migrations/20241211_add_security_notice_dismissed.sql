-- Migration: Add security_notice_dismissed to ui_settings
-- Date: 2024-12-11
-- Description: Adds security_notice_dismissed field to existing user_settings records

-- Update all existing user_settings to include security_notice_dismissed in ui_settings
-- This ensures existing users get the new field with default value false
UPDATE user_settings
SET ui_settings = jsonb_set(
  COALESCE(ui_settings, '{}'::jsonb),
  '{security_notice_dismissed}',
  'false'::jsonb,
  true
)
WHERE ui_settings IS NULL 
   OR NOT (ui_settings ? 'security_notice_dismissed');

-- Add comment
COMMENT ON COLUMN user_settings.ui_settings IS 
'UI preferences including text_zoom, dashboard themes, welcome_message_seen, and security_notice_dismissed';

