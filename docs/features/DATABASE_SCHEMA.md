# Database Schema Documentation

This document outlines the database schema for the Pathology Bites application after the comprehensive reorganization completed in July 2025.

## 🎯 **Schema Overview**

The database follows a clean naming convention:
- **`questions_***`** tables directly reference question IDs
- **Simple names** for tables that don't directly reference questions
- **No redundant data** - information is stored in one authoritative place

## 📊 **Core Tables**

### Questions
The central table storing all question data.

**Table: `questions`**
- `id` (uuid, primary key)
- `title` (text, required)
- `stem` (text, required) - The question content
- `difficulty` (text, required) - easy, medium, hard
- `teaching_point` (text, required) - Key learning objective
- `question_references` (text, optional) - Citations and references
- `status` (text, required) - draft, under_review, published, flagged, archived
- `created_by` (uuid, foreign key to users)
- `version` (integer, default 1)
- `question_set_id` (uuid, foreign key to sets)
- `category_id` (uuid, foreign key to categories) - **Direct relationship, no junction table**
- `search_vector` (tsvector) - Full-text search index
- `created_at` (timestamp)
- `updated_at` (timestamp)

### Question Options
Answer choices for questions (renamed from answer_options).

**Table: `question_options`**
- `id` (uuid, primary key)
- `question_id` (uuid, foreign key to questions)
- `text` (text, required) - Option text
- `is_correct` (boolean, required)
- `explanation` (text, optional) - Why this option is correct/incorrect
- `order_index` (integer, required) - Display order
- `created_at` (timestamp)
- `updated_at` (timestamp)

### Sets
Question collections (renamed from question_sets).

**Table: `sets`**
- `id` (uuid, primary key)
- `name` (text, required)
- `description` (text, optional)
- `source_type` (text, required) - AI-Generated, Web, Book, etc.
- `source_details` (jsonb) - Additional source metadata
- `is_active` (boolean, default true)
- `created_by` (uuid, foreign key to users)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### Categories
Hierarchical categorization system.

**Table: `categories`**
- `id` (uuid, primary key)
- `name` (text, required)
- `description` (text, optional)
- `parent_id` (uuid, foreign key to categories) - For hierarchy
- `level` (integer, required) - Depth in hierarchy
- `color` (text, optional) - UI color code
- `short_form` (text, optional) - Abbreviated name
- `created_at` (timestamp)
- `updated_at` (timestamp)

## 📈 **Analytics & Performance**

### Question Analytics
**NEW**: Comprehensive performance metrics for questions.

**Table: `question_analytics`**
- `id` (uuid, primary key)
- `question_id` (uuid, foreign key to questions, unique)
- `total_attempts` (integer, default 0) - Total quiz attempts
- `correct_attempts` (integer, default 0) - Successful attempts
- `avg_time_spent` (interval) - Average time per attempt
- `median_time_spent` (interval) - Median time per attempt
- `success_rate` (numeric 5,4) - Percentage as decimal (0.0000-1.0000)
- `difficulty_score` (numeric 3,2) - Calculated difficulty (1.00-5.00)
- `flag_count` (integer, default 0) - Number of flags received
- `review_count` (integer, default 0) - Number of reviews
- `last_calculated_at` (timestamp) - When metrics were last updated
- `created_at` (timestamp)
- `updated_at` (timestamp)

**Analytics Features:**
- ✅ **Auto-updating**: Triggers recalculate metrics when quiz attempts, flags, or reviews change
- ✅ **Performance optimized**: Indexed for fast queries
- ✅ **Data integrity**: Constraints ensure valid ranges and relationships
- ✅ **Difficulty scoring**: 1.0 = easiest (90%+ success), 5.0 = hardest (<30% success)

## 🎮 **Quiz System**

### Quiz Sessions
Overall quiz instances for users.

**Table: `quiz_sessions`**
- `id` (uuid, primary key)
- `user_id` (uuid, foreign key to users)
- `question_ids` (text[]) - Array of question IDs in order
- `current_question_index` (integer, default 0)
- `score` (integer, default 0)
- `total_questions` (integer, required)
- `time_limit` (integer, optional) - Seconds
- `started_at` (timestamp)
- `completed_at` (timestamp, optional)
- `created_at` (timestamp)

