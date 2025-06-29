# Question Review Workflow System

## Overview

This document describes the enhanced question review workflow system that has been implemented to improve question quality and provide better oversight of content creation and management.

## New User Role: Reviewer

### Reviewer Capabilities
- **Review draft questions**: Can approve, request revisions, or reject questions
- **Flag published questions**: Can flag problematic published questions for review
- **Access admin dashboard**: Has access to admin interface with review-specific features
- **Cannot create questions**: Reviewers focus on review activities only (admins can still create)

### Reviewer vs Admin Permissions
- **Reviewers**: Can review drafts, flag published questions, view review queue
- **Admins**: All reviewer permissions + create questions, manage published questions, manage users

## Question Statuses

The system now supports the following question statuses:

1. **Draft**: Question is being created or edited
2. **Under Review**: Question is being reviewed by a reviewer
3. **Approved with Edits**: Question was approved with minor edits and published
4. **Rejected**: Question was rejected and needs major revisions
5. **Published**: Question is live and available to users
6. **Flagged**: Published question has been flagged for review
7. **Archived**: Question is no longer active

## Review Actions

When reviewing a draft question, reviewers can take one of four actions:

### 1. Approve As-Is
- **Result**: Question is immediately published without changes
- **Status Change**: Draft → Published
- **Use Case**: Question is perfect as submitted

### 2. Approve with Minor Edits
- **Result**: Reviewer makes small changes (typos, formatting, clarity) and publishes
- **Status Change**: Draft → Published
- **Use Case**: Question is good but needs minor improvements

### 3. Request Major Revisions
- **Result**: Question is sent back to creator with specific feedback
- **Status Change**: Draft → Draft (stays in draft)
- **Use Case**: Question needs significant improvements
- **Required**: Detailed feedback explaining what needs to be changed

### 4. Reject with Feedback
- **Result**: Question is moved to rejected status with explanation
- **Status Change**: Draft → Rejected
- **Use Case**: Question is fundamentally flawed or inappropriate
- **Required**: Explanation of why the question is being rejected

## Question Flagging System

### Who Can Flag Questions
- Any authenticated user can flag published questions
- Reviewers and admins can manage flags

### Flag Types
1. **Incorrect Answer**: The correct answer or explanations are wrong
2. **Unclear Question**: The question is confusing or ambiguous
3. **Outdated Content**: The information is no longer current
4. **Inappropriate Content**: Content is inappropriate or offensive
5. **Technical Issue**: Images not loading, formatting problems, etc.
6. **Other**: Other issues not covered above

### Flag Statuses
1. **Pending**: Flag has been submitted and awaits review
2. **Under Review**: Flag is being investigated
3. **Resolved**: Issue has been fixed
4. **Dismissed**: Flag was determined to be invalid

## Version Control System

### Automatic Version Creation
- Every time a question is created or updated, a new version is automatically created
- Versions store complete question content as JSON
- Version numbers increment automatically
- Tracks who made each change and when

### Version Content
Each version stores:
- Question title, stem, difficulty
- Teaching point and references
- Status at time of version creation
- Question set assignment
- Timestamp and creator information

## Database Schema Changes

### New Tables

#### question_reviews
- Tracks all review actions taken on questions
- Links reviewers to questions and their decisions
- Stores feedback and any changes made

#### question_versions
- Complete version history of all questions
- JSON storage of question content at each version
- Enables rollback and change tracking

#### question_flags
- Manages flagging of published questions
- Tracks flag type, description, and resolution
- Links flaggers and resolvers

### Enhanced questions Table
New fields added:
- `reviewed_by`: ID of reviewer who last reviewed
- `reviewed_at`: Timestamp of last review
- `flagged_by`: ID of user who flagged the question
- `flagged_at`: Timestamp when flagged
- `flag_reason`: Type of flag that was raised

## User Interface Changes

### New Pages
1. **Review Queue** (`/admin/questions/review-queue`): Central hub for all review activities
2. **Enhanced Questions Table**: Now includes flag functionality for published questions

### New Components
1. **QuestionReviewDialog**: Interface for reviewing draft questions
2. **QuestionFlagDialog**: Interface for flagging published questions
3. **ReviewQueueTable**: Displays questions needing review with priority indicators

### Updated Navigation
- Admin sidebar now includes "Review Queue" link
- Reviewers see same admin interface as admins
- Status filters updated to include all new statuses

## API Endpoints

### Question Reviews
- `POST /api/question-reviews`: Create a new review
- `GET /api/question-reviews`: Fetch reviews (with optional question filter)

### Question Flags
- `POST /api/question-flags`: Create a new flag
- `GET /api/question-flags`: Fetch flags (with optional filters)
- `PATCH /api/question-flags`: Update flag status (resolve/dismiss)

## Security & Permissions

### Row Level Security (RLS)
- All new tables have RLS enabled
- Reviewers can only see reviews/flags they're authorized to view
- Question creators can see reviews of their own questions
- Users can see flags they created

### Role-Based Access Control
- Middleware updated to allow reviewer access to admin routes
- API endpoints check for appropriate permissions
- Database policies enforce access restrictions

## Testing

### Test Data Created
- Test reviewer user: `subhashis-mitra@uiowa.edu` (role: reviewer)
- Test draft question with answer options for workflow testing
- Database constraints updated to allow 'reviewer' role

### How to Test
1. Log in as reviewer user
2. Navigate to `/admin/questions/review-queue`
3. Review the test draft question
4. Test different review actions
5. Flag a published question to test flagging workflow

## Future Enhancements

### Potential Improvements
1. **Email notifications**: Notify creators when questions are reviewed
2. **Review assignments**: Assign specific questions to specific reviewers
3. **Review metrics**: Track reviewer performance and question quality
4. **Bulk actions**: Allow reviewing multiple questions at once
5. **Review templates**: Pre-defined feedback templates for common issues

### Analytics Opportunities
1. **Review turnaround time**: Track how long reviews take
2. **Question quality trends**: Monitor rejection/revision rates
3. **Flag analysis**: Identify common quality issues
4. **Reviewer workload**: Balance review assignments

## Migration Notes

### Database Migration
- All changes are backward compatible
- Existing questions maintain their current status
- New fields are nullable and have sensible defaults
- Triggers automatically create versions for existing questions

### User Impact
- Existing admin users retain all permissions
- Regular users see no changes to their interface
- New reviewer role provides focused review capabilities
- Question creators will see review feedback in their questions

This enhanced workflow provides better quality control, clearer accountability, and improved collaboration between question creators and reviewers while maintaining the existing user experience for end users.
