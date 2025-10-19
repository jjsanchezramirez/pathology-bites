# Supabase Database Documentation

## Overview

Pathology Bites uses Supabase (PostgreSQL) as its primary database with comprehensive Row Level Security (RLS) policies, automated triggers, and materialized views for performance optimization.

**Database Statistics:**
- **Total Tables**: 43 tables (33 regular tables + 10 views)
- **Row Level Security**: 100% coverage with 58 policies
- **Database Triggers**: 18 triggers for automation
- **Secure Functions**: 19 database functions with SECURITY DEFINER
- **Materialized Views**: 1 (mv_user_category_stats)
- **Regular Views**: 9 (including v_public_stats)
- **Enums**: 8 custom types for type safety

---

## Database Architecture

### Core Schemas

**`public` schema** - Main application data
- User management and authentication
- Question bank and content
- Quiz system and analytics
- Learning modules and paths
- Media and image management

**`auth` schema** - Supabase authentication (managed by Supabase)
- User authentication and sessions
- OAuth providers
- Email verification

**`storage` schema** - File storage (managed by Supabase)
- Cloudflare R2 integration for actual file storage
- Image metadata (URL, storage_path, etc.) stored in `public.images` table
- Media files (heavy JSON documents) stored entirely in R2

---

## Tables Overview

### User Management (4 tables)

#### `users`
Core user data synchronized with `auth.users`
- **Primary Key**: `id` (UUID, matches auth.users.id)
- **Columns**: email, first_name, last_name, institution, role, user_type, status, deleted_at
- **Enums**: 
  - `role`: admin, creator, reviewer, user
  - `user_type`: student, resident, faculty, other
  - `status`: active, inactive, suspended, deleted
- **Foreign Keys**: None (referenced by many tables)
- **Triggers**: `trigger_handle_user_deletion` (BEFORE DELETE)

#### `user_settings`
User preferences and settings including quiz defaults, notifications, and UI preferences
- **Primary Key**: `id` (UUID)
- **Unique**: `user_id` (one settings record per user)
- **Columns**: quiz_settings (JSONB), notification_settings (JSONB), ui_settings (JSONB)
- **Foreign Keys**: `user_id` → users.id (CASCADE DELETE)
- **Triggers**: `trigger_user_settings_updated_at` (BEFORE UPDATE)

#### `user_favorites`
User's favorited questions
- **Primary Key**: `id` (UUID)
- **Unique**: `user_id, question_id` (one favorite per user per question)
- **Foreign Keys**: 
  - `user_id` → users.id (CASCADE DELETE)
  - `question_id` → questions.id (CASCADE DELETE)
- **Triggers**: `trigger_user_favorites_updated_at` (BEFORE UPDATE)

#### `user_achievements`
User achievements and milestones
- **Primary Key**: `id` (UUID)
- **Foreign Keys**: `user_id` → users.id (CASCADE DELETE)

---

### Question Management (11 tables)

#### `questions`
Main question data with workflow status
- **Primary Key**: `id` (UUID)
- **Columns**: title, stem, teaching_point, question_references, status, difficulty, version
- **Enums**: 
  - `status`: draft, pending_review, approved, flagged, archived, rejected, published
  - `difficulty`: easy, medium, hard
- **Foreign Keys**: 
  - `created_by` → users.id (SET NULL)
  - `updated_by` → users.id (SET NULL)
  - `reviewer_id` → users.id (SET NULL)
  - `question_set_id` → question_sets.id
- **Triggers**: 
  - `questions_updated_by_trigger` (BEFORE UPDATE)
  - `questions_delete_cleanup_trigger` (BEFORE DELETE)
  - `trigger_questions_refresh_public_stats` (AFTER INSERT/UPDATE/DELETE)

#### `question_options`
Answer options for questions (A, B, C, D, E)
- **Primary Key**: `id` (UUID)
- **Columns**: question_id, option_letter, text, is_correct, explanation
- **Foreign Keys**: `question_id` → questions.id (CASCADE DELETE)

#### `question_images`
Links questions to images
- **Primary Key**: `id` (UUID)
- **Columns**: question_id, image_id, display_order, section
- **Foreign Keys**: 
  - `question_id` → questions.id (CASCADE DELETE)
  - `image_id` → images.id (CASCADE DELETE)

