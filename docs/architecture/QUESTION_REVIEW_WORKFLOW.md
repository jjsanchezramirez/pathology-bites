# Question Review Workflow System

## Overview

This document describes the streamlined question review workflow system that ensures quality control while maintaining efficient content management. The system uses a four-role structure and semantic versioning to provide clear workflows for question creation, review, and maintenance.

## User Roles

### Four-Role System
- **Admin**: Full access to all features and system management
- **Creator**: Can create questions and manage content
- **Reviewer**: Can review drafts and handle flagged questions
- **User**: Quiz taking only

### Role Permissions
- **Admin**: All capabilities - create, edit, review, manage users, system settings
- **Creator**: Create questions, manage content, edit draft questions
- **Reviewer**: Review draft questions, handle flagged questions, access review queues
- **User**: Take quizzes, flag published questions

## Question Statuses

The system supports the following question statuses:

1. **Draft**: Question is being created or edited
2. **Under Review**: Question is submitted and awaiting reviewer decision
3. **Published**: Question is live and available to users
4. **Rejected**: Question was rejected and returned to original creator
5. **Pending Major Edits**: Question needs significant changes, goes to communal draft pool
6. **Pending Minor Edits**: Reviewer will make small edits and approve immediately
7. **Published + Flagged**: Live question with user-reported issues

## Review Process

### Initial Question Creation
1. **Creator** creates question and saves as `draft`
2. Creator can edit multiple times while in draft status
3. Creator clicks "Submit for Review" → status becomes `under_review`
4. Question appears in **Review Drafts** queue

### Review Actions

When reviewing a draft question, any available reviewer can take one of four actions:

### 1. ✅ Approved
- **Result**: Question is immediately published as v1.0.0
- **Status Change**: `under_review` → `published`
- **Use Case**: Question is ready for publication as-is
- **Outcome**: JSON snapshot created, question goes live

### 2. ✏️ Pending Minor Edits
- **Result**: Reviewer immediately makes small edits and publishes as v1.0.0
- **Status Change**: `under_review` → `pending_minor_edits` → `published`
- **Use Case**: Question needs small fixes (typos, formatting, minor clarity)
- **Outcome**: Reviewer edits and publishes in one action

### 3. 🔧 Pending Major Edits
- **Result**: Question goes to communal draft pool for significant improvements
- **Status Change**: `under_review` → `pending_major_edits`
- **Use Case**: Question needs substantial content changes
- **Outcome**: Any creator/admin can claim, edit, and resubmit for review

### 4. ❌ Rejected
- **Result**: Question returned to original creator with feedback
- **Status Change**: `under_review` → `rejected`
- **Use Case**: Question is fundamentally flawed or inappropriate
- **Outcome**: Only original creator can edit and resubmit

## Post-Publication Versioning

### Semantic Versioning System
Published questions use **MAJOR.MINOR.PATCH** versioning:

#### Patch Update (v1.0.0 → v1.0.1)
- **Typos, formatting, minor wording, reference fixes**
- **Admin must consciously confirm** this is superficial
- **No review required** - direct update
- Question stays `published`

#### Minor Update (v1.0.0 → v1.1.0)
- **Content changes, answer modifications, teaching point updates**
- **Admin decides**: Direct update OR send for review
- May require review for significant changes

#### Major Update (v1.0.0 → v2.0.0)
- **Complete rewrites, fundamental changes**
- **Always requires review**
- Status becomes `under_review`, goes back to Review Drafts queue

## Question Flagging System

### Who Can Flag Questions
- Any authenticated user can flag published questions
- Reviewers and admins can resolve flags

### Flag Types
1. **Incorrect Answer**: Wrong correct answer or explanations
2. **Unclear Question**: Confusing or ambiguous content
3. **Outdated Content**: Information no longer current
4. **Incorrect Explanations**: Teaching content is wrong
5. **Other**: Issues not covered above

### Flag Resolution Process
1. User flags published question → status becomes `published + flagged`
2. Question appears in **Review Flagged** queue
3. Admin/Reviewer investigates and either:
   - **Edit Question**: Make corrections using patch/minor/major update rules
   - **Dismiss Flag**: Mark as invalid, question stays published

## JSON Snapshot System

### Complete Question Versioning
- Every version update creates a complete JSON snapshot
- Prevents race conditions and data inconsistency
- Stores entire question with all related data in single file

### Snapshot Content
Each JSON snapshot includes:
- Complete question data (title, stem, difficulty, teaching point, references)
- All answer options with explanations
- All associated images with metadata
- All tags and category information
- Version metadata (number, update type, change summary, timestamp, editor)

## Database Schema

### Enhanced Questions Table
```sql
ALTER TABLE questions ADD COLUMN version_major INTEGER DEFAULT 1;
ALTER TABLE questions ADD COLUMN version_minor INTEGER DEFAULT 0;
ALTER TABLE questions ADD COLUMN version_patch INTEGER DEFAULT 0;
ALTER TABLE questions ADD COLUMN version_string TEXT GENERATED ALWAYS AS
  (version_major || '.' || version_minor || '.' || version_patch) STORED;
ALTER TABLE questions ADD COLUMN is_flagged BOOLEAN DEFAULT FALSE;
ALTER TABLE questions ADD COLUMN original_creator_id UUID REFERENCES users(id);
ALTER TABLE questions ADD COLUMN current_editor_id UUID REFERENCES users(id);
```

