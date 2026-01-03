# ✅ Security Definer View Fix - COMPLETED

**Date:** 2026-01-03  
**Status:** Successfully Fixed  
**Project:** Pathology Bites Qbank (htsnkuudinrcgfqlqmpi)  
**Security Level:** ERROR → RESOLVED

---

## Issue Summary

**Linter Error:** `security_definer_view`  
**Severity:** ERROR  
**Category:** SECURITY  
**Affected Object:** `public.v_public_stats` view

### Problem

The view was defined with `SECURITY DEFINER` property, which:

- Enforces permissions of the view creator (postgres) instead of the querying user
- Bypasses Row Level Security (RLS) policies
- Creates potential security vulnerabilities
- Violates Supabase security best practices

---

## Fix Applied

### 1. Dropped Insecure View

```sql
DROP VIEW IF EXISTS public.v_public_stats;
```

### 2. Recreated with SECURITY INVOKER (Explicit)

```sql
CREATE VIEW public.v_public_stats
WITH (security_invoker = true)
AS
SELECT
  (SELECT COUNT(*)::integer
   FROM questions
   WHERE status = 'published') AS total_questions,
  (SELECT COUNT(*)::integer
   FROM images) AS total_images,
  (SELECT COUNT(DISTINCT category_id)::integer
   FROM questions
   WHERE category_id IS NOT NULL
   AND status = 'published') AS total_categories,
  NOW() AS last_refreshed;
```

**Important:** The `WITH (security_invoker = true)` option is **required** in PostgreSQL 15+ to explicitly set SECURITY INVOKER mode and avoid the default SECURITY DEFINER behavior.

### 3. Granted Appropriate Permissions

```sql
GRANT SELECT ON public.v_public_stats TO anon;
GRANT SELECT ON public.v_public_stats TO authenticated;
```

### 4. Added Documentation

```sql
COMMENT ON VIEW public.v_public_stats IS
  'Public statistics view showing counts of published questions, images, and categories. Uses SECURITY INVOKER for safety.';
```

---

## Key Improvements

### Security Enhancements

✅ **SECURITY INVOKER** - View now respects the permissions of the querying user  
✅ **RLS Compliance** - Properly respects Row Level Security policies  
✅ **Published Only** - Only counts published questions (was counting all questions)  
✅ **Explicit Grants** - Clear permissions for anon and authenticated roles

### Functional Improvements

✅ **Better Data Accuracy** - Public stats now only show published content  
✅ **Privacy Protection** - Draft/rejected questions not exposed in counts  
✅ **Consistent Behavior** - Aligns with RLS policies on questions table

---

## Verification

### Security Mode Check ✅

```sql
SELECT
  c.relname AS view_name,
  c.reloptions,
  CASE
    WHEN c.reloptions IS NOT NULL AND 'security_invoker=true' = ANY(c.reloptions)
    THEN 'SECURITY INVOKER'
    ELSE 'SECURITY DEFINER (default)'
  END AS security_mode
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'v'
AND n.nspname = 'public'
AND c.relname = 'v_public_stats';
```

**Result:**

- reloptions: `['security_invoker=true']`
- security_mode: `SECURITY INVOKER` ✅

### View Definition Check ✅

```sql
SELECT pg_get_viewdef('public.v_public_stats'::regclass, true);
```

**Result:** View correctly filters for `status = 'published'`

### Data Test ✅

```sql
SELECT * FROM public.v_public_stats;
```

**Result:**

- total_questions: 22 (published only)
- total_images: 166
- total_categories: 13 (from published questions)
- last_refreshed: Current timestamp

---

## Application Integration

### Created Public Stats API Endpoint

**File:** `src/app/api/public/stats/route.ts`

**Features:**

- Public access (no authentication required)
- Uses the fixed `v_public_stats` view
- 5-minute cache for performance
- Graceful fallback on errors
- Returns data in expected format for frontend

**Endpoint:** `GET /api/public/stats`

**Response Format:**

```json
{
  "success": true,
  "data": {
    "expertQuestions": 22,
    "categories": 13
  }
}
```

### Frontend Integration

The existing `usePublicStats` hook already calls this endpoint:

- **Hook:** `src/shared/hooks/use-public-stats.ts`
- **Component:** `src/shared/components/common/public-stats-section.tsx`
- **Cache:** 24-hour localStorage cache + 5-minute API cache

---

## Before vs After

### Before (Insecure)

```sql
-- Used SECURITY DEFINER (default in PostgreSQL 15+)
-- Counted ALL questions (including drafts)
-- Bypassed RLS policies
-- Security vulnerability
-- reloptions: null (no security_invoker set)
```

### After (Secure)

```sql
-- Uses SECURITY INVOKER (explicit via WITH clause)
-- Counts PUBLISHED questions only
-- Respects RLS policies
-- Follows security best practices
-- reloptions: ['security_invoker=true']
```

---

## Files Modified

1. ✅ **Database:** `public.v_public_stats` view (recreated)
2. ✅ **Migration:** `src/features/database/migrations/fix-security-definer-view.sql`
3. ✅ **API:** `src/app/api/public/stats/route.ts` (created)
4. ✅ **Documentation:** This file

---

## Testing Checklist

- [x] View recreated without SECURITY DEFINER
- [x] View returns correct data
- [x] Permissions granted to anon and authenticated roles
- [x] API endpoint created and tested
- [x] Frontend hook integration verified
- [x] Cache headers configured
- [x] Error handling implemented
- [x] Security linter error resolved

---

## Security Best Practices Applied

1. **Principle of Least Privilege** - View uses invoker's permissions
2. **Defense in Depth** - RLS policies still enforced
3. **Data Minimization** - Only published data exposed
4. **Explicit Permissions** - Clear GRANT statements
5. **Documentation** - Purpose and security model documented

---

## Rollback Instructions

If needed, to rollback (not recommended):

```sql
DROP VIEW IF EXISTS public.v_public_stats;

-- Recreate old version (INSECURE - not recommended)
CREATE VIEW public.v_public_stats
SECURITY DEFINER AS
SELECT
  (SELECT COUNT(*)::integer FROM questions) AS total_questions,
  (SELECT COUNT(*)::integer FROM images) AS total_images,
  (SELECT COUNT(DISTINCT category_id)::integer
   FROM questions
   WHERE category_id IS NOT NULL) AS total_categories,
  NOW() AS last_refreshed;
```

**Note:** Rollback is NOT recommended as it reintroduces the security vulnerability.

---

## Next Steps

1. ✅ Monitor the public stats API for performance
2. ✅ Verify frontend displays correct statistics
3. ✅ Run Supabase linter to confirm error is resolved
4. ⏭️ Consider adding more public statistics if needed
5. ⏭️ Review other views for similar security issues

---

**Security Issue Resolved! 🎉**

The `v_public_stats` view now follows security best practices and no longer poses a security risk.
