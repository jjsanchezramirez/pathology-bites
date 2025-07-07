# Complete Database Structure Documentation

## Tables

### Core Tables

#### users
- id (uuid, PK)
- email (text)
- first_name (text)
- last_name (text)
- user_type (text)
- role (text)
- status (text)
- created_at (timestamptz)
- updated_at (timestamptz)

#### questions
- id (uuid, PK)
- title (text, NOT NULL)
- stem (text, NOT NULL)
- difficulty (varchar, NOT NULL) - CHECK: easy/medium/hard
- teaching_point (text, NOT NULL)
- question_references (text)
- status (varchar, NOT NULL) - CHECK: draft/under_review/published/rejected/pending_major_edits/pending_minor_edits/archived
- created_by (uuid, FK → users.id)
- version (integer, NOT NULL)
- created_at (timestamptz)
- updated_at (timestamptz)
- question_set_id (uuid, FK → sets.id)
- search_vector (tsvector)
- category_id (uuid, FK → categories.id)
- version_major (integer)
- version_minor (integer)
- version_patch (integer)
- version_string (text)
- change_summary (text)
- update_type (text) - CHECK: patch/minor/major
- original_creator_id (uuid, FK → users.id)
- current_editor_id (uuid, FK → users.id)

#### question_options
- id (uuid, PK)
- question_id (uuid, FK → questions.id)
- text (text, NOT NULL)
- is_correct (boolean, NOT NULL)
- explanation (text, nullable)
- order_index (integer, NOT NULL)
- created_at (timestamptz)
- updated_at (timestamptz)

#### question_versions
- id (uuid, PK)
- question_id (uuid, FK → questions.id)
- version_major (integer, NOT NULL)
- version_minor (integer, NOT NULL)
- version_patch (integer, NOT NULL)
- version_string (text, NOT NULL)
- question_data (jsonb, NOT NULL)
- update_type (text, NOT NULL)
- change_summary (text)
- changed_by (uuid, NOT NULL)
- created_at (timestamptz)

#### categories
- Standard category table

#### sets
- Standard sets table

#### tags
- Standard tags table

#### question_tags
- question_id (uuid, FK → questions.id)
- tag_id (uuid, FK → tags.id)

### Supporting Tables

#### images
- Standard images table with search_vector

#### question_images
- question_id (uuid, FK → questions.id)
- image_id (uuid, FK → images.id)
- question_section (text)
- order_index (integer)

#### question_flags
- Standard flagging table

#### question_reviews
- Standard reviews table

#### question_analytics
- Analytics aggregation table

#### audit_logs
- System audit logging

#### notification_states
- User notification preferences

#### performance_analytics
- User performance tracking

#### quiz_attempts
- Quiz attempt records

#### quiz_sessions
- Quiz session management

#### question_reports
- Question reporting system

#### demo_questions
- Demo/sample questions

#### inquiries
- User inquiries/contact

#### waitlist
- User waitlist management

### Views

#### v_dashboard_stats
- Dashboard statistics view

#### v_flagged_questions
- Questions with pending flags

#### v_image_usage_by_category
- Image usage statistics by category

#### v_image_usage_stats
- Overall image usage statistics

#### v_orphaned_images
- Images not linked to questions

#### v_storage_stats
- Storage usage statistics

#### v_user_stats
- User statistics aggregation

## Functions

### Question Management
- `create_question_version()` - Trigger function for versioning
- `create_question_version(uuid, text, text)` - Manual version creation
- `get_question_snapshot_data(uuid)` - Get complete question data
- `update_question_version(uuid, text, text, jsonb)` - Update version with data
- `update_questions_search_vector()` - Search vector maintenance

### Analytics
- `calculate_question_analytics(uuid)` - Calculate question metrics
- `recalculate_all_question_analytics()` - Recalculate all metrics
- `trigger_update_question_analytics()` - Trigger for analytics updates
- `trigger_update_question_analytics_flags_reviews()` - Trigger for flags/reviews

### User Management
- `handle_new_user()` - Process new user registration
- `handle_deleted_user()` - Process user deletion
- `is_admin()` - Check admin status (multiple variants)
- `is_current_user_admin()` - Check current user admin status

### Demo/Sample Data
- `select_demo_questions(uuid[])` - Select demo questions
- `select_demo_questions(integer)` - Get demo questions with limit

### Utilities
- `update_updated_at_column()` - Generic timestamp updater
- `update_images_search_vector()` - Image search vector maintenance
- `create_audit_logs_table()` - Deprecated audit function

## Current Triggers Status

### REMOVED (Due to Issues)
- ❌ `create_question_version_trigger` on questions table
- ❌ `questions_search_update_trigger` on questions table

### ACTIVE
- ✅ `images_search_vector_trigger` on images table
- ✅ `question_flags_analytics_trigger` on question_flags table
- ✅ `question_reviews_analytics_trigger` on question_reviews table
- ✅ `quiz_attempts_analytics_trigger` on quiz_attempts table
- ✅ `update_quiz_attempts_updated_at` on quiz_attempts table
- ✅ `update_quiz_sessions_updated_at` on quiz_sessions table

## Row Level Security Policies

### questions table
- `Admin Full Access to Questions Table` - Admins can do everything
- `Anonymous users can read published questions` - Public read access to published questions

### question_reviews table
- `question_reviews_admin_all` - Admins have full access to all review records
- `question_reviews_reviewer_insert` - Reviewers can insert reviews for questions under review
- `question_reviews_reviewer_select` - Reviewers can view all reviews for context
- `question_reviews_creator_select_own` - Creators can view reviews of their own questions
- `question_reviews_public_select_published` - Public can view reviews of published questions
- `Reviewers and admins can create reviews` - Legacy policy for review creation
- `Users can view question reviews` - Legacy policy for review viewing

## Known Issues Resolved

1. **Explanation Field Error**: The `update_questions_search_vector()` function was referencing a non-existent `explanation` field on the questions table. ✅ FIXED

2. **Version Trigger Schema Mismatch**: The `create_question_version()` trigger function had outdated column references that didn't match the current `question_versions` table schema. ✅ FIXED

3. **Table Name Inconsistency**: The `get_question_snapshot_data()` function was referencing `questions_tags` instead of `question_tags`. ✅ FIXED

4. **Snapshot Format Standardization**: Updated version snapshots to use the same format as import/export JSON for consistency. ✅ FIXED

5. **Question Editing**: Question editing now works correctly. The system can:
   - ✅ Update question basic fields (title, stem, difficulty, teaching point, references, status)
   - ✅ Update answer options with explanations
   - ✅ Handle categories and question sets
   - ✅ Process images
   - ✅ Create standardized version snapshots
   - ⚠️ Tags functionality temporarily disabled (minor issue)

## Recommendations

1. **Versioning**: Implement a new, simpler versioning system if needed
2. **Search**: Implement a new search vector update system if needed
3. **Testing**: Thoroughly test all question operations before re-enabling any triggers
4. **Monitoring**: Add proper error handling and logging for all database operations
