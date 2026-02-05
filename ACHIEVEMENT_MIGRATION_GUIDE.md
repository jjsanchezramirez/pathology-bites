# Achievement System Migration Guide

## Overview
This migration moves achievement definitions from hardcoded TypeScript to database as single source of truth.

## What Changed

### Before (Two Sources of Truth ❌)
```
TypeScript (ACHIEVEMENT_DEFINITIONS) ← Used everywhere
Database (achievements table) ← Unused, outdated
```

### After (Single Source of Truth ✅)
```
Database (achievements table) ← Source of truth
↓
API fetches from database
↓
Client uses database definitions
↓
TypeScript constants only for server validation logic
```

---

## Migration Steps

### Step 1: Run SQL Migration ⚠️ REQUIRED

**In Supabase SQL Editor:**
```bash
# Navigate to Supabase Dashboard → SQL Editor
# Run the following file:
```

Copy and run: `dev/scripts/sql/update-achievement-descriptions.sql`

This updates the differential diagnosis descriptions to match the new wording:
- "Answer 10 Qs from 3 different subjects" → "Reach 10 correct in 3 subjects"
- "Answer 25 Qs from 10 different subjects" → "Reach 25 correct in 10 subjects"
- "Answer 50 Qs from 20 different subjects" → "Reach 50 correct in 20 subjects"
- "Answer 100 Qs from all subjects" → "Reach 100 correct in all subjects"

**Verify Migration:**
```sql
SELECT id, title, description
FROM achievements
WHERE category = 'differential'
ORDER BY requirement;
```

Expected output:
```
differential-10-3    | Broad Exposure        | Reach 10 correct in 3 subjects
differential-25-10   | Generalist            | Reach 25 correct in 10 subjects
differential-50-20   | Community Pathologist | Reach 50 correct in 20 subjects
differential-100-all | Jack Of All Trades    | Reach 100 correct in all subjects
```

---

### Step 2: Clear Cache

After running the SQL migration, users need to clear their cache to see updated descriptions:

**Option A: Wait 30 minutes**
- Cache will expire naturally and fetch fresh data

**Option B: Manual clear (Immediate)**
```javascript
// In browser console on any page:
localStorage.removeItem('pathology-bites-swr-user-data');
location.reload();
```

---

## Code Changes Made

### 1. API Route (`/api/user/performance-data`)
- ✅ Fetches achievement definitions from `achievements` table
- ✅ Includes definitions in response
- ✅ Falls back to TypeScript constants if DB fetch fails (safety)

### 2. TypeScript Types (`use-unified-data.ts`)
- ✅ Added `definitions` array to achievements interface
- ✅ Contains: id, title, description, category, requirement, animation_type

### 3. Achievements Page (`dashboard/achievements/page.tsx`)
- ✅ No longer imports `ACHIEVEMENT_DEFINITIONS`
- ✅ Uses `definitions` from API response
- ✅ Hydrates progress with database definitions

### 4. TypeScript Constants (`achievement-checker.ts`)
- ℹ️ Still exists for server-side validation logic
- ℹ️ NOT used for display data anymore
- ℹ️ Can be synced with database or removed in future

---

## Benefits

✅ **Single Source of Truth** - Database is authoritative
✅ **Easy Updates** - Change descriptions in DB, no code deployment needed
✅ **No Drift** - TypeScript and database can't get out of sync
✅ **Consistency** - All environments use same data
✅ **Future Flexibility** - Can add/modify achievements via database

---

## Testing

### 1. Verify Database Has Data
```sql
SELECT COUNT(*) FROM achievements;
-- Should return 46
```

### 2. Test API Response
```bash
# In browser console:
fetch('/api/user/performance-data')
  .then(r => r.json())
  .then(d => console.log(d.data.achievements.definitions));

# Should show 46 achievement definitions with updated descriptions
```

### 3. Test Achievements Page
1. Navigate to `/dashboard/achievements`
2. Check "Differential Diagnosis" section
3. Verify descriptions show:
   - "Reach 10 correct in 3 subjects" (not "Answer 10 Qs from...")
   - "Reach 25 correct in 10 subjects"
   - etc.

### 4. Test Progress Hiding
1. Check "Jack Of All Trades" achievement
2. If progress < 25%, should show "Locked"
3. If progress ≥ 25%, should show progress bar

---

## Rollback Plan

If something goes wrong:

### Option 1: Revert Database
```sql
-- Restore old descriptions
UPDATE achievements
SET description = 'Answer 10 Qs from 3 different subjects'
WHERE id = 'differential-10-3';

UPDATE achievements
SET description = 'Answer 25 Qs from 10 different subjects'
WHERE id = 'differential-25-10';

UPDATE achievements
SET description = 'Answer 50 Qs from 20 different subjects'
WHERE id = 'differential-50-20';

UPDATE achievements
SET description = 'Answer 100 Qs from all subjects'
WHERE id = 'differential-100-all';
```

### Option 2: Revert Code
```bash
git revert <commit-hash>
# Reverts to using hardcoded TypeScript definitions
```

---

## Future Improvements

1. **Admin UI** - Create interface to edit achievements in database
2. **Remove TypeScript Constants** - Only keep for types, fetch all from DB
3. **Achievement Versioning** - Track when descriptions change
4. **Dynamic Requirements** - Store formulas in DB (advanced)

---

## Summary

✅ **SQL Migration**: Update 4 descriptions in database
✅ **Code Changes**: 3 files modified (API, types, page)
✅ **Testing**: Verify database, API, and UI
✅ **Result**: Database is now source of truth for achievement definitions

**Next Step**: Run the SQL migration in Supabase!