#### `question_tags`
Links questions to tags
- **Primary Key**: `question_id, tag_id`
- **Foreign Keys**: 
  - `question_id` → questions.id (CASCADE DELETE)
  - `tag_id` → tags.id (CASCADE DELETE)

#### `question_sets`
Question collections (e.g., from specific books or sources)
- **Primary Key**: `id` (UUID)
- **Unique**: `name`
- **Columns**: name, description, source_type, ai_model
- **Foreign Keys**: `created_by` → users.id (SET NULL)

#### `question_versions`
Version history for published questions
- **Primary Key**: `id` (UUID)
- **Columns**: question_id, version_major, version_minor, version_patch, version_string, question_data (JSONB)
- **Foreign Keys**: 
  - `question_id` → questions.id (CASCADE DELETE)
  - `changed_by` → users.id (SET NULL)

#### `question_reviews`
Review history and feedback
- **Primary Key**: `id` (UUID)
- **Columns**: question_id, reviewer_id, action, feedback, changes_made (JSONB)
- **Foreign Keys**: 
  - `question_id` → questions.id (CASCADE DELETE)
  - `reviewer_id` → users.id (SET NULL)
- **Triggers**: `question_reviews_analytics_trigger` (AFTER INSERT/UPDATE/DELETE)

#### `question_flags`
User-reported issues with questions
- **Primary Key**: `id` (UUID)
- **Columns**: question_id, flagged_by, resolved_by, reason, status
- **Foreign Keys**: 
  - `question_id` → questions.id (CASCADE DELETE)
  - `flagged_by` → users.id (SET NULL)
  - `resolved_by` → users.id (SET NULL)
- **Triggers**: 
  - `question_flags_analytics_trigger` (AFTER INSERT/UPDATE/DELETE)
  - `trigger_update_question_flag_metadata` (AFTER INSERT/UPDATE/DELETE)

#### `question_reports`
Detailed reports about question issues
- **Primary Key**: `id` (UUID)
- **Columns**: question_id, reported_by, report_type, description, status
- **Enums**: `report_type`: incorrect_answer, unclear_explanation, broken_image, inappropriate_content, other
- **Foreign Keys**: 
  - `question_id` → questions.id (CASCADE DELETE)
  - `reported_by` → users.id (SET NULL)

#### `question_analytics`
Aggregated analytics for questions
- **Primary Key**: `id` (UUID)
- **Unique**: `question_id`
- **Columns**: total_attempts, correct_attempts, flag_count, review_count
- **Foreign Keys**: `question_id` → questions.id (CASCADE DELETE)

#### `tags`
Tags for categorizing questions
- **Primary Key**: `id` (UUID)
- **Unique**: `name`
- **Columns**: name, description

---

### Content Organization (2 tables)

#### `categories`
Hierarchical categories for questions and modules
- **Primary Key**: `id` (UUID)
- **Columns**: name, parent_id, level, color, short_form
- **Foreign Keys**: `parent_id` → categories.id (self-referencing for hierarchy)

#### `demo_questions`
Featured demo questions for public access
- **Primary Key**: `id` (UUID)
- **Unique**: `question_id`
- **Columns**: question_id, display_order, is_active
- **Foreign Keys**: `question_id` → questions.id (CASCADE DELETE)

---

### Media Management (1 table)

#### `images`
Image metadata and storage references
- **Primary Key**: `id` (UUID)
- **Columns**: url, storage_path, file_type, description, alt_text, source_ref, file_size_bytes, width, height, category
- **Enums**: `category`: microscopic, gross, figure, table, external
- **Foreign Keys**: `created_by` → users.id (SET NULL)
- **Triggers**: 
  - `images_search_vector_trigger` (BEFORE INSERT/UPDATE)
  - `trigger_images_refresh_public_stats` (AFTER INSERT/DELETE)

---

### Quiz System (4 tables)

#### `quiz_sessions`
Quiz instances and configurations
- **Primary Key**: `id` (UUID)
- **Columns**: user_id, title, config (JSONB), question_ids (UUID[]), current_question_index, status, started_at, completed_at
- **Enums**: `status`: not_started, in_progress, completed, abandoned
- **Foreign Keys**: `user_id` → users.id (CASCADE DELETE)
- **Triggers**: `update_quiz_sessions_updated_at` (BEFORE UPDATE)

