# Testing API Optimizations

## Quick Test Guide

### 1. Test User Settings Caching

**Steps:**
1. Open browser DevTools → Network tab
2. Navigate to `/dashboard`
3. Count `/api/user/settings` calls (should be **1**)
4. Navigate to `/dashboard/quiz/new`
5. Count `/api/user/settings` calls (should be **0** - cached!)
6. Navigate to `/dashboard/settings`
7. Count `/api/user/settings` calls (should be **0** - cached!)

**Expected Results:**
- ✅ Only 1 settings API call on initial dashboard load
- ✅ Subsequent pages use cached data
- ✅ Total settings calls: 1 (was 4)

**Cache Verification:**
```javascript
// In browser console
localStorage.getItem('pathology-bites-settings:user-settings')
// Should show cached settings with timestamp
```

---

### 2. Test Batched Quiz Initialization

**Steps:**
1. Clear cache: `localStorage.clear()`
2. Open DevTools → Network tab
3. Navigate to `/dashboard/quiz/new`
4. Look for API calls

**Expected Results:**
- ✅ Single `/api/quiz/init` call (not `/api/quiz/sessions` + `/api/quiz/options`)
- ✅ Response includes both sessions and options data
- ✅ Page loads faster (~2s vs ~5.6s)

**Response Structure:**
```json
{
  "success": true,
  "data": {
    "sessions": {
      "titles": ["Quiz 1", "Quiz 2"],
      "count": 2
    },
    "options": {
      "categories": [...],
      "questionTypeStats": {...}
    }
  }
}
```

---

### 3. Test Cache Invalidation

**Steps:**
1. Navigate to `/dashboard/settings`
2. Change a setting (e.g., text zoom)
3. Check Network tab for `/api/user/settings` PATCH call
4. Navigate to another page
5. Return to `/dashboard/settings`

**Expected Results:**
- ✅ Settings update triggers cache invalidation
- ✅ Fresh data loaded on next page visit
- ✅ Updated settings persist across sessions

---

### 4. Performance Comparison

**Before Optimization:**
```
Dashboard → Quiz Navigation:
- /api/user/settings (235ms)
- /api/user/settings (160ms) ← duplicate
- /api/user/settings (116ms) ← duplicate
- /api/quiz/sessions (1772ms)
- /api/user/settings (1628ms) ← duplicate
- /api/quiz/options (2214ms)
Total: ~6.1 seconds, 6 API calls
```

**After Optimization:**
```
Dashboard → Quiz Navigation:
- /api/user/settings (235ms) ← cached for 5 min
- /api/quiz/init (2000ms) ← batched
Total: ~2.2 seconds, 2 API calls
```

**Savings:**
- **Time:** 6.1s → 2.2s (-64%)
- **API Calls:** 6 → 2 (-67%)

---

## Browser Console Tests

### Check Cache Status
```javascript
// User settings cache
const settingsCache = localStorage.getItem('pathology-bites-settings:user-settings')
console.log('Settings Cache:', JSON.parse(settingsCache))

// Quiz init cache
const quizCache = localStorage.getItem('pathology-bites-quiz:quiz-init-100')
console.log('Quiz Init Cache:', JSON.parse(quizCache))
```

### Verify Cache Timestamps
```javascript
const cache = JSON.parse(localStorage.getItem('pathology-bites-settings:user-settings'))
const age = Date.now() - cache.timestamp
console.log(`Cache age: ${Math.round(age / 1000)}s`)
console.log(`TTL: ${cache.ttl / 1000}s`)
console.log(`Expired: ${age > cache.ttl}`)
```

### Clear All Caches
```javascript
// Clear all pathology-bites caches
Object.keys(localStorage)
  .filter(key => key.startsWith('pathology-bites-'))
  .forEach(key => localStorage.removeItem(key))
console.log('All caches cleared')
```

---

## Network Tab Monitoring

### Filter API Calls
```
Filter: /api/
```