### Question Versions Table
```sql
CREATE TABLE question_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  version_major INTEGER NOT NULL,
  version_minor INTEGER NOT NULL,
  version_patch INTEGER NOT NULL,
  version_string TEXT NOT NULL,
  question_data JSONB NOT NULL, -- Complete question snapshot
  update_type TEXT NOT NULL CHECK (update_type IN ('patch', 'minor', 'major')),
  change_summary TEXT,
  changed_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(question_id, version_major, version_minor, version_patch)
);
```

### Supporting Tables
- **question_reviews**: Tracks all review decisions and feedback
- **question_flags**: Manages user-reported issues with published questions
- **question_options**: Answer choices with explanations
- **question_images**: Associated images with metadata
- **questions_tags**: Tag associations

## Admin Panel Structure

### Sidebar Navigation
```
📊 Dashboard                    [Admin, Creator, Reviewer]
📝 Questions                    [Admin, Creator]
   ├── All Questions
   ├── Create Question
   ├── Needs Major Edits        [Special filter for pending_major_edits]
🏷️ Tags/Categories/Sets         [Admin, Creator]
📋 Review Drafts                [Admin, Reviewer]
🚩 Review Flagged               [Admin, Reviewer]
🖼️ Images                       [Admin, Creator]
👥 Users                        [Admin only]
📧 Notifications                [Admin only]
📊 Analytics                    [Admin only]
⚙️ Settings                     [Admin only]
```

### Key Pages

#### Review Drafts (`/admin/review-drafts`)
- Queue of questions awaiting review decisions
- Shows new submissions and resubmissions
- Four-action review interface (approve/pending minor/pending major/reject)

#### Review Flagged (`/admin/review-flagged`)
- Queue of published questions with user-reported issues
- Flag investigation and resolution interface
- Edit or dismiss flag options

#### Questions with Enhanced Filters
- **Status filters**: Draft, Under Review, Published, Rejected, Needs Major Edits
- **Flagged questions**: Special view for flagged content
- **Version history**: Access to complete version timeline
- **Communal editing**: "Needs Major Edits" section for community improvement

## Workflow Benefits

### Simplified Review Process
- **Clear four-option decision tree** for reviewers
- **No reviewer assignment tracking** - any reviewer can handle any question
- **Communal editing pool** for questions needing major improvements
- **Immediate minor edits** by reviewers eliminate review cycles

### Efficient Resource Management
- **Questions don't get stuck** waiting for specific reviewers
- **Community collaboration** on questions needing major work
- **Fast patch updates** for minor fixes without bureaucracy
- **Semantic versioning** provides clear change significance

### Quality Control
- **All new questions reviewed** before publication
- **Appropriate review levels** based on change significance
- **Complete audit trail** through JSON snapshots
- **User feedback integration** through flagging system

### Race Condition Prevention
- **Atomic version updates** with database locks
- **Single JSON snapshots** eliminate complex table relationships
- **Clear update type selection** prevents ambiguity
- **Version conflict detection** with retry mechanisms

## Typical Daily Workflows

### Creator Workflow
1. Check Dashboard for overview and feedback
2. Create new questions → Save as draft → Submit for review
3. Check "Needs Major Edits" for community questions to improve
4. Edit rejected questions based on feedback and resubmit

### Reviewer Workflow
1. Check Review Drafts queue for new submissions
2. Review questions and make four-option decisions
3. Make immediate minor edits when appropriate
4. Check Review Flagged queue for user-reported issues
5. Investigate and resolve flags through editing or dismissal

### Admin Workflow
- All reviewer capabilities PLUS:
- Quick patch updates on published questions
- User management and role assignment
- System oversight and maintenance
- Handle escalated issues and policy decisions

## Implementation Considerations

### Database Migration Strategy
- Add new version columns to questions table with sensible defaults
- Create question_versions table for JSON snapshots
- Update question status constraints to include new states
- Migrate existing questions to v1.0.0 baseline
- Create indexes for performance optimization

### API Endpoint Updates
- **Question Reviews**: `POST /api/question-reviews` for review decisions
- **Question Flags**: `POST /api/question-flags` for user reports
- **Version Management**: Enhanced question update endpoints with version type selection
- **Bulk Operations**: Support for batch review actions

### Security & Permissions
- **Row Level Security (RLS)** on all new tables
- **Role-based access control** for admin panel sections
- **API endpoint protection** with role verification
- **Audit logging** for all review and version actions

### Performance Optimizations
- **Indexed version queries** for fast version history access
- **JSON snapshot compression** for storage efficiency
- **Cached review queues** for responsive admin interface
- **Optimistic locking** for concurrent edit prevention

This streamlined workflow system provides robust quality control while maintaining development velocity through clear processes, semantic versioning, and efficient collaboration patterns.