#### `quiz_attempts`
Individual question attempts within quizzes
- **Primary Key**: `id` (UUID)
- **Unique**: `session_id, question_id` (one attempt per question per session)
- **Columns**: session_id, user_id, question_id, category_id, selected_answer_id, first_answer_id, is_correct, time_spent
- **Foreign Keys**: 
  - `session_id` → quiz_sessions.id (CASCADE DELETE)
  - `user_id` → users.id (CASCADE DELETE)
  - `question_id` → questions.id (CASCADE DELETE)
  - `category_id` → categories.id (SET NULL)
- **Triggers**: 
  - `quiz_attempt_correctness_trigger` (BEFORE INSERT/UPDATE)
  - `quiz_attempts_analytics_trigger` (AFTER INSERT/UPDATE/DELETE)
  - `trigger_set_quiz_attempt_denormalized_fields` (BEFORE INSERT)
  - `update_quiz_attempts_updated_at` (BEFORE UPDATE)

#### `performance_analytics`
User performance metrics by category
- **Primary Key**: `id` (UUID)
- **Unique**: `user_id, category_id`
- **Columns**: user_id, category_id, total_attempts, correct_attempts, last_attempt_at
- **Foreign Keys**: 
  - `user_id` → users.id (CASCADE DELETE)
  - `category_id` → categories.id (CASCADE DELETE)

#### `notification_states`
User notification tracking
- **Primary Key**: `id` (UUID)
- **Unique**: `user_id, source_type, source_id`
- **Columns**: user_id, source_type, source_id, read, priority
- **Foreign Keys**: `user_id` → users.id (CASCADE DELETE)

---

### Learning Modules (7 tables)

#### `learning_paths`
Learning path collections
- **Primary Key**: `id` (UUID)
- **Unique**: `slug`
- **Columns**: title, slug, description, difficulty_level, estimated_duration_minutes, category_id, status, is_featured
- **Foreign Keys**: 
  - `category_id` → categories.id (SET NULL)
  - `created_by` → users.id (SET NULL)
- **Triggers**: `learning_paths_updated_at` (BEFORE UPDATE)

#### `learning_modules`
Individual learning modules
- **Primary Key**: `id` (UUID)
- **Unique**: `slug`
- **Columns**: title, slug, description, content, learning_objectives, difficulty_level, estimated_duration_minutes, content_type, category_id, parent_module_id, status, is_featured
- **Foreign Keys**: 
  - `category_id` → categories.id (SET NULL)
  - `parent_module_id` → learning_modules.id (self-referencing)
  - `created_by` → users.id (SET NULL)
  - `reviewed_by` → users.id (SET NULL)
- **Triggers**: `learning_modules_updated_at` (BEFORE UPDATE)

#### `learning_path_modules`
Links modules to learning paths
- **Primary Key**: `id` (UUID)
- **Columns**: path_id, module_id, sequence_order, is_required
- **Foreign Keys**: 
  - `path_id` → learning_paths.id (CASCADE DELETE)
  - `module_id` → learning_modules.id (CASCADE DELETE)

#### `module_images`
Links modules to images
- **Primary Key**: `id` (UUID)
- **Unique**: `module_id, image_id, usage_type`
- **Columns**: module_id, image_id, usage_type, display_order
- **Foreign Keys**: 
  - `module_id` → learning_modules.id (CASCADE DELETE)
  - `image_id` → images.id (CASCADE DELETE)

#### `module_prerequisites`
Module prerequisite requirements
- **Primary Key**: `id` (UUID)
- **Unique**: `module_id, prerequisite_module_id`
- **Columns**: module_id, prerequisite_module_id, prerequisite_type
- **Foreign Keys**: 
  - `module_id` → learning_modules.id (CASCADE DELETE)
  - `prerequisite_module_id` → learning_modules.id (CASCADE DELETE)

#### `module_sessions`
User module session tracking
- **Primary Key**: `id` (UUID)
- **Columns**: user_id, module_id, started_at, completed_at, time_spent, status
- **Foreign Keys**: 
  - `user_id` → users.id (CASCADE DELETE)
  - `module_id` → learning_modules.id (CASCADE DELETE)

