-- Migration: Update user roles for 4-role system
-- This migration updates the users table role constraint to support the new 4-role system:
-- admin, creator, reviewer, user

-- Description:
-- - Updates role constraint to include 'creator' role
-- - Maintains backward compatibility with existing roles
-- - Adds proper indexing for role-based queries

BEGIN;

-- Step 1: Drop existing role constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Step 2: Add new role constraint with 4 roles
ALTER TABLE users ADD CONSTRAINT users_role_check 
CHECK (role IN ('admin', 'creator', 'reviewer', 'user'));

-- Step 3: Add index on role column for better query performance
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Step 4: Add index on role and status combination for admin queries
CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status);

-- Step 5: Update default role in handle_new_user function to ensure consistency
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert new user into users table
  INSERT INTO users (
    id,
    email,
    first_name,
    last_name,
    user_type,
    role,
    status,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'user_type', 'student'),
    'user', -- Default role remains 'user'
    'active', -- Default status
    NOW(),
    NOW()
  );
  
  RETURN NEW;
END;
$$;

-- Step 6: Verify the migration
DO $$
BEGIN
  -- Check if the constraint was updated correctly
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_role_check' 
    AND pg_get_constraintdef(oid) LIKE '%creator%'
  ) THEN
    RAISE NOTICE 'SUCCESS: users_role_check constraint updated to include creator role';
  ELSE
    RAISE EXCEPTION 'FAILED: users_role_check constraint not updated correctly';
  END IF;
  
  -- Check if indexes were created
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_role') THEN
    RAISE NOTICE 'SUCCESS: idx_users_role index created';
  ELSE
    RAISE EXCEPTION 'FAILED: idx_users_role index not created';
  END IF;
END $$;

COMMIT;

-- Note: After running this migration, you will need to update application code to:
-- 1. Update TypeScript types to include 'creator' role
-- 2. Update role permissions in useUserRole hook
-- 3. Update authentication middleware
-- 4. Update user management interfaces
-- 5. Update API endpoints that handle role validation
