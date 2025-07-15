# Question Creation and Versioning System

## Overview

This document describes the complete question creation, review, and versioning workflow for the Pathology Bites question bank system. The system uses semantic versioning (MAJOR.MINOR.PATCH) and a streamlined review process to ensure quality while maintaining efficient content management.

## User Roles

### Four-Role System
- **Admin**: Full access to all features and system management
- **Creator**: Can create questions and manage content
- **Reviewer**: Can review drafts and handle flagged questions
- **User**: Quiz taking only

## Question States

### Core States
- `draft` - Being created or edited, not ready for review
- `under_review` - Submitted for review, in reviewer queue
- `published` - Live and available to users
- `rejected` - Not suitable, back to original creator
- `pending_major_edits` - Needs significant changes, goes to communal draft pool
- `pending_minor_edits` - Reviewer will make small edits and approve

### Special State
- `published + flagged` - Live question with user-reported issues

## Question Creation Process

### 1. Initial Creation (v1.0.0)
**Who:** Creator
**Process:**
1. Creator fills out question form in Questions → Create Question
2. Saves as `draft` status
3. Can edit multiple times while in draft
4. Clicks "Submit for Review" → status becomes `under_review`
5. Question appears in **Review Drafts** queue

### 2. Review Process
**Who:** Any available reviewer (doesn't have to be the same person)
**Process:**
Reviewer examines question and makes one of four decisions:

#### ✅ Approved
- Status: `draft` → `published`
- Version: `1.0.0` (first publication)
- JSON snapshot created
- Question goes live immediately

#### ❌ Rejected
- Status: `under_review` → `rejected`
- Goes back to **original creator only**
- Creator can edit and resubmit (back to `draft`)
- No version change until resubmitted

#### 🔧 Pending Major Edits
- Status: `under_review` → `pending_major_edits`
- Goes to **communal draft pool** (any creator/admin can edit)
- Appears in **Questions** page with special "Needs Major Edits" filter
- Anyone can claim it, edit it, and resubmit for review

#### ✏️ Pending Minor Edits
- Status: `under_review` → `pending_minor_edits`
- **Reviewer immediately makes the minor edits**
- Status automatically becomes `published`
- Version: `1.0.0`
- JSON snapshot created with reviewer as editor

## Versioning System

### Semantic Versioning Format: MAJOR.MINOR.PATCH

### Update Type Definitions

#### Patch Update (v1.0.0 → v1.0.1)
**Strictly Limited To:**
- **Typos**: Spelling errors, grammatical mistakes
- **Formatting**: Spacing, punctuation, capitalization
- **References**: Fixing broken links, correcting citations
- **Minor Wording**: Clarity improvements without changing meaning
- **Image Alt Text**: Accessibility improvements

**Key Requirement:** Admin must **consciously consent** this is superficial
**No Review Required** - Direct publication

#### Minor Update (v1.0.0 → v1.1.0)
**Everything Else That's Not a Rewrite:**
- Adding/removing/modifying answer options
- Changing teaching points
- Updating explanations
- Modifying difficulty level
- Adding/removing images
- Category changes
- Significant wording changes that alter meaning

**Review Required** for published questions (admin can choose direct update for minor changes)

#### Major Update (v1.0.0 → v2.0.0)
**Complete Question Rewrite:**
- Fundamental change in question intent
- Complete restructuring of content
- Different medical scenario/case
- Converting question types

**Always Review Required**

## Post-Publication Editing

### Process
When editing a published question, editor must choose update type:

1. **Patch Update**
   - Direct update - no review needed
   - Question stays `published`
   - JSON snapshot created immediately

2. **Minor Update**
   - Admin decides: Direct update OR send for review
   - If direct: stays `published`, JSON snapshot created
   - If review needed: status becomes `under_review`

3. **Major Update**
   - Always requires review
   - Status: `published` → `under_review`
   - Goes back to Review Drafts queue

## Flagged Question Handling

### Process
1. User flags published question with reason
2. Question becomes `published + flagged`
3. Appears in **Review Flagged** queue
4. Admin/Reviewer investigates and either:
   - **Edit Question:** Choose patch/minor/major update (follows versioning rules)
   - **Dismiss Flag:** Remove flag, question stays `published`

## JSON Snapshot System

### When Snapshots Are Created
- Every version update (patch, minor, major)
- Complete question data stored as single JSON file
- Prevents race conditions and data inconsistency

### Snapshot Structure
```json
{
  "version": "1.2.3",
  "update_type": "patch|minor|major", 
  "change_summary": "Description of changes",
  "timestamp": "2024-01-15T10:30:00Z",
  "changed_by": "user_id",
  "question_data": {
    "question": { /* complete question object */ },
    "question_options": [ /* all answer options */ ],
    "question_images": [ /* all images with metadata */ ],
    "question_tags": [ /* all tags */ ]
  }
}
```

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

### Questions Page Enhanced Filters
- **Status:** Draft, Under Review, Published, Rejected, Needs Major Edits
- **My Questions:** Show only questions I created
- **Flagged:** Show only flagged questions
- **Version:** Show questions by version number
- **Recent:** Recently modified questions

### Special Section: "Needs Major Edits"
- Shows all `pending_major_edits` questions
- Any creator can "claim" and edit these
- Clear indication of what reviewer feedback was

## Database Schema

### Enhanced Questions Table
```sql
ALTER TABLE questions ADD COLUMN version_major INTEGER DEFAULT 1;
ALTER TABLE questions ADD COLUMN version_minor INTEGER DEFAULT 0;
ALTER TABLE questions ADD COLUMN version_patch INTEGER DEFAULT 0;
ALTER TABLE questions ADD COLUMN version_string TEXT GENERATED ALWAYS AS 
  (version_major || '.' || version_minor || '.' || version_patch) STORED;
ALTER TABLE questions ADD COLUMN change_summary TEXT;
ALTER TABLE questions ADD COLUMN update_type TEXT CHECK (update_type IN ('patch', 'minor', 'major'));
ALTER TABLE questions ADD COLUMN is_flagged BOOLEAN DEFAULT FALSE;
ALTER TABLE questions ADD COLUMN original_creator_id UUID REFERENCES users(id);
ALTER TABLE questions ADD COLUMN current_editor_id UUID REFERENCES users(id);
```

### Question Versions Table
```sql
CREATE TABLE question_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  
  -- Semantic version numbers
  version_major INTEGER NOT NULL,
  version_minor INTEGER NOT NULL,
  version_patch INTEGER NOT NULL,
  version_string TEXT NOT NULL, -- "1.2.3"
  
  -- Complete question snapshot as JSON
  question_data JSONB NOT NULL,
  
  -- Change tracking
  update_type TEXT NOT NULL CHECK (update_type IN ('patch', 'minor', 'major')),
  change_summary TEXT,
  changed_by UUID NOT NULL REFERENCES users(id),
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(question_id, version_major, version_minor, version_patch),
  INDEX(question_id, version_major DESC, version_minor DESC, version_patch DESC)
);
```

### Question Status Constraint
```sql
ALTER TABLE questions 
ADD CONSTRAINT questions_status_check 
CHECK (status IN ('draft', 'under_review', 'published', 'rejected', 'pending_major_edits', 'pending_minor_edits'));
```

## Race Condition Prevention

### Atomic Version Updates
```sql
-- Single atomic transaction for version updates
BEGIN;
  -- Lock the question row
  SELECT version_major, version_minor, version_patch 
  FROM questions 
  WHERE id = $1 
  FOR UPDATE;
  
  -- Update version numbers atomically
  UPDATE questions SET 
    version_patch = CASE 
      WHEN $update_type = 'patch' THEN version_patch + 1
      WHEN $update_type = 'minor' THEN 0
      WHEN $update_type = 'major' THEN 0
    END,
    version_minor = CASE 
      WHEN $update_type = 'minor' THEN version_minor + 1
      WHEN $update_type = 'major' THEN 0
      ELSE version_minor
    END,
    version_major = CASE 
      WHEN $update_type = 'major' THEN version_major + 1
      ELSE version_major
    END,
    updated_at = NOW()
  WHERE id = $1;
  
  -- Create version snapshot
  INSERT INTO question_versions (...) VALUES (...);
COMMIT;
```

## Key Benefits

### Simplified Review Flow
- Clear four-option decision tree for reviewers
- No need to track specific reviewer assignments
- Communal editing pool for questions needing major work

### Efficient Resource Usage
- Minor edits handled immediately by reviewer
- Major edits can be tackled by any available creator
- No questions stuck waiting for specific people

### Clear Version Control
- Semantic versioning with clear update type selection
- Complete JSON snapshots prevent data loss
- Audit trail of all changes

### Flexible Collaboration
- Questions needing major edits become community resources
- Any qualified person can improve them
- Original creator credit preserved

## Typical Workflows

### Creator Daily Flow
1. Check Dashboard for overview
2. Create new questions → Save as draft → Submit for review
3. Check "Needs Major Edits" section for community questions to improve
4. Edit rejected questions and resubmit

### Reviewer Daily Flow
1. Check Review Drafts queue for new submissions
2. Review and make decisions (approve/reject/pending edits)
3. Check Review Flagged queue for user-reported issues
4. Handle flagged questions (edit or dismiss)

### Admin Daily Flow
- All reviewer capabilities PLUS:
- Quick patch updates on published questions
- User management and system oversight
- Handle escalated issues and system maintenance

This system maintains quality control while allowing efficient content management and clear version tracking through comprehensive JSON snapshots.