#### `module_attempts`
User module attempt tracking
- **Primary Key**: `id` (UUID)
- **Unique**: `user_id, module_id, attempt_number`
- **Columns**: user_id, module_id, attempt_number, score, time_spent, completed_at, status
- **Foreign Keys**: 
  - `user_id` → users.id (CASCADE DELETE)
  - `module_id` → learning_modules.id (CASCADE DELETE)

#### `user_learning`
User learning path enrollment and progress
- **Primary Key**: `id` (UUID)
- **Columns**: user_id, path_id, enrolled_at, completed_at, progress_percentage, status
- **Foreign Keys**: 
  - `user_id` → users.id (CASCADE DELETE)
  - `path_id` → learning_paths.id (CASCADE DELETE)
- **Triggers**: `user_learning_path_enrollments_updated_at` (BEFORE UPDATE)

---

### System Tables (2 tables)

#### `inquiries`
Contact form submissions
- **Primary Key**: `id` (UUID)
- **Columns**: request_type, first_name, last_name, organization, email, inquiry, status
- **Triggers**: `trigger_inquiries_updated_at` (BEFORE UPDATE)

#### `waitlist`
Email waitlist for launch
- **Primary Key**: `id` (UUID)
- **Unique**: `email`
- **Columns**: email, type

---

## Database Views

### Materialized Views (1)

#### `mv_user_category_stats`
Materialized view of user performance by category
- **Columns**: user_id, category_id, total_attempts, correct_attempts, incorrect_attempts, last_attempt_at, unique_questions_attempted
- **Refresh**: Manual or triggered by analytics updates

### Regular Views (9)

#### `v_public_stats`
Regular view for public statistics (always fresh, computed on-the-fly)
- **Columns**: total_questions, total_images, total_categories, last_refreshed
- **Refresh**: None needed - view is computed dynamically
- **Cache**: 24-hour TTL on public API endpoint
- **Query**: Counts questions, images, and distinct categories

### Regular Views (9)

#### `v_dashboard_stats`
Dashboard statistics with SECURITY INVOKER (respects RLS)
- **Columns**: 18 columns with user-specific stats

#### `v_user_stats`
User statistics with SECURITY INVOKER (respects RLS)
- **Columns**: 21 columns with comprehensive user metrics

#### `v_user_category_stats`
User performance by category
- **Columns**: 7 columns matching materialized view

#### `v_flagged_questions`
Questions that have been flagged
- **Columns**: 8 columns with flag details

#### `v_image_usage_stats`
Image usage statistics across questions and modules
- **Columns**: 13 columns with usage metrics

#### `v_module_analytics`
Learning module analytics
- **Columns**: 12 columns with module performance

#### `v_orphaned_images`
Images not linked to any questions or modules
- **Columns**: 8 columns for cleanup purposes

#### `v_storage_stats`
Storage usage statistics
- **Columns**: 12 columns with file size and count metrics

---

## Database Enums

### `user_role`
User role types
- **Values**: admin, creator, reviewer, user

### `user_type`
User type categories
- **Values**: student, resident, faculty, other

### `user_status`
User account status
- **Values**: active, inactive, suspended, deleted

### `question_status`
Question workflow status
- **Values**: draft, pending_review, approved, flagged, archived, rejected, published

### `difficulty_level`
Content difficulty levels
- **Values**: easy, medium, hard

### `image_category`
Image type categories
- **Values**: microscopic, gross, figure, table, external

### `report_type`
Question report types
- **Values**: incorrect_answer, unclear_explanation, broken_image, inappropriate_content, other

### `session_status`
Quiz/module session status
- **Values**: not_started, in_progress, completed, abandoned

---

## Database Triggers

### User Management Triggers
- **Removed**: All user management triggers have been removed
  - `on_auth_user_created` - Removed (user creation now in application code)
  - `on_auth_user_deleted` - Removed (user deletion now in application code)
  - `trigger_handle_user_deletion` - Removed (user deletion now in application code)

### Question Analytics Triggers (3)
- `quiz_attempts_analytics_trigger` - Updates analytics on quiz attempts
- `question_flags_analytics_trigger` - Updates analytics on flags
- `question_reviews_analytics_trigger` - Updates analytics on reviews

### Search Vector Triggers (1)
- `images_search_vector_trigger` - Updates full-text search for images

