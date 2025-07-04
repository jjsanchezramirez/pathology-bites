# Pathology Bites Database Comprehensive Summary

## Overview
This document provides a complete overview of all database objects, policies, functions, and security configurations in the Pathology Bites application database.

---

## 📊 Database Statistics

### Tables: 21 total (All with RLS Enabled)
### Views: 6 total (All with Security Invoker)
### Functions: 19 total (All with Secure Search Path)
### RLS Policies: 58 total
### Triggers: 8 total
### Indexes: 58 total (excluding primary keys)

---

## 🗃️ Tables and RLS Status

All tables have Row Level Security (RLS) enabled for maximum security:

| Table | Purpose | RLS Status |
|-------|---------|------------|
| `audit_logs` | System audit trail | ✅ Enabled |
| `categories` | Question categories | ✅ Enabled |
| `demo_questions` | Demo question management | ✅ Enabled |
| `images` | Image storage and metadata | ✅ Enabled |
| `inquiries` | User inquiries/contact forms | ✅ Enabled |
| `notification_states` | User notification preferences | ✅ Enabled |
| `performance_analytics` | User performance tracking | ✅ Enabled |
| `question_analytics` | Question statistics | ✅ Enabled |
| `question_flags` | Question flagging system | ✅ Enabled |
| `question_images` | Question-image relationships | ✅ Enabled |
| `question_options` | Answer options for questions | ✅ Enabled |
| `question_reports` | Question reporting system | ✅ Enabled |
| `question_reviews` | Question review workflow | ✅ Enabled |
| `question_tags` | Question-tag relationships | ✅ Enabled |
| `question_versions` | Question versioning system | ✅ Enabled |
| `questions` | Main questions table | ✅ Enabled |
| `quiz_attempts` | User quiz attempts | ✅ Enabled |
| `quiz_sessions` | Quiz session management | ✅ Enabled |
| `sets` | Question sets/collections | ✅ Enabled |
| `tags` | Question tags | ✅ Enabled |
| `users` | User accounts and profiles | ✅ Enabled |
| `waitlist` | Pre-launch waitlist | ✅ Enabled |

---

## 👁️ Views (All Security Invoker)

All views use `SECURITY INVOKER` to respect user permissions:

| View | Purpose | Security |
|------|---------|----------|
| `v_dashboard_stats` | Dashboard statistics | Security Invoker |
| `v_flagged_questions` | Questions with pending flags | Security Invoker |
| `v_image_usage_by_category` | Image usage analytics by category | Security Invoker |
| `v_image_usage_stats` | Detailed image usage statistics | Security Invoker |
| `v_orphaned_images` | Unused images for cleanup | Security Invoker |
| `v_storage_stats` | Storage utilization summary | Security Invoker |

---

## ⚙️ Functions (All Secure)

All functions have `SET search_path = public` for security:

### Analytics Functions
- `calculate_question_analytics(uuid)` - Calculate question performance metrics
- `recalculate_all_question_analytics()` - Recalculate all question analytics
- `trigger_update_question_analytics()` - Trigger function for analytics updates
- `trigger_update_question_analytics_flags_reviews()` - Analytics trigger for flags/reviews

### Search Functions
- `update_questions_search_vector()` - Update question search vectors
- `update_images_search_vector()` - Update image search vectors

### User Management Functions
- `handle_new_user()` - Process new user registration
- `handle_deleted_user()` - Clean up deleted users
- `is_admin(uuid)` - Check if user is admin
- `is_admin()` - Check if current user is admin
- `is_current_user_admin()` - Check current user admin status

### Versioning Functions
- `create_question_version()` - Trigger function for versioning
- `create_question_version(uuid, text, text)` - Create question version
- `update_question_version(uuid, text, text, jsonb)` - Update question version
- `get_question_snapshot_data(uuid)` - Get question snapshot

### Demo Functions
- `select_demo_questions(integer)` - Select demo questions (function)
- `select_demo_questions(uuid[])` - Select demo questions (procedure)

### Utility Functions
- `update_updated_at_column()` - Update timestamp trigger
- `create_audit_logs_table()` - Legacy audit table creation

---

## 🔒 RLS Policies Summary

### By Role Access Patterns:

#### Admin-Only Access (Full Control)
- `categories` - Full CRUD access
- `images` - Full CRUD access  
- `inquiries` - Full CRUD access
- `notification_states` - Full CRUD access
- `question_images` - Full CRUD access
- `question_options` - Full CRUD access
- `question_reports` - Full CRUD access
- `question_tags` - Full CRUD access
- `questions` - Full CRUD access
- `sets` - Full CRUD access
- `tags` - Full CRUD access
- `users` - Full CRUD access
- `audit_logs` - SELECT only
- `waitlist` - SELECT only

#### User-Owned Data Access
- `performance_analytics` - Users can manage their own data
- `quiz_sessions` - Users can manage their own sessions
- `quiz_attempts` - Users can manage their own attempts
- `users` - Users can read/update their own profile

#### Collaborative Access
- `question_flags` - Users can create, admins/reviewers can manage
- `question_reviews` - Reviewers can create, creators can view their questions
- `question_versions` - Role-based access (admin all, reviewer pending, creator own)

#### Public Access
- `demo_questions` - Public read for active demos
- `images` - Public read access
- `question_images` - Public read access
- `question_options` - Anonymous read for published questions
- `questions` - Anonymous read for published questions
- `waitlist` - Public insert access

#### System-Only Access
- `audit_logs` - System insert only
- `question_analytics` - System insert/update only
- `question_versions` - System insert only

