# Database Cleanup Migration — April 11-12, 2026

## Overview

A comprehensive security hardening and cleanup of the Supabase database. This migration addressed security advisors findings, removed unused objects, standardized naming conventions, and improved the view architecture.

## Security Fixes

### RLS Policy Hardening

**Dropped overly permissive policies:**
- `"Prototype anon access"` on `board_prep_config`, `board_prep_progress`, `board_prep_resources`, `board_prep_schedule` — these used `USING (true)` for the `public` role, granting unrestricted anonymous read/write access.

**Rewritten policies (authenticated-only + cached `auth.uid()`):**
- `board_prep_config`, `board_prep_progress`, `board_prep_resources`, `board_prep_schedule` — changed from `roles {public}` to `TO authenticated`, replaced `auth.uid()` with `(select auth.uid())` to prevent per-row re-evaluation.
- `learning_subjects`, `lessons` — admin + published policies consolidated into single SELECT policies with cached `auth.uid()`.
- `user_lesson_progress` — INSERT/SELECT/UPDATE policies rewritten to target `authenticated` with cached `auth.uid()`.
- `svg_assets` — insert/update/delete policies rewritten with cached `auth.uid()`.

**Consolidated duplicate permissive policies:**
- `"Allow anon to read question options"` on `question_options` — dropped (redundant with `"Question options read access"`).
- `"Allow anon to read categories"` on `categories` — dropped (redundant with `"categories_select_all"`).
- `"Allow anon to read images"` on `images` — dropped.
- `"Allow anon to read question_images"` on `question_images` — dropped.
- `"Allow anon to read published questions"` on `questions` — dropped.

### View Security

**Revoked anonymous access from stats views:**
- `v_dashboard_stats` — was fully accessible to `anon`, exposing internal stats (total users, draft question counts, unread inquiries).
- `v_image_usage_stats` — was fully accessible to `anon`, exposing all image metadata and question IDs.

**All remaining views now have:**
- `security_invoker = true`
- Admin-only filtering via `WHERE EXISTS (SELECT 1 FROM users WHERE id = (select auth.uid()) AND role = 'admin')`
- `REVOKE ALL FROM public, anon`
- `GRANT SELECT TO authenticated`

### Function Security

- Pinned `search_path` on `distinct_quiz_creators_last_30_days()` and `svg_assets_search_vector_update()` to `public, pg_temp` to prevent mutable search_path exploits.

## Architecture Changes

### Materialized View Architecture

Introduced a two-layer view pattern with an `internal` schema:

| Layer | Schema | Naming | Purpose |
|-------|--------|--------|---------|
| Materialized views (data cache) | `internal` | `mv_*` | Precomputed aggregations, not API-accessible |
| Secure wrapper views | `public` | `v_*` | Admin-filtered, `security_invoker=true`, API-accessible |

**Created:**
- `internal.mv_dashboard_stats` — materialized from 17 count queries across questions, users, images, quiz_sessions, inquiries, reports
- `internal.mv_image_usage_stats` — materialized image usage counts and orphan detection
- `internal.mv_storage_stats` — renamed from `public.v_storage_stats`

**Secure wrappers (code queries these):**
- `public.v_dashboard_stats` → reads from `internal.mv_dashboard_stats`
- `public.v_image_usage_stats` → reads from `internal.mv_image_usage_stats`
- `public.v_storage_stats` → reads from `internal.mv_storage_stats` (renamed from `v_storage_stats_secure`)

**Cron job:** `refresh-materialized-views` runs every 30 minutes to refresh all three materialized views via `pg_cron`.

### Performance

- Added index: `idx_question_images_image_id` on `question_images(image_id)` — `question_images` was the biggest sequential scan offender (29.8M rows read via seq scan from view subqueries).
- Added indexes: `idx_learning_subjects_created_by`, `idx_lessons_created_by`, `idx_system_updates_created_by` — unindexed foreign keys.
- Ran `ANALYZE` on hotspot tables: `question_images`, `questions`, `tags`, `images`, `quiz_attempts`, `users`.

## Dropped Objects

### Dropped Table

| Table | Reason |
|-------|--------|
| `performance_analytics` | 0 rows, never written to or read from in application code. Only referenced in user deletion cleanup. Associated function `refresh_user_performance_analytics()` also dropped. |

### Dropped Views (8)

| View | Type | Reason |
|------|------|--------|
| `v_audio_stats_secure` | view | Never queried in application code |
| `v_audio_stats` | materialized view | Orphaned after `v_audio_stats_secure` was dropped |
| `user_stats_secure` | view | Never queried |
| `user_stats_computed` | materialized view | Never queried |
| `mv_user_category_stats` | materialized view | Never queried |
| `v_user_category_stats` | view | Never queried |
| `v_user_stats` | view | Never queried |
| `v_flagged_questions` | view | Only in FK type references, never queried |
| `v_public_stats` | view | WIP feature never completed |