### Timestamp Triggers (6)
- `trigger_user_settings_updated_at`
- `trigger_user_favorites_updated_at`
- `update_quiz_attempts_updated_at`
- `update_quiz_sessions_updated_at`
- `trigger_inquiries_updated_at`
- `user_learning_path_enrollments_updated_at`

### Question Management Triggers (4)
- `questions_updated_by_trigger` - Auto-updates updated_by field
- `questions_delete_cleanup_trigger` - Cleanup before deletion
- `quiz_attempt_correctness_trigger` - Calculates correctness
- `trigger_set_quiz_attempt_denormalized_fields` - Sets denormalized fields

### Public Stats Triggers
- **Removed**: `trigger_questions_refresh_public_stats` and `trigger_images_refresh_public_stats`
  - These were causing "cannot refresh materialized view concurrently" errors during user deletion
  - Unnecessary since API has 24-hour cache and stats don't need real-time updates
  - Manual refresh available via `get_public_stats()` function if needed

### Other Triggers (2)
- `trigger_update_question_flag_metadata` - Updates flag metadata
- `learning_modules_updated_at` - Updates module timestamp
- `learning_paths_updated_at` - Updates path timestamp

---

## Row Level Security (RLS)

**Coverage**: 100% of tables have RLS enabled
**Total Policies**: 58 policies across all tables

### Policy Categories

1. **User Data Policies** - Users can only access their own data
2. **Public Read Policies** - Approved/published content is publicly readable
3. **Role-Based Policies** - Admin/Creator/Reviewer specific permissions
4. **Ownership Policies** - Users can modify their own created content

---

## Database Functions

### User Management Functions
- **Removed**: All user management functions have been removed
  - `handle_new_user()` - Removed (user creation now in application code)
  - `create_user_settings_for_new_user()` - Removed (user creation now in application code)
  - `handle_auth_user_deletion()` - Removed (user deletion now in application code)
  - `handle_user_deletion()` - Removed (user deletion now in application code)
- **Location**: User management logic is now in `src/shared/services/user-deletion.ts`

### Analytics Functions (5)
- `calculate_question_analytics()` - Calculates question metrics
- `trigger_update_question_analytics_unified()` - Unified analytics trigger
- `get_user_category_stats()` - User performance by category
- `get_user_question_stats_optimized()` - Optimized user stats
- `refresh_user_performance_analytics()` - Refreshes performance data

### Quiz Functions (2)
- `get_complete_quiz_dashboard()` - Complete quiz dashboard data
- `calculate_quiz_attempt_correctness()` - Calculates attempt correctness

### Other Functions (9)
- `refresh_public_stats()` - Refreshes public stats view
- `update_images_search_vector()` - Updates image search
- `update_questions_search_vector()` - Updates question search
- And countless generic timestamp updater functions

---

## Indexes

**Total Indexes**: 150+ indexes for query optimization

### Index Categories

1. **Primary Key Indexes** - Automatic on all PKs
2. **Foreign Key Indexes** - On all FK columns
3. **Unique Indexes** - On unique constraints
4. **Performance Indexes** - On frequently queried columns
5. **Composite Indexes** - On multi-column queries
6. **Full-Text Search Indexes** - On search_vector columns

### Key Performance Indexes

- `idx_questions_status_creator` - Question workflow queries
- `idx_quiz_attempts_user_question_time` - Quiz performance queries
- `idx_images_search_vector` - Full-text image search
- `idx_user_favorites_user_question` - Favorites lookup
- `idx_performance_analytics_user_category` - Analytics queries

---

## Best Practices

### For Developers

1. **Never manually create/delete users** - Use triggers
2. **Always use RLS-aware queries** - Respect row-level security
3. **Use views for complex queries** - Leverage pre-built views
4. **Respect foreign key constraints** - Understand CASCADE vs SET NULL
5. **Use enums for type safety** - Don't use magic strings

### For Database Administrators

1. **Monitor materialized view freshness** - Refresh v_public_stats regularly
2. **Check trigger status** - Ensure critical triggers are enabled
3. **Review RLS policies** - Audit security policies periodically
4. **Optimize indexes** - Use Index Advisor for recommendations
5. **Backup regularly** - Supabase handles this, but verify

---

## External Documentation

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Database Triggers Guide](https://www.postgresql.org/docs/current/triggers.html)

