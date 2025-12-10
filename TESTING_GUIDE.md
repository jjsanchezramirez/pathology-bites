# Security Hardening Testing Guide

This guide will help you test all the security enhancements made in the `security/auth-hardening` branch.

---

## Prerequisites

1. **Start the development server:**
   ```bash
   npm run dev
   ```
   The server should start on `http://localhost:3000` (or 3003 if 3000 is in use)

2. **Have a test account ready:**
   - Student account
   - Admin/Creator/Reviewer account (for admin API testing)

3. **Install a REST client (optional but recommended):**
   - [Postman](https://www.postman.com/)
   - [Insomnia](https://insomnia.rest/)
   - Or use `curl` from terminal

---

## Test 1: CSRF Protection

### What to Test
CSRF tokens should be required for all POST/PUT/PATCH/DELETE requests to protected API routes.

### How to Test

**Option A: Using Browser DevTools**

1. Open browser DevTools (F12)
2. Go to Console tab
3. Try making a POST request without CSRF token:
   ```javascript
   fetch('/api/user/settings', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ theme: 'dark' })
   }).then(r => r.json()).then(console.log)
   ```
   **Expected:** Should return `403 Forbidden` with CSRF error

4. Now try with CSRF token:
   ```javascript
   // First get the CSRF token from a cookie or meta tag
   const csrfToken = document.cookie.split('; ')
     .find(row => row.startsWith('csrf-token='))
     ?.split('=')[1]
   
   fetch('/api/user/settings', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'x-csrf-token': csrfToken
     },
     body: JSON.stringify({ theme: 'dark' })
   }).then(r => r.json()).then(console.log)
   ```
   **Expected:** Should succeed (or return auth error if not logged in)

**Option B: Using curl**

```bash
# Without CSRF token (should fail)
curl -X POST http://localhost:3000/api/user/settings \
  -H "Content-Type: application/json" \
  -d '{"theme":"dark"}'

# Expected: {"error":"CSRF token validation failed"}
```

### What to Look For
- ✅ POST/PUT/PATCH/DELETE requests without CSRF token are rejected with 403
- ✅ GET requests work without CSRF token
- ✅ Requests with valid CSRF token succeed

---

## Test 2: Rate Limiting

### What to Test
API routes should enforce rate limits based on route type.

### How to Test

**Test Admin API Rate Limit (200 req/min)**

1. Open browser DevTools Console
2. Run this script to make 210 requests quickly:
   ```javascript
   async function testRateLimit() {
     for (let i = 0; i < 210; i++) {
       const response = await fetch('/api/admin/system-status')
       const headers = {
         limit: response.headers.get('X-RateLimit-Limit'),
         remaining: response.headers.get('X-RateLimit-Remaining'),
         reset: response.headers.get('X-RateLimit-Reset')
       }
       console.log(`Request ${i + 1}:`, response.status, headers)
       
       if (response.status === 429) {
         console.log('Rate limit hit at request', i + 1)
         break
       }
     }
   }
   testRateLimit()
   ```
   **Expected:** Should hit rate limit around request 200-210

**Test Quiz API Rate Limit (50 req/min)**

```javascript
async function testQuizRateLimit() {
  for (let i = 0; i < 60; i++) {
    const response = await fetch('/api/quiz/options')
    console.log(`Request ${i + 1}:`, response.status, 
      'Remaining:', response.headers.get('X-RateLimit-Remaining'))
    
    if (response.status === 429) {
      console.log('Rate limit hit at request', i + 1)
      const data = await response.json()
      console.log('Error:', data)
      break
    }
  }
}
testQuizRateLimit()
```
**Expected:** Should hit rate limit around request 50-60

### What to Look For
- ✅ Rate limit headers present in responses (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset)
- ✅ Requests return 429 status when limit exceeded
- ✅ Different routes have different limits (admin: 200, user: 100, quiz: 50, media: 30)

---

## Test 3: API Route Authorization

### What to Test
Protected routes should require authentication and proper roles.

### How to Test

**Test Unauthenticated Access**

1. Open an incognito/private browser window (not logged in)
2. Try accessing protected routes:
   ```javascript
   // Should all return 401 Unauthorized
   fetch('/api/user/settings').then(r => console.log('User API:', r.status))
   fetch('/api/quiz/sessions').then(r => console.log('Quiz API:', r.status))
   fetch('/api/admin/users').then(r => console.log('Admin API:', r.status))
   ```
   **Expected:** All should return `401 Unauthorized`

**Test Student Access to Admin Routes**

1. Log in as a Student user
2. Try accessing admin routes:
   ```javascript
   fetch('/api/admin/users').then(r => r.json()).then(console.log)
   ```
   **Expected:** Should return `403 Forbidden` (not authorized)

**Test Admin Access**

1. Log in as Admin/Creator/Reviewer
2. Try accessing admin routes:
   ```javascript
   fetch('/api/admin/system-status').then(r => r.json()).then(console.log)
   ```
   **Expected:** Should succeed and return data

### What to Look For
- ✅ Unauthenticated users get 401 on protected routes
- ✅ Students cannot access `/api/admin/*` routes (403)
- ✅ Admin/Creator/Reviewer can access appropriate routes
- ✅ Public routes (like `/api/public/auth/*`) work without auth

---

## Test 4: Refactored Quiz API Routes

### What to Test
Quiz API routes moved from `/api/content/quiz` to `/api/quiz` should work correctly.

### How to Test

**Test Old Routes (Should Not Exist)**

```javascript
// These should return 404
fetch('/api/content/quiz/sessions').then(r => console.log('Old route:', r.status))
```
**Expected:** `404 Not Found`

**Test New Routes (Should Work)**

```javascript
// These should work (with auth)
fetch('/api/quiz/sessions').then(r => console.log('New route:', r.status))
fetch('/api/quiz/options').then(r => console.log('Quiz options:', r.status))
```
**Expected:** `200 OK` (if authenticated) or `401 Unauthorized` (if not)

### What to Look For
- ✅ Old `/api/content/quiz/*` routes return 404
- ✅ New `/api/quiz/*` routes work correctly
- ✅ Quiz functionality in the app still works (take a quiz, view results, etc.)

---

## Test 5: Session Security

### What to Test
Session fingerprinting and validation should work correctly.

### How to Test

1. **Log in normally:**
   - Go to `/login`
   - Log in with valid credentials
   - **Expected:** Should log in successfully

2. **Check session fingerprint:**
   ```javascript
   // In browser console
   console.log('Session fingerprint:', sessionStorage.getItem('session_fingerprint'))
   ```
   **Expected:** Should see a JSON object with browser/device info

3. **Test session validation:**
   - Navigate around the app (dashboard, quiz pages, etc.)
   - **Expected:** Should work normally, no security warnings

4. **Test fingerprint mismatch (advanced):**
   - This is hard to test manually, but the system should detect:
     - Browser changes
     - Device changes
     - Suspicious session activity

### What to Look For
- ✅ Session fingerprint is stored in sessionStorage
- ✅ No console errors about session security
- ✅ App works normally with session validation active

---

## Test 6: End-to-End User Flows

### What to Test
Complete user workflows should work with all security enhancements.

### Flows to Test

**1. Sign Up Flow**
- Go to `/signup`
- Fill out form and submit
- Check email for verification link
- Click verification link
- **Expected:** Account created, redirected to dashboard

**2. Login Flow**
- Go to `/login`
- Enter credentials
- **Expected:** Logged in, redirected to dashboard

**3. Quiz Flow**
- Go to `/dashboard/quiz/new`
- Create a quiz
- Take the quiz
- View results
- **Expected:** All quiz API calls work (using new `/api/quiz/*` routes)

**4. Admin Flow (if you have admin access)**
- Go to `/admin/dashboard`
- Navigate to different admin pages
- Create/edit content
- **Expected:** All admin API calls work with proper auth

### What to Look For
- ✅ No console errors
- ✅ No network errors (check DevTools Network tab)
- ✅ All features work as expected
- ✅ Rate limit headers visible in Network tab

---

## Quick Smoke Test (5 minutes)

If you're short on time, run this quick test:

1. **Start dev server:** `npm run dev`
2. **Build test:** `npm run build` (should succeed)
3. **Login test:** Log in to the app
4. **Quiz test:** Take a quiz (tests new `/api/quiz/*` routes)
5. **Admin test:** Access admin dashboard (if you have access)
6. **Rate limit test:** Run the rate limit script from Test 2
7. **Check console:** No errors in browser console

---

## Automated Testing (Optional)

If you want to write automated tests, here's a starter:

```typescript
// __tests__/api/security.test.ts
describe('API Security', () => {
  it('should reject requests without CSRF token', async () => {
    const response = await fetch('/api/user/settings', {
      method: 'POST',
      body: JSON.stringify({ theme: 'dark' })
    })
    expect(response.status).toBe(403)
  })

  it('should enforce rate limits', async () => {
    const requests = Array(60).fill(null).map(() => 
      fetch('/api/quiz/options')
    )
    const responses = await Promise.all(requests)
    const rateLimited = responses.some(r => r.status === 429)
    expect(rateLimited).toBe(true)
  })

  it('should require auth for protected routes', async () => {
    const response = await fetch('/api/user/settings')
    expect(response.status).toBe(401)
  })
})
```

---

## Troubleshooting

### Issue: CSRF errors on legitimate requests
**Solution:** Make sure CSRF token is being sent in the `x-csrf-token` header

### Issue: Rate limit hit too quickly
**Solution:** Wait 60 seconds for the rate limit window to reset

### Issue: 401 errors when logged in
**Solution:** Check that session cookie is being sent with requests

### Issue: Old quiz routes still work
**Solution:** Hard refresh the browser (Cmd+Shift+R / Ctrl+Shift+R)

---

## Summary Checklist

After testing, verify:

- [ ] CSRF protection works (rejects requests without token)
- [ ] Rate limiting works (returns 429 after limit)
- [ ] Auth middleware works (401 for unauth, 403 for unauthorized)
- [ ] Quiz routes moved successfully (old routes 404, new routes work)
- [ ] Session security works (no console errors)
- [ ] All user flows work end-to-end
- [ ] No console errors or warnings
- [ ] Build succeeds (`npm run build`)

If all checkboxes are checked, the security hardening is working correctly! ✅