### Dropped Functions (24)

**Unused RPC functions (never called from application code):**

| Function | Reason |
|----------|--------|
| `analyze_user_login_activity()` | Never called |
| `backfill_orphaned_users()` | One-time migration utility, already ran |
| `calculate_question_analytics()` (2 overloads) | Never called |
| `distinct_quiz_creators_last_30_days()` | Never called |
| `get_all_user_scores()` | Never called |
| `get_complete_database_schema()` | Admin utility, never called from app |
| `get_complete_quiz_dashboard()` (2 overloads) | Never called |
| `get_database_size_analysis()` | Never called |
| `get_public_stats()` | Never called from app; was being hit 2,788 times by anonymous external callers via PostgREST |
| `get_user_data_analysis()` | Never called |
| `get_user_question_stats_optimized()` (2 overloads) | Never called |
| `get_user_stats()` | Superseded by `get_user_statistics()` |
| `recalculate_all_question_analytics()` | Never called |
| `refresh_audio_stats()` | Never called |
| `refresh_materialized_views()` | Never called (replaced by pg_cron job) |
| `refresh_public_stats()` | Associated with dropped public stats feature |
| `refresh_storage_stats()` | Never called |
| `refresh_user_category_stats()` | Never called |
| `refresh_user_stats()` | Never called |
| `refresh_user_performance_analytics()` | Associated with dropped `performance_analytics` table |
| `update_question_version()` | Superseded by `create_question_version_simplified()` |

**Orphaned trigger functions (no active trigger attached):**

| Function | Reason |
|----------|--------|
| `trigger_refresh_public_stats()` | No trigger attached; public stats feature dropped |
| `update_questions_search_vector()` | No trigger attached to `questions` table |
| `validate_answer_correctness()` | No trigger attached |

### Kept (initially flagged but found to be in use)

| Function | Reason kept |
|----------|------------|
| `is_current_user_admin()` | Used by RLS policies on `users` table |
| `rls_auto_enable()` | Active event trigger `ensure_rls` on `ddl_command_end` |
| `calculate_quiz_attempt_correctness()` | Active trigger on `quiz_attempts` |
| `set_quiz_attempt_denormalized_fields()` | Active trigger on `quiz_attempts` |
| `svg_assets_search_vector_update()` | Active trigger on `svg_assets` |
| `trigger_update_question_analytics_unified()` | Active triggers on `quiz_attempts`, `question_reviews`, `question_flags` |
| `update_images_search_vector()` | Active trigger on `images` |
| `update_questions_updated_by()` | Active trigger on `questions` |

### Dropped Triggers (3)

Found during trigger audit — these were silently erroring on every write because they called functions we had already dropped:

| Trigger | Table | Called function | Reason dropped |
|---------|-------|----------------|----------------|
| `trigger_audio_refresh_stats` | `audio` | `trigger_refresh_audio_stats()` → `refresh_audio_stats()` | `refresh_audio_stats()` was dropped; `v_audio_stats` mat view no longer exists |
| `trigger_images_refresh_stats` | `images` | `trigger_refresh_storage_stats()` → `refresh_storage_stats()` | `refresh_storage_stats()` was dropped; mat view moved to `internal.mv_storage_stats`, refreshed by cron |
| `trigger_question_images_refresh_stats` | `question_images` | `trigger_refresh_storage_stats()` → `refresh_storage_stats()` | Same as above |

Associated functions `trigger_refresh_audio_stats()` and `trigger_refresh_storage_stats()` also dropped.

Materialized view refreshes are now handled exclusively by the `refresh-materialized-views` pg_cron job (every 30 minutes).

## Final Trigger Inventory (26 active triggers)