### Quiz Attempts
Individual question attempts within sessions.

**Table: `quiz_attempts`**
- `id` (uuid, primary key)
- `quiz_session_id` (uuid, foreign key to quiz_sessions)
- `question_id` (uuid, foreign key to questions)
- `selected_answer_id` (uuid, foreign key to question_options)
- `is_correct` (boolean, required)
- `time_spent` (integer, optional) - Seconds spent on question
- `attempted_at` (timestamp, default now())

## 🔍 **Content Management**

### Question Images
Images associated with questions.

**Table: `question_images`**
- `id` (uuid, primary key)
- `question_id` (uuid, foreign key to questions)
- `image_id` (uuid, foreign key to images)
- `question_section` (text, required) - stem, explanation, option
- `order_index` (integer, required)
- `created_at` (timestamp)

### Question Tags
Many-to-many relationship between questions and tags.

**Table: `questions_tags`**
- `id` (uuid, primary key)
- `question_id` (uuid, foreign key to questions)
- `tag_id` (uuid, foreign key to tags)
- `created_at` (timestamp)

### Tags
Flexible tagging system.

**Table: `tags`**
- `id` (uuid, primary key)
- `name` (text, required, unique)
- `created_at` (timestamp)

## 🔄 **Quality Control**

### Question Reviews
Formal review process for draft questions.

**Table: `question_reviews`**
- `id` (uuid, primary key)
- `question_id` (uuid, foreign key to questions)
- `reviewer_id` (uuid, foreign key to users)
- `action` (text, required) - approve_as_is, approve_with_edits, request_revisions, reject
- `feedback` (text, optional)
- `created_at` (timestamp)

### Question Flags
User-reported issues with published questions.

**Table: `question_flags`**
- `id` (uuid, primary key)
- `question_id` (uuid, foreign key to questions)
- `flagged_by` (uuid, foreign key to users)
- `flag_type` (text, required) - incorrect_answer, unclear_question, etc.
- `description` (text, optional)
- `status` (text, default 'pending') - pending, resolved, dismissed
- `resolved_by` (uuid, foreign key to users, optional)
- `resolution_notes` (text, optional)
- `created_at` (timestamp)
- `resolved_at` (timestamp, optional)

### Question Versions
Complete audit trail of question changes.

**Table: `question_versions`**
- `id` (uuid, primary key)
- `question_id` (uuid, foreign key to questions)
- `version_number` (integer, required)
- `question_data` (jsonb, required) - Complete question snapshot
- `changed_by` (uuid, foreign key to users)
- `change_summary` (text, optional)
- `created_at` (timestamp)

## 🎯 **Key Improvements from Reorganization**

### ✅ **Eliminated Redundancy**
- Removed duplicate fields from questions table (flagged_by, reviewed_by, etc.)
- Consolidated question_categories into direct foreign key relationship
- Single source of truth for all data

### ✅ **Improved Performance**
- Better indexing strategy
- Optimized query patterns
- Full-text search with search_vector

### ✅ **Enhanced Analytics**
- Comprehensive question performance tracking
- Automatic metric calculation
- Data-driven insights for content improvement

### ✅ **Consistent Naming**
- Clear convention: questions_*** for direct references
- Simplified names for independent tables
- Better developer experience

## 🔧 **Database Functions**

### Analytics Functions
- `calculate_question_analytics(question_id)` - Recalculate metrics for one question
- `recalculate_all_question_analytics()` - Recalculate all question metrics

### Triggers
- Auto-update analytics when quiz attempts change
- Auto-update analytics when flags/reviews change
- Auto-create question versions on changes

## 📊 **Storage Capacity**

### **Supabase Free Tier (500MB) Estimates**
- **Recommended capacity**: 12,000-15,000 questions with 2,500-3,000 active users
- **Storage per question**: ~20KB (including options, analytics, versions)
- **Storage per active user**: ~46KB (including quiz sessions and attempts)

### **Scaling Thresholds**
- **Free Tier (500MB)**: Up to 15,000 questions
- **Pro Tier (8GB)**: Up to 100,000+ questions
- **Team Tier (100GB)**: Enterprise scale

*See [Storage Capacity Analysis](../technical/STORAGE_CAPACITY_ANALYSIS.md) for detailed breakdown and optimization strategies.*
