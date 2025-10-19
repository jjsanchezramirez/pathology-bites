# Database Triggers and Functions Documentation

## Overview

This document provides comprehensive documentation of all database triggers and functions in the Pathology Bites application. These triggers and functions handle critical operations automatically, ensuring data consistency and reducing application code complexity.

## ⚠️ IMPORTANT: User Management is Trigger-Based

**User creation and deletion are handled AUTOMATICALLY by database triggers.**
**Application code should NOT manually create or delete user records in `public.users`.**

---

## User Management Triggers

### User Creation Flow

When a user signs up (via email or OAuth), the following automatic process occurs:

#### 1. User Signs Up
- Application calls `supabase.auth.signUp()` or OAuth provider
- User is created in `auth.users` (Supabase's authentication schema)

#### 2. Trigger: `on_auth_user_created`
```sql
CREATE TRIGGER on_auth_user_created 
AFTER INSERT ON auth.users 
FOR EACH ROW 
EXECUTE FUNCTION handle_new_user()
```

**Details:**
- **Table**: `auth.users`
- **Timing**: AFTER INSERT
- **Function**: `handle_new_user()`
- **Purpose**: Automatically create application user record when auth user is created

#### 3. Function: `handle_new_user()`
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
```

**Actions:**
1. Creates record in `public.users`:
   - `id` = `NEW.id` (matches auth.users.id)
   - `email` = `NEW.email`
   - `first_name` = `NEW.user_metadata->>'first_name'`
   - `last_name` = `NEW.user_metadata->>'last_name'`
   - `user_type` = `COALESCE(NEW.user_metadata->>'user_type', 'other')`
   - `role` = `'user'` (default role)
   - `status` = `'active'`

2. Calls `create_user_settings_for_new_user(NEW.id)` to create default settings

**Security**: SECURITY DEFINER (bypasses RLS policies to ensure user creation succeeds)

**Migration**: `supabase/migrations/20250119000002_fix_user_creation_trigger.sql`

#### 4. Function: `create_user_settings_for_new_user(p_user_id UUID)`
```sql
CREATE OR REPLACE FUNCTION public.create_user_settings_for_new_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
```

**Actions:**
- Creates record in `user_settings` with default values:
  - `quiz_settings`: default_question_count=10, default_mode='tutor', etc.
  - `notification_settings`: email_notifications=true, quiz_reminders=true, etc.
  - `ui_settings`: theme='system', font_size='medium', text_zoom=1.0, etc.

**Defaults**: Match `src/shared/constants/user-settings-defaults.ts`

**Security**: SECURITY DEFINER (bypasses RLS policies)

**Migration**: `supabase/migrations/20250119000000_update_user_settings_defaults.sql`

#### Application Code Impact

**Auth Callback Routes** (`/api/public/auth/callback`, `/api/public/auth/confirm`):
- ✅ Do NOT manually create users
- ✅ Do NOT manually call `create_user_settings_for_new_user()`
- ✅ Triggers handle everything automatically
- ✅ Routes only handle redirects and admin-only mode checks

---

### User Deletion Flow

When a user is deleted (via admin or self-deletion), the following automatic cascade occurs:

#### 1. User Deletion Initiated
- Application calls `adminClient.auth.admin.deleteUser(userId)`
- User is deleted from `auth.users`

#### 2. Trigger: `on_auth_user_deleted`
```sql
CREATE TRIGGER on_auth_user_deleted 
AFTER DELETE ON auth.users 
FOR EACH ROW 
EXECUTE FUNCTION handle_auth_user_deletion()
```

**Details:**
- **Table**: `auth.users`
- **Timing**: AFTER DELETE
- **Function**: `handle_auth_user_deletion()`
- **Purpose**: Handle role-based soft/hard delete when auth user is removed

#### 3. Function: `handle_auth_user_deletion()`
```sql
CREATE OR REPLACE FUNCTION public.handle_auth_user_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
```

**Actions:**

**For admin/creator/reviewer users (SOFT DELETE):**
- Updates `public.users` record:
  - Sets `deleted_at = NOW()`
  - Sets `status = 'deleted'`
  - Sets `updated_at = NOW()`
- **Preserves** the user record for attribution (questions, reviews, etc.)
- User data remains in database but marked as deleted

**For student/user users (HARD DELETE):**
- Explicitly deletes from all user-related tables (bypasses RLS):
  - `user_settings`
  - `user_favorites`
  - `user_achievements`
  - `performance_analytics`
  - `notification_states`
  - `quiz_sessions`
  - `quiz_attempts`
  - `module_sessions`
  - `module_attempts`
  - `user_learning`
- Then deletes from `public.users`
- **Removes** all user data completely

**Security**: SECURITY DEFINER (bypasses RLS policies to ensure deletion succeeds)

#### 4. Trigger: `trigger_handle_user_deletion` (for hard deletes only)
```sql
CREATE TRIGGER trigger_handle_user_deletion 
BEFORE DELETE ON public.users 
FOR EACH ROW 
EXECUTE FUNCTION handle_user_deletion()
```

**Details:**
- **Table**: `public.users`
- **Timing**: BEFORE DELETE
- **Function**: `handle_user_deletion()`
- **Purpose**: Explicitly delete from all user-related tables before user record is deleted

#### 5. Function: `handle_user_deletion()`
```sql
CREATE OR REPLACE FUNCTION public.handle_user_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
```

**Actions:**
- Explicitly deletes from all user-related tables:
  - `user_settings`
  - `user_favorites`
  - `user_achievements`
  - `performance_analytics`
  - `notification_states`
  - `quiz_sessions`
  - `quiz_attempts`
  - `module_sessions`
  - `module_attempts`
  - `user_learning`

**Purpose**: Ensures RLS policies don't block cascade deletes

**Security**: SECURITY DEFINER (bypasses RLS policies)

**Note**: Only deletes from tables with `user_id` foreign key (CASCADE delete). Tables with `created_by`, `reviewed_by`, `flagged_by`, etc. use SET NULL on the foreign key constraint.

#### Application Code Impact

**User Deletion Routes** (`/api/user/account/delete`, `/api/admin/users DELETE`):
- ✅ Only call `adminClient.auth.admin.deleteUser(userId)`
- ✅ Do NOT manually delete from `public.users`
- ✅ Do NOT manually delete from user-related tables
- ✅ Triggers handle all cascade logic automatically
- ✅ Routes only handle audit logging and response

---

## Other Database Triggers

### Question Analytics Triggers

**`quiz_attempts_analytics_trigger`**
- **Table**: `quiz_attempts`
- **Timing**: AFTER INSERT OR UPDATE OR DELETE
- **Function**: `trigger_update_question_analytics_unified()`
- **Purpose**: Updates question analytics when quiz attempts are created/modified

**`question_flags_analytics_trigger`**
- **Table**: `question_flags`
- **Timing**: AFTER INSERT OR UPDATE OR DELETE
- **Function**: `trigger_update_question_analytics_unified()`
- **Purpose**: Updates question analytics when questions are flagged

**`question_reviews_analytics_trigger`**
- **Table**: `question_reviews`
- **Timing**: AFTER INSERT OR UPDATE OR DELETE
- **Function**: `trigger_update_question_analytics_unified()`
- **Purpose**: Updates question analytics after reviews

### Search Vector Triggers

**`images_search_vector_trigger`**
- **Table**: `images`
- **Timing**: BEFORE INSERT OR UPDATE
- **Function**: `update_images_search_vector()`
- **Purpose**: Updates full-text search vector for images

**`questions_search_vector_trigger`**
- **Table**: `questions`
- **Timing**: BEFORE INSERT OR UPDATE
- **Function**: `update_questions_search_vector()`
- **Purpose**: Updates full-text search vector for questions

### Timestamp Triggers

**`update_updated_at_column`**
- **Tables**: `quiz_sessions`, `quiz_attempts`, `user_favorites`, `user_settings`, `storage.objects`
- **Timing**: BEFORE UPDATE
- **Function**: `update_updated_at_column()`
- **Purpose**: Auto-updates `updated_at` timestamp

**`update_questions_updated_by`**
- **Table**: `questions`
- **Timing**: BEFORE UPDATE
- **Function**: `update_questions_updated_by()`
- **Purpose**: Auto-updates `updated_by` field with current user

### Public Stats Triggers

**`trigger_questions_refresh_public_stats`**
- **Table**: `questions`
- **Timing**: AFTER INSERT OR UPDATE OR DELETE
- **Function**: `trigger_refresh_public_stats()`
- **Purpose**: Refreshes public stats materialized view

**`trigger_images_refresh_public_stats`**
- **Table**: `images`
- **Timing**: AFTER INSERT OR DELETE
- **Function**: `trigger_refresh_public_stats()`
- **Purpose**: Refreshes public stats materialized view

### Question Management Triggers

**`questions_delete_cleanup_trigger`**
- **Table**: `questions`
- **Timing**: BEFORE DELETE
- **Function**: `handle_deleted_question()`
- **Purpose**: Cleanup related data before question deletion

**`quiz_attempt_correctness_trigger`**
- **Table**: `quiz_attempts`
- **Timing**: BEFORE INSERT OR UPDATE
- **Function**: `calculate_quiz_attempt_correctness()`
- **Purpose**: Calculates if answer is correct before saving

**`trigger_set_quiz_attempt_denormalized_fields`**
- **Table**: `quiz_attempts`
- **Timing**: BEFORE INSERT
- **Function**: `set_quiz_attempt_denormalized_fields()`
- **Purpose**: Sets denormalized fields for performance

---

## Best Practices

### For Developers

1. **Never manually create users in `public.users`**
   - Let the `on_auth_user_created` trigger handle it
   - Only create users in `auth.users` via Supabase Auth

2. **Never manually delete users from `public.users`**
   - Let the `on_auth_user_deleted` trigger handle it
   - Only delete users from `auth.users` via `adminClient.auth.admin.deleteUser()`

3. **Trust the triggers**
   - Triggers use SECURITY DEFINER to bypass RLS
   - They handle edge cases and ensure data consistency
   - Application code should be simpler and more maintainable

4. **Document trigger dependencies**
   - If adding new user-related tables, update `handle_user_deletion()`
   - Keep migration files for trigger changes

### For Database Administrators

1. **Check trigger status**
   ```sql
   SELECT tgname, tgenabled FROM pg_trigger 
   WHERE tgrelid = 'auth.users'::regclass AND tgisinternal = false;
   ```

2. **View trigger definitions**
   ```sql
   SELECT pg_get_triggerdef(oid) FROM pg_trigger 
   WHERE tgname = 'on_auth_user_created';
   ```

3. **View function definitions**
   ```sql
   SELECT pg_get_functiondef(oid) FROM pg_proc 
   WHERE proname = 'handle_new_user';
   ```

---

## Troubleshooting

### User not created in public.users

**Symptoms**: User exists in `auth.users` but not in `public.users`

**Causes**:
- Trigger `on_auth_user_created` is disabled
- Function `handle_new_user()` has errors
- RLS policies blocking insertion (shouldn't happen with SECURITY DEFINER)

**Solution**:
```sql
-- Check if trigger is enabled
SELECT tgname, tgenabled FROM pg_trigger 
WHERE tgrelid = 'auth.users'::regclass AND tgname = 'on_auth_user_created';

-- Re-enable trigger if disabled
ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;
```

### User settings not created

**Symptoms**: User exists in `public.users` but not in `user_settings`

**Causes**:
- Function `create_user_settings_for_new_user()` has errors
- Foreign key constraint violation (user doesn't exist in `public.users`)

**Solution**:
```sql
-- Manually create settings for existing user
SELECT create_user_settings_for_new_user('user-id-here');
```

### User deletion fails

**Symptoms**: Error when trying to delete user

**Causes**:
- Trigger `on_auth_user_deleted` is disabled
- Function `handle_auth_user_deletion()` has errors
- Foreign key constraints blocking deletion

**Solution**:
```sql
-- Check if trigger is enabled
SELECT tgname, tgenabled FROM pg_trigger 
WHERE tgrelid = 'auth.users'::regclass AND tgname = 'on_auth_user_deleted';

-- Re-enable trigger if disabled
ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_deleted;
```

---

## Migration Files

- `supabase/migrations/20250119000000_update_user_settings_defaults.sql` - User settings defaults
- `supabase/migrations/20250119000002_fix_user_creation_trigger.sql` - User creation trigger
- `supabase/migrations/20250119000003_fix_user_deletion_cascade.sql` - User deletion cascade

