# Security Fixes - Supabase Database Linter

This document describes SQL migrations to fix security warnings identified by the Supabase database linter.

**Migration Files Location**: `dev/scripts/sql/fixes/`

## Overview

These migrations address the following security issues:

1. **Function Search Path Mutable** - 6 functions without immutable `search_path`
2. **Materialized View in API** - `user_stats_computed` exposed without proper RLS
3. **Leaked Password Protection** - Requires Supabase dashboard configuration

## Migration Files

### 1. fix-function-search-path-security.sql

**Purpose**: Adds immutable `search_path` to prevent SQL injection attacks

**Affected Functions**:
- `update_audio_updated_at()` - Audio table trigger
- `update_audio_search_vector()` - Audio full-text search trigger
- `update_interactive_sequences_updated_at()` - Interactive sequences trigger
- `set_interactive_sequence_published_at()` - Publish timestamp trigger
- `update_interactive_sequences_search_vector()` - Interactive sequences full-text search
- `get_complete_database_schema()` - Schema utility function

**Security Improvement**:
```sql
-- Before (VULNERABLE to schema poisoning)
CREATE OR REPLACE FUNCTION update_audio_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- After (SECURE with immutable search_path)
CREATE OR REPLACE FUNCTION update_audio_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp  -- Prevents schema poisoning attacks
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;
```

**Risk Level**: Medium
- Exploitable if an attacker can create malicious schemas
- Functions execute with elevated privileges (triggers, SECURITY DEFINER)

### 2. fix-materialized-view-rls-policies.sql

**Purpose**: Secures `user_stats_computed` materialized view with RLS

**Changes**:
1. Creates `user_stats_secure` view wrapper with RLS
2. Revokes direct access to materialized view
3. Implements policies:
   - Users can only see their own stats
   - Service role can see all stats (admin operations)
4. Adds `refresh_user_stats()` function for admin refresh

**Security Improvement**:
```sql
-- Before (VULNERABLE - all authenticated users can see all user stats)
SELECT * FROM user_stats_computed;
-- Returns ALL users' statistics

-- After (SECURE - RLS enforced)
SELECT * FROM user_stats_secure;
-- Returns only current user's statistics
```

**Risk Level**: High
- Exposed sensitive user data (quiz performance, study habits)
- Privacy violation - users could see others' statistics

## How to Apply

### Option 1: Via Supabase Dashboard (Recommended)

1. Log in to [Supabase Dashboard](https://supabase.com/dashboard)
2. Go to your project → SQL Editor
3. Create a new query
4. Copy and paste the contents of each migration file
5. Run the migrations in order:
   - First: `fix-function-search-path-security.sql`
   - Second: `fix-materialized-view-rls-policies.sql`

### Option 2: Via Supabase CLI

```bash
# Make sure you're in the project root
cd /Users/juansanchez/pathology-bites

# Apply search_path fixes
supabase db execute < dev/scripts/sql/fixes/fix-function-search-path-security.sql

# Apply RLS policies
supabase db execute < dev/scripts/sql/fixes/fix-materialized-view-rls-policies.sql
```

### Option 3: Via psql

```bash
# Connect to your Supabase database
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# Apply migrations
\i dev/scripts/sql/fixes/fix-function-search-path-security.sql
\i dev/scripts/sql/fixes/fix-materialized-view-rls-policies.sql
```

## Verification

After applying the migrations, verify they worked:

```sql
-- Check functions have search_path set
SELECT
    p.proname AS function_name,
    CASE
        WHEN p.proconfig IS NULL THEN 'NO search_path (VULNERABLE)'
        ELSE 'search_path SET (SECURE): ' || array_to_string(p.proconfig, ', ')
    END AS security_status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN (
    'update_audio_updated_at',
    'update_audio_search_vector',
    'update_interactive_sequences_updated_at',
    'set_interactive_sequence_published_at',
    'update_interactive_sequences_search_vector',
    'get_complete_database_schema'
)
ORDER BY p.proname;

-- Check materialized view access is restricted
SELECT
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'user_stats_secure';

-- Verify direct materialized view access is revoked for authenticated users
SELECT
    grantee,
    privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
AND table_name = 'user_stats_computed'
AND grantee IN ('authenticated', 'anon');
-- Should return NO rows (access revoked)
```

## Additional Security: Leaked Password Protection

The third warning requires configuration in the Supabase dashboard (cannot be fixed via SQL):

1. Go to Supabase Dashboard → Authentication → Password Settings
2. Enable "Check against HaveIBeenPwned.org for leaked passwords"
3. Save changes

This prevents users from setting passwords that have been compromised in data breaches.

## Impact

### Before Fixes
- ⚠️ **6 functions** vulnerable to schema poisoning attacks
- ⚠️ **User statistics** accessible to all authenticated users (privacy leak)
- ⚠️ **Passwords** not checked against known breaches

### After Fixes
- ✅ All functions use immutable `search_path`
- ✅ User statistics protected by RLS
- ✅ Only users can see their own data
- ✅ Admins retain full access via service role
- ⚠️ Leaked password protection still requires dashboard config

## Testing

After applying migrations, test the changes:

```sql
-- Test 1: Verify user can only see their own stats
SET ROLE authenticated;
SET request.jwt.claims ->> 'sub' = '[TEST_USER_ID]';
SELECT * FROM user_stats_secure;
-- Should only return stats for TEST_USER_ID

-- Test 2: Verify triggers still work
UPDATE audio SET title = 'Test Update' WHERE id = '[TEST_AUDIO_ID]';
-- Should succeed and update updated_at timestamp

-- Test 3: Verify search vectors update
UPDATE audio SET description = 'New description' WHERE id = '[TEST_AUDIO_ID]';
SELECT search_vector FROM audio WHERE id = '[TEST_AUDIO_ID]';
-- Should show updated search vector
```

## Rollback (If Needed)

If you need to rollback these changes:

```sql
-- Rollback function fixes (restores original vulnerable functions)
-- Re-run the original table creation scripts:
-- - create-audio-table.sql
-- - create-interactive-sequences-table.sql

-- Rollback RLS policies
DROP VIEW IF EXISTS public.user_stats_secure CASCADE;
DROP FUNCTION IF EXISTS public.refresh_user_stats() CASCADE;
GRANT SELECT ON public.user_stats_computed TO authenticated;
GRANT SELECT ON public.user_stats_computed TO anon;
```

## Notes

- These migrations are **idempotent** - safe to run multiple times
- Functions are dropped and recreated (triggers are automatically recreated)
- No data is lost during the migration
- Minimal downtime (functions recreated instantly)
- No breaking changes to application code

## References

- [Supabase Database Linter Docs](https://supabase.com/docs/guides/database/database-linter)
- [PostgreSQL search_path Security](https://www.postgresql.org/docs/current/ddl-schemas.html#DDL-SCHEMAS-PATH)
- [Row Level Security (RLS)](https://supabase.com/docs/guides/database/postgres/row-level-security)
