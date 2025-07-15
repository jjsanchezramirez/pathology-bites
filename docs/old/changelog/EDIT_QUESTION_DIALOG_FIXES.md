# Edit Question Dialog Fixes

## Overview
Fixed critical issues in the edit question dialog related to unsaved changes detection and status dropdown validation.

## Changes Made

### 1. Fixed Image Changes Not Activating Update Button

**Problem**: Adding or removing media images in the edit question dialog was not activating the Update Question button, preventing users from saving their changes.

**Root Cause**: The unsaved changes detection was only monitoring form field changes through `form.watch()`, but it wasn't tracking changes to the `questionImages` state that gets updated when users add or remove images through the MediaSection components.

**Solution**: Added a new `useEffect` hook that specifically monitors changes to images, tags, and categories by comparing the current state with the original data:

```typescript
// Track changes to images, tags, and categories (but ignore during initialization)
useEffect(() => {
  if (!isInitializing && fullQuestionData) {
    // Compare current state with original data to detect changes
    const originalImages = fullQuestionData.question_images?.map(qi => ({
      image_id: qi.image?.id || '',
      question_section: (qi.question_section === 'explanation' ? 'explanation' : 'stem') as 'stem' | 'explanation',
      order_index: qi.order_index || 0
    })) || [];
    const originalTagIds = fullQuestionData.tags?.map(tag => tag.id) || [];
    const originalCategoryId = fullQuestionData.categories?.[0]?.id || '';

    const imagesChanged = JSON.stringify(questionImages) !== JSON.stringify(originalImages);
    const tagsChanged = JSON.stringify(selectedTagIds.sort()) !== JSON.stringify(originalTagIds.sort());
    const categoryChanged = selectedCategoryId !== originalCategoryId;

    if (imagesChanged || tagsChanged || categoryChanged) {
      console.log('🖼️ Non-form changes detected:', { imagesChanged, tagsChanged, categoryChanged });
      setHasUnsavedChanges(true);
    }
  }
}, [questionImages, selectedTagIds, selectedCategoryId, isInitializing, fullQuestionData]);
```

**Benefits**:
- ✅ Image changes now properly activate the Update Question button
- ✅ Tag and category changes are also tracked
- ✅ Initialization protection prevents false positives during data loading
- ✅ Comprehensive tracking of all question-related state changes

### 2. Fixed Status Dropdown Validation Errors

**Problem**: The status dropdown was throwing validation errors: "Invalid enum value. Expected 'draft' | 'under_review' | 'approved_with_edits' | 'rejected' | 'published' | 'flagged' | 'archived', received 'review'"

**Root Cause**: 
1. The dropdown was using incorrect value `"review"` instead of `"under_review"`
2. The Zod schema and dropdown options didn't match the actual database constraint

**Solution**: 
1. **Fixed incorrect enum value**: Changed `value="review"` to `value="under_review"`
2. **Updated to match database constraint**: Verified the actual database constraint and updated both the Zod schema and dropdown options to include all 7 correct values

**Database Constraint**:
```sql
CHECK (status IN ('draft', 'under_review', 'published', 'rejected', 'pending_major_edits', 'pending_minor_edits', 'archived'))
```

**Updated Zod Schema**:
```typescript
status: z.enum(['draft', 'under_review', 'published', 'rejected', 'pending_major_edits', 'pending_minor_edits', 'archived']),
```

**Updated Dropdown Options**:
```typescript
<SelectContent>
  <SelectItem value="draft">Draft</SelectItem>
  <SelectItem value="under_review">Under Review</SelectItem>
  <SelectItem value="published">Published</SelectItem>
  <SelectItem value="rejected">Rejected</SelectItem>
  <SelectItem value="pending_major_edits">Pending Major Edits</SelectItem>
  <SelectItem value="pending_minor_edits">Pending Minor Edits</SelectItem>
  <SelectItem value="archived">Archived</SelectItem>
</SelectContent>
```

**Benefits**:
- ✅ No more validation errors when selecting status options
- ✅ Complete coverage of all database status values
- ✅ Perfect alignment between UI, validation, and database constraints
- ✅ Supports the complete question review workflow

## Status Values Explained

1. **`draft`** - Question is being created or edited
2. **`under_review`** - Question is being reviewed by a reviewer  
3. **`published`** - Question is live and available to users
4. **`rejected`** - Question was rejected and needs major revisions
5. **`pending_major_edits`** - Question needs significant changes and goes to communal draft pool
6. **`pending_minor_edits`** - Question needs small edits that reviewer will make and approve
7. **`archived`** - Question is archived and no longer active

## Files Modified

- `src/features/questions/components/edit-question-dialog.tsx`
  - Added comprehensive unsaved changes detection for images, tags, and categories
  - Fixed status dropdown enum values
  - Updated Zod schema to match database constraint

## Testing

- ✅ Build passes without TypeScript errors
- ✅ Lint passes with only warnings (no errors)
- ✅ Status dropdown validation works correctly
- ✅ Image changes properly activate Update button
- ✅ All status enum values are available and functional

## Impact

These fixes resolve critical usability issues in the edit question dialog:
- Users can now properly save changes when adding/removing images
- Status dropdown works without validation errors
- Complete workflow support for all question statuses
- Improved user experience and data integrity