---

## 🔄 Triggers

| Trigger | Table | Function | Timing | Events |
|---------|-------|----------|--------|--------|
| `images_search_vector_trigger` | images | update_images_search_vector | BEFORE | INSERT, UPDATE |
| `question_flags_analytics_trigger` | question_flags | trigger_update_question_analytics_flags_reviews | AFTER | INSERT, DELETE, UPDATE |
| `question_reviews_analytics_trigger` | question_reviews | trigger_update_question_analytics_flags_reviews | AFTER | INSERT, DELETE, UPDATE |
| `create_question_version_trigger` | questions | create_question_version | AFTER | INSERT, UPDATE |
| `questions_search_update_trigger` | questions | update_questions_search_vector | BEFORE | INSERT, UPDATE |
| `quiz_attempts_analytics_trigger` | quiz_attempts | trigger_update_question_analytics | AFTER | INSERT, DELETE, UPDATE |
| `update_quiz_attempts_updated_at` | quiz_attempts | update_updated_at_column | BEFORE | UPDATE |
| `update_quiz_sessions_updated_at` | quiz_sessions | update_updated_at_column | BEFORE | UPDATE |

---

## 📈 Key Indexes

### Performance-Critical Indexes

#### Search Indexes
- `idx_questions_search` - GIN index on questions.search_vector
- `idx_images_search_vector` - GIN index on images.search_vector

#### User-Related Indexes
- `idx_users_role` - Role-based queries
- `idx_users_role_status` - Combined role and status queries
- `idx_quiz_sessions_user_date` - User quiz history
- `idx_performance_analytics_user` - User performance lookups

#### Question-Related Indexes
- `idx_questions_status` - Question status filtering
- `idx_questions_difficulty_status` - Published questions by difficulty
- `idx_questions_user_status_date` - User's questions by status and date
- `idx_question_analytics_question_id` - Analytics lookups
- `idx_question_analytics_success_rate` - Performance sorting

#### Foreign Key Indexes
- `idx_question_images_question` - Question-image relationships
- `idx_question_options_question` - Question-option relationships
- `idx_quiz_attempts_session_id` - Session-attempt relationships
- `idx_quiz_attempts_question_id` - Question-attempt relationships

#### Unique Constraints
- `users_email_key` - Unique user emails
- `tags_name_key` - Unique tag names
- `sets_name_key` - Unique set names
- `unique_demo_question` - Unique demo questions
- `unique_session_question` - Unique quiz attempts per session/question

---

## 🛡️ Security Features

### 1. Row Level Security (RLS)
- **All 21 tables** have RLS enabled
- **58 policies** control data access
- **Role-based access** for admin, creator, reviewer, user
- **User-owned data** protection for personal information

### 2. Function Security
- **All 19 functions** have `SET search_path = public`
- **Security Definer** functions for privileged operations
- **Prevents search path injection** attacks

### 3. View Security
- **All 6 views** use `SECURITY INVOKER`
- **Respects user permissions** - no privilege escalation
- **RLS policies enforced** on underlying tables

### 4. Authentication Integration
- **Supabase Auth** integration with `auth.uid()`
- **JWT-based** role checking
- **Service role** access for system operations

---

## 🔄 Data Flow Patterns

### Question Lifecycle
1. **Creation** → questions table (draft status)
2. **Versioning** → question_versions table (automatic)
3. **Review** → question_reviews table
4. **Publishing** → questions.status = 'published'
5. **Analytics** → question_analytics table (automatic)
6. **Flagging** → question_flags table (user-driven)

### User Interaction Flow
1. **Registration** → users table via handle_new_user()
2. **Quiz Taking** → quiz_sessions → quiz_attempts
3. **Performance** → performance_analytics (automatic)
4. **Content Creation** → questions (if creator/admin)

### Image Management Flow
1. **Upload** → images table
2. **Association** → question_images table
3. **Search Indexing** → search_vector (automatic)
4. **Usage Tracking** → via views for analytics

---

## 📊 Analytics & Monitoring

### Automated Analytics
- **Question performance** tracked via question_analytics
- **User performance** tracked via performance_analytics
- **Search vectors** maintained automatically
- **Audit logs** for security monitoring

### Dashboard Data Sources
- `v_dashboard_stats` - Overall system statistics
- `v_flagged_questions` - Content moderation queue
- `v_storage_stats` - Storage utilization
- `v_image_usage_stats` - Image management

---

## 🔧 Maintenance Features

### Automated Maintenance
- **Updated timestamps** via triggers
- **Search vector updates** automatic
- **Analytics recalculation** on data changes
- **Version creation** on question updates

### Manual Maintenance Tools
- `recalculate_all_question_analytics()` - Full analytics refresh
- `v_orphaned_images` - Identify unused images
- Audit logs for security review

---

## 🎯 Role-Based Access Summary

### Admin Role
- **Full database access** to all tables
- **User management** capabilities
- **System monitoring** via audit logs
- **Content moderation** tools

### Creator Role
- **Question creation** and editing (own drafts)
- **Content submission** for review
- **Version history** access for own questions
- **Image management** for content creation

### Reviewer Role
- **Question review** and approval
- **Analytics access** for review decisions
- **Flag management** for content moderation
- **Version history** for pending questions

### User Role
- **Quiz taking** and performance tracking
- **Question flagging** for community moderation
- **Own data management** (profile, sessions)
- **Public content access** (published questions)

This comprehensive database design ensures security, performance, and scalability while supporting the complete question review workflow and user management system.
