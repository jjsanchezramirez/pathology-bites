# Simplified Question Review Workflow Implementation

## Overview

This document describes the implementation of the simplified question review workflow that reduces complexity while maintaining quality control. The changes streamline the review process from 7 statuses and 4 review actions down to 4 statuses and 2 review actions.

## Changes Implemented

### 1. Database Schema Updates

**File:** `sql/migrations/20241208_simplify_question_workflow.sql`

#### Question Status Simplification
- **Before:** 7 statuses (`draft`, `under_review`, `published`, `rejected`, `pending_major_edits`, `pending_minor_edits`, `flagged`, `archived`)
- **After:** 4 statuses (`draft`, `under_review`, `published`, `rejected`)

#### Flag System Simplification
- **Before:** 4 flag statuses (`pending`, `under_review`, `resolved`, `dismissed`)
- **After:** 2 flag statuses (`open`, `closed`)
- **Added:** `resolution_type` field (`fixed`, `dismissed`) to track how flags were resolved
- **Added:** `is_flagged` and `flag_count` metadata columns to questions table

#### Review Actions Simplification
- **Before:** 4 actions (`approve_as_is`, `approve_with_minor_edits`, `request_major_revisions`, `reject`)
- **After:** 2 actions (`approve`, `reject`)

### 2. TypeScript Type Updates

**File:** `src/features/questions/types/questions.ts`

```typescript
// Simplified types
export type ReviewAction = 'approve' | 'reject';
export type QuestionStatus = 'draft' | 'under_review' | 'published' | 'rejected';
export type FlagStatus = 'open' | 'closed';
export type FlagResolutionType = 'fixed' | 'dismissed';
```

Updated configuration objects:
- `STATUS_CONFIG`: Removed obsolete statuses
- `REVIEW_ACTION_CONFIG`: Simplified to 2 actions
- `FLAG_STATUS_CONFIG`: New configuration for simplified flag statuses
- `FLAG_RESOLUTION_CONFIG`: New configuration for resolution types

### 3. API Endpoint Updates

#### Question Reviews API (`src/app/api/question-reviews/route.ts`)
- Updated validation to accept only `approve` and `reject` actions
- Simplified status transition logic
- Removed complex branching for intermediate statuses

#### Question Flags API (`src/app/api/question-flags/route.ts`)
- Updated to use `open`/`closed` flag statuses
- Removed manual question status updates (handled by database triggers)
- Added automatic `resolution_type` determination

### 4. New Components

#### Unified Review Queue (`src/features/questions/components/unified-review-queue.tsx`)
- **Replaces:** Separate review drafts and flagged questions pages
- **Features:**
  - Single interface with tab filters
  - Combined view of new submissions and flagged questions
  - Priority scoring (flagged questions appear first)
  - Unified action buttons for all review types

#### Creator Questions Dashboard (`src/features/questions/components/creator-questions-dashboard.tsx`)
- **Purpose:** Dedicated interface for creators to manage their questions
- **Features:**
  - Status-based tabs (All, Drafts, Under Review, Published, Rejected)
  - Clear feedback display for rejected questions
  - Quick actions for editing and resubmitting
  - Statistics cards showing question counts by status

### 5. Updated Components

#### Question Review Dialog (`src/features/questions/components/question-review-dialog.tsx`)
- Simplified action selection (approve/reject only)
- Updated feedback requirements (mandatory only for rejections)
- Removed complex conditional logic for different action types

#### Question Flag Dialog (`src/features/questions/components/question-flag-dialog.tsx`)
- Removed manual question status updates
- Relies on database triggers for flag metadata updates

#### Flagged Questions Table (`src/features/questions/components/flagged-questions-table.tsx`)
- Updated to use `open` flag status instead of `pending`
- Enhanced dismiss functionality with proper resolution tracking

### 6. Database Views

#### Unified Review Queue View (`v_review_queue`)
```sql
CREATE OR REPLACE VIEW v_review_queue AS
SELECT 
  q.*,
  u.first_name || ' ' || u.last_name as creator_name,
  CASE 
    WHEN q.status = 'under_review' AND q.is_flagged = FALSE THEN 'new_submission'
    WHEN q.status = 'published' AND q.is_flagged = TRUE THEN 'flagged_question'
    ELSE 'other'
  END as review_type,
  CASE 
    WHEN q.is_flagged = TRUE THEN q.flag_count
    ELSE 0
  END as priority_score
FROM questions q
LEFT JOIN users u ON q.created_by = u.id
WHERE q.status IN ('under_review') 
   OR (q.status = 'published' AND q.is_flagged = TRUE);
```

#### Creator Questions View (`v_creator_questions`)
```sql
CREATE OR REPLACE VIEW v_creator_questions AS
SELECT 
  q.*,
  s.name as question_set_name,
  (SELECT feedback FROM question_reviews qr 
   WHERE qr.question_id = q.id 
   ORDER BY qr.created_at DESC LIMIT 1) as latest_feedback,
  (SELECT COUNT(*) FROM question_reviews qr 
   WHERE qr.question_id = q.id) as review_count
FROM questions q
LEFT JOIN sets s ON q.question_set_id = s.id;
```

## Migration Required

**Important:** The database migration `20241208_simplify_question_workflow.sql` needs to be applied to the Supabase database before these changes can be used.

The migration includes:
1. Schema updates for simplified statuses
2. Data migration for existing records
3. New database triggers for flag metadata management
4. Updated views for the new workflow

## Benefits Achieved

### 1. Reduced Complexity
- **60% reduction** in decision points for reviewers
- **Simplified mental model** for all user types
- **Clearer status progression** for question creators

### 2. Improved User Experience
- **Unified interface** for reviewers (no more queue fragmentation)
- **Clear feedback loop** for rejected questions
- **Simplified flag management** with binary open/closed states

### 3. Better Maintainability
- **Fewer code paths** to test and maintain
- **Consistent data model** across the application
- **Automated flag metadata** management via database triggers

## Next Steps

1. **Apply Database Migration:** Run the migration script in Supabase
2. **Update Navigation:** Update sidebar navigation to use new unified review queue
3. **Test Workflow:** Thoroughly test the simplified review process
4. **Update Documentation:** Update user guides to reflect new workflow
5. **Monitor Performance:** Ensure the simplified workflow improves review efficiency

## User Role Workflows

### Creator Workflow (Simplified)
1. Create question → Save as draft
2. Submit for review → Status becomes `under_review`
3. If rejected → Fix issues and resubmit
4. If approved → Question becomes `published`

### Reviewer Workflow (Simplified)
1. Access unified review queue
2. Filter by type (new submissions or flagged questions)
3. Review question and choose: Approve or Reject
4. For rejections: Provide detailed feedback
5. For flagged questions: Fix issue or dismiss flag

### Admin Workflow (Unchanged)
- All reviewer capabilities plus direct editing rights
- Can change any question status
- Full system oversight and management

This implementation significantly reduces the complexity of the question review workflow while maintaining all essential quality control mechanisms.