| Table | Trigger | Function | Timing | Events |
|-------|---------|----------|--------|--------|
| `audio` | `set_audio_updated_at` | `update_audio_updated_at` | BEFORE | UPDATE |
| `audio` | `update_audio_search_vector_trigger` | `update_audio_search_vector` | BEFORE | INSERT/UPDATE |
| `images` | `images_search_vector_trigger` | `update_images_search_vector` | BEFORE | INSERT/UPDATE |
| `inquiries` | `trigger_inquiries_updated_at` | `update_inquiries_updated_at` | BEFORE | UPDATE |
| `interactive_sequences` | `interactive_sequence_set_published_at` | `set_interactive_sequence_published_at` | BEFORE | INSERT/UPDATE |
| `interactive_sequences` | `set_interactive_sequences_updated_at` | `update_interactive_sequences_updated_at` | BEFORE | UPDATE |
| `interactive_sequences` | `update_interactive_sequences_search_vector_trigger` | `update_interactive_sequences_search_vector` | BEFORE | INSERT/UPDATE |
| `learning_subjects` | `update_learning_subjects_updated_at` | `update_updated_at_column` | BEFORE | UPDATE |
| `lessons` | `update_lessons_updated_at` | `update_updated_at_column` | BEFORE | UPDATE |
| `question_flags` | `question_flags_analytics_trigger` | `trigger_update_question_analytics_unified` | AFTER | INSERT/UPDATE/DELETE |
| `question_flags` | `trigger_update_question_flag_metadata` | `update_question_flag_metadata` | AFTER | INSERT/UPDATE/DELETE |
| `question_images` | `trigger_question_images_refresh_stats` | *(dropped)* | | |
| `question_reviews` | `question_reviews_analytics_trigger` | `trigger_update_question_analytics_unified` | AFTER | INSERT/UPDATE/DELETE |
| `questions` | `create_initial_version_on_approval` | `create_initial_question_version` | AFTER | UPDATE |
| `questions` | `questions_delete_cleanup_trigger` | `handle_deleted_question` | BEFORE | DELETE |
| `questions` | `questions_updated_by_trigger` | `update_questions_updated_by` | BEFORE | UPDATE |
| `questions` | `trg_update_total_questions_count` | `update_total_questions_count` | AFTER | INSERT/DELETE |
| `quiz_attempts` | `quiz_attempt_correctness_trigger` | `calculate_quiz_attempt_correctness` | BEFORE | INSERT/UPDATE |
| `quiz_attempts` | `quiz_attempts_analytics_trigger` | `trigger_update_question_analytics_unified` | AFTER | INSERT/UPDATE/DELETE |
| `quiz_attempts` | `trigger_set_quiz_attempt_denormalized_fields` | `set_quiz_attempt_denormalized_fields` | BEFORE | INSERT |
| `quiz_attempts` | `update_quiz_attempts_updated_at` | `update_updated_at_column` | BEFORE | UPDATE |
| `quiz_sessions` | `update_quiz_sessions_updated_at` | `update_updated_at_column` | BEFORE | UPDATE |
| `svg_assets` | `svg_assets_search_vector_trigger` | `svg_assets_search_vector_update` | BEFORE | INSERT/UPDATE |
| `user_favorites` | `trigger_user_favorites_updated_at` | `update_updated_at_column` | BEFORE | UPDATE |
| `user_settings` | `trigger_user_settings_updated_at` | `update_updated_at_column` | BEFORE | UPDATE |
| `users` | `on_auth_user_created` | `handle_new_user` | AFTER | INSERT |
| `users` | `on_auth_user_deleted` | `handle_auth_user_deleted` | AFTER | DELETE |

## Final Function Inventory (36 active functions)

**RPC functions (16):** `count_active_users_since`, `create_question_version_simplified`, `decrement_r2_metrics`, `get_audio_aggregate_stats`, `get_categories_with_parents`, `get_most_recent_attempts`, `get_question_success_rates`, `get_user_activity_heatmap`, `get_user_category_stats`, `get_user_percentile`, `get_user_performance_data`, `get_user_statistics`, `increment_r2_metrics`, `refresh_user_stats_incremental`, `select_quiz_questions`, `update_question_analytics_batch`

**RLS utility (1):** `is_current_user_admin`

**Trigger functions (18):** `calculate_quiz_attempt_correctness`, `create_initial_question_version`, `handle_auth_user_deleted`, `handle_deleted_question`, `handle_new_user`, `set_interactive_sequence_published_at`, `set_quiz_attempt_denormalized_fields`, `svg_assets_search_vector_update`, `trigger_update_question_analytics_unified`, `update_audio_search_vector`, `update_audio_updated_at`, `update_images_search_vector`, `update_inquiries_updated_at`, `update_interactive_sequences_search_vector`, `update_interactive_sequences_updated_at`, `update_question_flag_metadata`, `update_questions_updated_by`, `update_total_questions_count`, `update_updated_at_column`

**Event trigger (1):** `rls_auto_enable` (auto-enables RLS on new tables)

**Internal utility (1):** `get_question_snapshot_data` (called by `create_initial_question_version` trigger)

## Remaining Advisory Items

- **`auth_leaked_password_protection`** — Dashboard toggle under Authentication > Providers > Email > "Prevent use of leaked passwords". Not fixable via SQL.
- **Unused indexes (INFO-level)** — 44 indexes flagged as unused. Left in place; tables are small enough that the overhead is negligible, and many will become useful at scale.