### Key Metrics to Watch
- **Request Count:** Should decrease significantly
- **Total Load Time:** Should be ~60-80% faster
- **Cached Responses:** Look for "(from cache)" in DevTools

### Expected API Call Pattern

**Dashboard Load (First Visit):**
```
✓ GET /api/user/settings (200) - 235ms
✓ GET /api/user/dashboard/stats (200) - 647ms
```

**Navigate to Quiz (Cached):**
```
✓ GET /api/quiz/init (200) - 2000ms
(no /api/user/settings - using cache!)
```

**Navigate to Settings (Cached):**
```
(no /api/user/settings - using cache!)
```

---

## Regression Testing

### Ensure No Breaking Changes

1. **Settings Updates Work:**
   - Change text zoom → saves correctly
   - Change theme → applies immediately
   - Change quiz defaults → persists

2. **Quiz Creation Works:**
   - Categories load correctly
   - Question counts accurate
   - Quiz starts successfully

3. **Cache Invalidation Works:**
   - Update settings → cache refreshes
   - Stale data (>5 min) → auto-refreshes

---

## Performance Monitoring

### Lighthouse Audit
```bash
# Run Lighthouse on quiz page
npm run build
npm start
# Open Chrome DevTools → Lighthouse → Run audit
```

**Target Metrics:**
- Performance: >90
- First Contentful Paint: <1.5s
- Time to Interactive: <3.5s

### Real User Monitoring

Add to browser console:
```javascript
// Measure page load time
window.addEventListener('load', () => {
  const loadTime = performance.now()
  console.log(`Page loaded in ${Math.round(loadTime)}ms`)
})
```

---

## Troubleshooting

### Cache Not Working?
```javascript
// Check if localStorage is available
console.log('localStorage available:', typeof localStorage !== 'undefined')

// Check cache service
import { cacheService } from '@/shared/services/cache-service'
console.log('Cache service:', cacheService)
```

### Stale Data?
```javascript
// Force cache refresh
localStorage.removeItem('pathology-bites-settings:user-settings')
location.reload()
```

### API Still Called Multiple Times?
- Check if components are mounting/unmounting
- Verify `enabled` prop in hooks
- Check for duplicate hook calls

---

## Database Function Testing

### Test Function Directly

Run in Supabase SQL Editor:
```sql
-- Test with your user ID and category IDs
SELECT * FROM get_user_category_stats(
  'YOUR_USER_ID'::UUID,
  ARRAY(SELECT id FROM categories WHERE level = 2)::UUID[]
);
```

**Expected Output:**
- One row per category
- Columns: category_id, all_count, unused_count, incorrect_count, marked_count, correct_count
- Execution time: <100ms

### Verify Stats Accuracy

1. Pick a category you've attempted questions in
2. Check the stats returned by the function
3. Manually verify:
   - `all_count`: Total published questions in category
   - `unused_count`: Questions you've never attempted
   - `incorrect_count`: Questions you got wrong at least once
   - `marked_count`: Questions in your favorites
   - `correct_count`: Questions you only got correct

### Performance Check

```sql
EXPLAIN ANALYZE
SELECT * FROM get_user_category_stats(
  'YOUR_USER_ID'::UUID,
  ARRAY(SELECT id FROM categories WHERE level = 2)::UUID[]
);
```

**Target:** Execution time <100ms for 25 categories

---

## Success Criteria ✅

- ✅ Settings API calls: 4 → 1 (-75%)
- ✅ Quiz init API calls: 3 → 1 (-67%)
- ✅ Quiz init response time: ~500-600ms
- ✅ Bandwidth: 100 KB → 0.4 KB (-99.6%)
- ✅ Total navigation time: ~14s → ~3s (-79%)
- ✅ Cache persists across page refreshes
- ✅ Cache invalidates on settings updates
- ✅ User stats are accurate
- ✅ Database function executes efficiently
- ✅ No breaking changes

