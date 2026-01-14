-- Fix Permissive RLS Policies (Supabase Linter Warnings)
-- This migration removes redundant RLS policies that use `WITH CHECK (true)` or `USING (true)`
-- These policies are flagged by Supabase's database linter as security warnings
--
-- RATIONALE:
-- 1. inquiries table: Contact form submissions use service role key, bypassing RLS entirely
-- 2. question_analytics table: All writes go through SECURITY DEFINER function (update_question_analytics_batch)
-- 3. waitlist table: Waitlist subscriptions use service role fallback, bypassing RLS
--
-- Since these tables are accessed via service role or SECURITY DEFINER functions,
-- the permissive RLS policies serve no purpose and create security warnings.
-- Removing them tightens security without breaking functionality.
--
-- Date: 2026-01-09
-- Related warnings:
--   - rls_policy_always_true: inquiries_insert_access
--   - rls_policy_always_true: question_analytics_system_insert
--   - rls_policy_always_true: question_analytics_system_update
--   - rls_policy_always_true: Allow anyone to insert into waitlist

-- ============================================================================
-- TABLE: inquiries
-- ============================================================================
-- The inquiries table is used for contact form submissions.
-- The contact form API (src/app/api/public/contact/contact.ts) uses the service role key
-- to insert records, which bypasses RLS entirely.
-- Therefore, this permissive INSERT policy is redundant and can be safely removed.

DROP POLICY IF EXISTS "inquiries_insert_access" ON public.inquiries;

-- ============================================================================
-- TABLE: question_analytics
-- ============================================================================
-- The question_analytics table stores question performance metrics.
-- All inserts and updates are performed via the update_question_analytics_batch()
-- SECURITY DEFINER function (see src/features/quiz/services/analytics-service.ts).
-- SECURITY DEFINER functions run with the privileges of the function owner,
-- bypassing RLS policies. Therefore, these permissive policies are redundant.

DROP POLICY IF EXISTS "question_analytics_system_insert" ON public.question_analytics;
DROP POLICY IF EXISTS "question_analytics_system_update" ON public.question_analytics;

-- Add a proper SELECT policy for admins to view analytics data
-- This replaces the overly permissive INSERT/UPDATE policies with a secure SELECT-only policy
CREATE POLICY "question_analytics_admin_select"
ON public.question_analytics
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
    AND users.role = 'admin'::user_role
  )
);

-- ============================================================================
-- TABLE: waitlist
-- ============================================================================
-- The waitlist table is used for email subscriptions.
-- The subscribe API (src/app/api/public/subscribe/route.ts) first tries with anon key,
-- then falls back to service role key if RLS blocks the insert.
-- Since the service role fallback bypasses RLS anyway, this permissive policy is redundant.
-- Removing it means the anon key attempt will fail (as expected), and the service role
-- fallback will handle the insert securely.

DROP POLICY IF EXISTS "Allow anyone to insert into waitlist" ON public.waitlist;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After running this migration, verify that:
-- 1. Contact form submissions still work (uses service role)
-- 2. Quiz analytics still update after completing quizzes (uses SECURITY DEFINER function)
-- 3. Waitlist subscriptions still work (uses service role fallback)
--
-- You can verify the policies were dropped by running:
-- SELECT schemaname, tablename, policyname FROM pg_policies 
-- WHERE tablename IN ('inquiries', 'question_analytics', 'waitlist');

-- ============================================================================
-- NOTE: Auth Leaked Password Protection
-- ============================================================================
-- The fifth warning (auth_leaked_password_protection) is a Supabase Auth configuration
-- setting, not an RLS policy issue. To fix it:
-- 1. Go to Supabase Dashboard
-- 2. Navigate to Authentication → Settings → Password Security
-- 3. Enable "Leaked Password Protection"
-- This feature checks passwords against HaveIBeenPwned.org to prevent use of compromised passwords.
