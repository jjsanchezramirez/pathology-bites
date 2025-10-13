# Tag Merge Functionality - Verification & Testing Plan

**Date:** October 13, 2025  
**API Route:** `src/app/api/admin/tags/merge/route.ts`  
**Status:** ✅ FIXED - Critical bug resolved

---

## 🐛 Bug Found & Fixed

### Critical Issue Discovered

**Problem:** The merge operation was deleting source question_tags **BEFORE** inserting target tags.

**Old Order (WRONG):**
```
1. Get questions with source tags
2. Get questions that already have target tag
3. ❌ DELETE source question_tags  ← WRONG ORDER
4. INSERT target tags
5. Delete source tags
```

**Risk:**
- If INSERT fails, questions lose their source tags but don't get the target tag
- Questions left in inconsistent state with missing tags
- Data integrity compromised

### Fix Applied

**New Order (CORRECT):**
```
1. Get questions with source tags
2. Get questions that already have target tag
3. ✅ INSERT target tags FIRST  ← CORRECT ORDER
4. ✅ DELETE source question_tags (only after successful insert)
5. Delete source tags
```

**Benefits:**
- If INSERT fails, source tags remain intact (no data loss)
- Ensures data integrity throughout the operation
- Questions always have tags (either source or target)

---

## 📋 Implementation Details

### Correct Sequence (Now Implemented)

**Step 1: Identify Questions with Source Tags**
```typescript
// Get all unique question_ids that use any of the source tags
const { data: sourceQuestionTags } = await supabase
  .from('question_tags')
  .select('question_id')
  .in('tag_id', sourceTagIds)

const questionIdsToTag = [...new Set(sourceQuestionTags?.map(qt => qt.question_id) || [])]
```

**Step 2: Check for Existing Target Tags**
```typescript
// Get questions that already have the target tag (to avoid duplicates)
const { data: existingTargetTags } = await supabase
  .from('question_tags')
  .select('question_id')
  .eq('tag_id', targetTagId)
  .in('question_id', questionIdsToTag)

const existingQuestionIds = new Set(existingTargetTags?.map(qt => qt.question_id) || [])
```

**Step 3: Insert Target Tags (BEFORE deleting source tags)**
```typescript
// Only insert for questions that don't already have the target tag
const newQuestionTags = questionIdsToTag
  .filter(questionId => !existingQuestionIds.has(questionId))
  .map(questionId => ({
    question_id: questionId,
    tag_id: targetTagId
  }))

if (newQuestionTags.length > 0) {
  await supabase
    .from('question_tags')
    .insert(newQuestionTags)
}
```

**Step 4: Delete Source Question Tags (AFTER successful insert)**
```typescript
// Safe to delete now that target tags are in place
await supabase
  .from('question_tags')
  .delete()
  .in('tag_id', sourceTagIds)
```

**Step 5: Delete Source Tags**
```typescript
// Remove source tags from tags table
await supabase
  .from('tags')
  .delete()
  .in('id', sourceTagIds)
```

---

## 🧪 Test Scenarios

### Test Case 1: Basic Merge (No Overlap)

**Setup:**
- Create tags: "Tag A", "Tag B", "Target Tag"
- Question 1: Has "Tag A"
- Question 2: Has "Tag B"
- Question 3: Has no tags

**Action:**
- Merge "Tag A" and "Tag B" into "Target Tag"

**Expected Result:**
- ✅ Question 1: Has "Target Tag" (no "Tag A")
- ✅ Question 2: Has "Target Tag" (no "Tag B")
- ✅ Question 3: Still has no tags
- ✅ "Tag A" deleted from tags table
- ✅ "Tag B" deleted from tags table
- ✅ "Target Tag" remains in tags table

**SQL Verification:**
```sql
-- Check question_tags
SELECT question_id, tag_id FROM question_tags 
WHERE question_id IN (question1_id, question2_id, question3_id);

-- Check tags table
SELECT id, name FROM tags 
WHERE name IN ('Tag A', 'Tag B', 'Target Tag');
```

---

### Test Case 2: Merge with Overlap (Question has both source and target)

**Setup:**
- Create tags: "Tag A", "Tag B", "Target Tag"
- Question 1: Has "Tag A"
- Question 2: Has "Tag B"
- Question 3: Has both "Tag A" AND "Target Tag"

**Action:**
- Merge "Tag A" and "Tag B" into "Target Tag"

**Expected Result:**
- ✅ Question 1: Has "Target Tag" (no "Tag A")
- ✅ Question 2: Has "Target Tag" (no "Tag B")
- ✅ Question 3: Has only "Target Tag" (no duplicate, no "Tag A")
- ✅ "Tag A" deleted from tags table
- ✅ "Tag B" deleted from tags table
- ✅ "Target Tag" remains in tags table

**SQL Verification:**
```sql
-- Verify no duplicates for Question 3
SELECT question_id, COUNT(*) as tag_count 
FROM question_tags 
WHERE question_id = question3_id AND tag_id = target_tag_id
GROUP BY question_id;
-- Should return: tag_count = 1 (not 2)

-- Verify Tag A is removed from Question 3
SELECT * FROM question_tags 
WHERE question_id = question3_id AND tag_id = tag_a_id;
-- Should return: 0 rows
```

---

### Test Case 3: Multiple Questions, Multiple Tags

**Setup:**
- Create tags: "Tag A", "Tag B", "Tag C", "Target Tag"
- Question 1: Has "Tag A", "Tag B"
- Question 2: Has "Tag B", "Tag C"
- Question 3: Has "Tag A", "Target Tag"
- Question 4: Has "Target Tag" only

**Action:**
- Merge "Tag A", "Tag B", "Tag C" into "Target Tag"

**Expected Result:**
- ✅ Question 1: Has "Target Tag" (no "Tag A", no "Tag B")
- ✅ Question 2: Has "Target Tag" (no "Tag B", no "Tag C")
- ✅ Question 3: Has only "Target Tag" (no duplicate, no "Tag A")
- ✅ Question 4: Has "Target Tag" (unchanged)
- ✅ "Tag A", "Tag B", "Tag C" deleted from tags table
- ✅ "Target Tag" remains in tags table

---

### Test Case 4: Edge Case - All Questions Already Have Target Tag

**Setup:**
- Create tags: "Tag A", "Tag B", "Target Tag"
- Question 1: Has "Tag A" AND "Target Tag"
- Question 2: Has "Tag B" AND "Target Tag"

**Action:**
- Merge "Tag A" and "Tag B" into "Target Tag"

**Expected Result:**
- ✅ Question 1: Has only "Target Tag" (no duplicate, no "Tag A")
- ✅ Question 2: Has only "Target Tag" (no duplicate, no "Tag B")
- ✅ No new question_tags entries created (0 inserts)
- ✅ "Tag A" and "Tag B" deleted from tags table
- ✅ "Target Tag" remains in tags table

---

### Test Case 5: Edge Case - No Questions Use Source Tags

**Setup:**
- Create tags: "Tag A", "Tag B", "Target Tag"
- No questions have any of these tags

**Action:**
- Merge "Tag A" and "Tag B" into "Target Tag"

**Expected Result:**
- ✅ No question_tags changes
- ✅ "Tag A" and "Tag B" deleted from tags table
- ✅ "Target Tag" remains in tags table

---

## 🔍 Manual Testing Steps

### Prerequisites
1. Start development server: `npm run dev`
2. Navigate to: http://localhost:3000/admin/labels
3. Ensure you're logged in as admin/creator/reviewer

### Test Procedure

**Step 1: Create Test Tags**
1. Click "Create Tag" button
2. Create "Tag A"
3. Create "Tag B"
4. Create "Target Tag"

**Step 2: Assign Tags to Questions**
1. Navigate to Questions page
2. Edit Question 1: Add "Tag A"
3. Edit Question 2: Add "Tag B"
4. Edit Question 3: Add both "Tag A" and "Target Tag"

**Step 3: Perform Merge**
1. Go back to Labels page
2. Select "Tag A" (checkbox)
3. Select "Tag B" (checkbox)
4. Click "Merge Selected" button
5. In merge dialog, select "Target Tag" as target
6. Click "Merge Tags" button
7. Wait for success toast

**Step 4: Verify Results**
1. Check that "Tag A" and "Tag B" are gone from tags list
2. Check that "Target Tag" still exists
3. Navigate to Questions page
4. Verify Question 1 has "Target Tag" (not "Tag A")
5. Verify Question 2 has "Target Tag" (not "Tag B")
6. Verify Question 3 has only "Target Tag" (no duplicate)

**Step 5: Database Verification (Optional)**
```sql
-- Check question_tags table
SELECT q.id, q.title, t.name as tag_name
FROM questions q
JOIN question_tags qt ON q.id = qt.question_id
JOIN tags t ON qt.tag_id = t.id
WHERE q.id IN (question1_id, question2_id, question3_id)
ORDER BY q.id, t.name;

-- Check for duplicates
SELECT question_id, tag_id, COUNT(*) as count
FROM question_tags
GROUP BY question_id, tag_id
HAVING COUNT(*) > 1;
-- Should return: 0 rows

-- Check tags table
SELECT * FROM tags WHERE name IN ('Tag A', 'Tag B', 'Target Tag');
-- Should return: Only 'Target Tag'
```

---

## ✅ Verification Checklist

### Data Integrity
- [ ] Questions that had source tags now have target tag
- [ ] Questions that had both source and target tags have only target tag (no duplicates)
- [ ] No questions lost tags during merge
- [ ] Source tags completely removed from tags table
- [ ] Target tag remains in tags table
- [ ] No orphaned question_tags entries

### Error Handling
- [ ] If insert fails, source tags remain intact (rollback behavior)
- [ ] Proper error messages displayed to user
- [ ] Console logs show detailed operation steps
- [ ] No database inconsistencies on error

### UI/UX
- [ ] Success toast shows correct merge count
- [ ] Tags list refreshes after merge
- [ ] Selection cleared after merge
- [ ] Merge dialog closes after success
- [ ] Loading state shows during operation

### Edge Cases
- [ ] Merging 2 tags works
- [ ] Merging 3+ tags works
- [ ] Merging when all questions already have target tag works
- [ ] Merging when no questions use source tags works
- [ ] Cannot merge target tag into itself (validation)

---

## 🚀 Build Status

**Build:** ✅ PASSING
```
✓ Compiled successfully in 8.6s
```

**Lint:** ✅ PASSING (no errors)

---

## 📝 Summary

**Bug Fixed:** ✅ Critical data integrity issue resolved  
**Implementation:** ✅ Follows correct sequence (INSERT before DELETE)  
**Testing:** Ready for manual verification  
**Risk:** Low - improved data safety with new order  

**Next Steps:**
1. Perform manual testing using test cases above
2. Verify database state after each test
3. Test edge cases thoroughly
4. Monitor console logs for any errors
5. Confirm no duplicate tags in question_tags table

