# Comprehensive Authentication Testing Guide

This guide provides a step-by-step manual testing protocol for the complete authentication system of Pathology Bites. Use this when you want to meticulously verify the entire auth flow from start to finish.

## Test Environment Setup

### 1. Database Setup
- Ensure dev database is separate from production
- Check `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`

### 2. Test User Setup
Create these test accounts:
- `test-student@example.com` (student role)
- `test-admin@example.com` (admin role)
- `test-soft-deleted@example.com` (soft-deleted user)

### 3. Browser Setup
- **Primary browser**: Chrome (normal mode)
- **Secondary browser**: Firefox (for concurrent session testing)
- **Incognito/Private mode**: For clean state testing

### 4. Tools Needed
- Browser DevTools (Network, Application tabs)
- Postman/Insomnia (API testing)
- Email testing: Check Supabase email logs or use Mailtrap

---

## Phase 1: Sign Up Flow

### Test 1.1: Successful Sign Up

**Steps:**
1. Navigate to `/signup`
2. Fill form with valid data:
   - Email: `new-user-test@example.com`
   - Password: `TestPass123`
   - First Name: `Test`
   - Last Name: `User`
   - User Type: `Student`
3. Complete CAPTCHA
4. Click "Sign Up"

**Expected Results:**
- ✓ Redirected to `/verify-email?email=new-user-test@example.com`
- ✓ Email sent to inbox (check Supabase dashboard)
- ✓ No user in `public.users` yet (deferred to email verification)
- ✓ User exists in `auth.users` with unconfirmed email

**Verify in Supabase:**
```sql
-- Check auth.users (should show email_confirmed_at = NULL)
SELECT * FROM auth.users WHERE email = 'new-user-test@example.com';

-- Check public.users (should return 0 rows - not created yet)
SELECT * FROM public.users WHERE email = 'new-user-test@example.com';
```

### Test 1.2: Duplicate Email

**Steps:**
1. Try signing up with existing email
2. Should show: "An account with this email already exists"

**Expected Results:**
- ✓ Error shown before submit (email check API)
- ✓ Form disabled if email exists
- ✓ Rate limit doesn't count failed client-side validation

### Test 1.3: Password Validation

**Test these invalid passwords:**
- `"short"` → "at least 8 characters"
- `"alllowercase123"` → "at least one uppercase letter"
- `"ALLUPPERCASE123"` → "at least one lowercase letter"
- `"NoNumbers"` → "at least one number"

**Expected Results:**
- ✓ Client-side validation prevents submit
- ✓ Clear error messages shown

### Test 1.4: CAPTCHA Validation

**Steps:**
1. Fill form correctly
2. Skip CAPTCHA (use DevTools to remove requirement)
3. Try to submit

**Expected Results:**
- ✓ Form prevents submission without CAPTCHA
- ✓ Error message shown

### Test 1.5: Rate Limiting

**Steps:**
1. Sign up 3 times with different emails in < 1 hour
2. Try 4th signup

**Expected Results:**
- ✓ 4th attempt blocked
- ✓ Error: "Too many signup attempts..."
- ✓ Block duration: 1 hour

**Check:** DevTools → Application → Local Storage → Check rate limit keys

---

## Phase 2: Email Verification Flow

### Test 2.1: Verify Email (First Time)

**Steps:**
1. Open verification email from Phase 1
2. Click verification link
   Format: `/api/public/auth/confirm?token_hash=...&type=signup`

**Expected Results:**
- ✓ Redirected to `/email-verified`
- ✓ User created in `public.users` with metadata
- ✓ `user_settings` created with defaults
- ✓ Can now log in

**Verify in Database:**
```sql
-- Check user creation
SELECT * FROM public.users WHERE email = 'new-user-test@example.com';
-- Should have: first_name, last_name, user_type, role='user', is_active=true

-- Check user settings
SELECT * FROM user_settings WHERE user_id = (
  SELECT id FROM users WHERE email = 'new-user-test@example.com'
);
-- Should have: quiz_settings, notification_settings, ui_settings
```

### Test 2.2: Expired Verification Link

**Steps:**
1. Use old verification link (>24 hours old) OR manually create expired token

**Expected Results:**
- ✓ Redirected to `/link-expired`
- ✓ Option to resend verification email shown

### Test 2.3: Already Verified

**Steps:**
1. Click same verification link again

**Expected Results:**
- ✓ Redirected to `/email-already-verified`
- ✓ Friendly message shown
- ✓ Link to login page

### Test 2.4: Resend Verification Email

**Steps:**
1. On `/verify-email` page
2. Click "Resend verification email"
3. Wait 1 minute
4. Try again (rate limit test)

**Expected Results:**
- ✓ First resend succeeds
- ✓ New email sent
- ✓ Rate limit enforced: 5 attempts / hour

---

## Phase 3: Login Flow

### Test 3.1: Successful Email/Password Login

**Steps:**
1. Navigate to `/login`
2. Enter verified email: `new-user-test@example.com`
3. Enter password: `TestPass123`
4. Complete CAPTCHA
5. Submit

**Expected Results:**
- ✓ Redirected to `/dashboard`
- ✓ Session created (check DevTools → Application → Cookies)
- ✓ Should see: `sb-<project>-auth-token` cookie
- ✓ Rate limit counter reset on success

**Verify Session:**
```javascript
// DevTools → Console
console.log(await supabase.auth.getSession())
// Should show valid session with access_token, refresh_token
```

### Test 3.2: Unverified Email Login

**Steps:**
1. Create new account but DON'T verify email
2. Try to log in

**Expected Results:**
- ✓ Error: "Email not confirmed"
- ✓ Redirected to `/verify-email?email=...`
- ✓ Option to resend verification shown

### Test 3.3: Invalid Credentials

**Steps:**
1. Enter correct email, wrong password
2. Try 10 times

**Expected Results:**
- ✓ First 9 attempts: "Invalid credentials" error
- ✓ 10th attempt: "Too many login attempts. Try again in 1 minute"
- ✓ Rate limit blocks further attempts

**Check:** `localStorage.getItem('auth_rate_limit')` should show timestamp and count

### Test 3.4: CSRF Token Validation

**Steps:**
1. Open DevTools → Application → Cookies
2. Delete `csrf-token` cookie
3. Try to log in

**Expected Results:**
- ✓ Login fails with "CSRF validation failed"
- ✓ New CSRF token generated
- ✓ Page refresh required

### Test 3.5: Google OAuth Login

**Steps:**
1. Click "Sign in with Google"
2. Complete Google auth flow
3. First-time user: Authorize app

**Expected Results:**
- ✓ Redirected to Google OAuth
- ✓ Callback to `/api/public/auth/callback`
- ✓ User created in `public.users` if new
- ✓ `user_settings` created
- ✓ Redirected to `/dashboard`

**Verify OAuth User:**
```sql
SELECT * FROM users WHERE email = '<google-email>';
-- Should have: first_name, last_name from Google profile
-- user_type = NULL (not set during OAuth)
```

### Test 3.6: Admin/Creator Login Redirect

**Steps:**
1. Log in with admin account
2. Check redirect

**Expected Results:**
- ✓ Admin → `/admin/dashboard`
- ✓ Creator → `/admin/dashboard`
- ✓ Reviewer → `/admin/dashboard`
- ✓ Regular user → `/dashboard`

---

## Phase 4: Password Reset Flow

### Test 4.1: Request Password Reset

**Steps:**
1. Navigate to `/forgot-password`
2. Enter email: `new-user-test@example.com`
3. Complete CAPTCHA
4. Submit

**Expected Results:**
- ✓ Redirected to `/check-email`
- ✓ Generic message (doesn't reveal if email exists)
- ✓ Password reset email sent
- ✓ `audit_logs` entry created

**Verify:**
```sql
SELECT * FROM audit_logs
WHERE action = 'password_reset_requested'
ORDER BY created_at DESC
LIMIT 1;
-- Should show recent entry with IP address
```

### Test 4.2: Password Reset with Non-Existent Email

**Steps:**
1. Enter fake email: `doesnotexist@example.com`
2. Submit

**Expected Results:**
- ✓ Same generic message (no email existence leak)
- ✓ No email actually sent (backend check)
- ✓ Same redirect to `/check-email`

### Test 4.3: Complete Password Reset

**Steps:**
1. Open password reset email
2. Click reset link
   Format: `/reset-password?code=...`
3. Enter new password: `NewPass456`
4. Confirm password
5. Submit

**Expected Results:**
- ✓ Server validates session exists
- ✓ Password updated successfully
- ✓ Redirected to `/password-reset-success`
- ✓ `audit_logs` entry: `'password_updated'`
- ✓ Old password no longer works
- ✓ New password works for login

**Test:**
1. Log out
2. Try old password → should fail
3. Try new password → should succeed

### Test 4.4: Expired Reset Link

**Steps:**
1. Use reset link from >1 hour ago

**Expected Results:**
- ✓ Redirected to `/forgot-password`
- ✓ Error: "Reset link has expired"
- ✓ Option to request new link

### Test 4.5: Reuse Same Password

**Steps:**
1. Request password reset
2. Try to set same password as current

**Expected Results:**
- ✓ Error: "New password must be different"
- ✓ User-friendly message shown

### Test 4.6: Rate Limit Password Reset Requests

**Steps:**
1. Request reset 3 times in quick succession
2. Try 4th time

**Expected Results:**
- ✓ 4th request blocked
- ✓ Error: "Too many password reset attempts"
- ✓ Block duration: 1 hour

---

## Phase 5: Session Management

### Test 5.1: Session Persistence

**Steps:**
1. Log in successfully
2. Close browser tab
3. Reopen site

**Expected Results:**
- ✓ Still logged in
- ✓ Session restored from cookie
- ✓ No re-login required

### Test 5.2: Session Expiry (24-Hour Max)

**Steps:**
1. Log in
2. Manually set session timestamp to 25 hours ago:
   ```javascript
   // DevTools → Console
   localStorage.setItem('session_timestamp', Date.now() - (25 * 60 * 60 * 1000))
   ```
3. Refresh page

**Expected Results:**
- ✓ Session invalidated
- ✓ Redirected to `/login`
- ✓ Message: "Session expired. Please log in again."

### Test 5.3: Session Refresh Before Expiry

**Steps:**
1. Log in
2. Set access_token expiry to 3 minutes from now
3. Wait and observe

**Expected Results:**
- ✓ Session refreshed automatically at 5-min threshold
- ✓ No logout occurs
- ✓ New access_token issued
- ✓ Refresh handled transparently

### Test 5.4: Browser Fingerprint Change Detection

**Steps:**
1. Log in on Chrome
2. DevTools → Console:
   ```javascript
   // Simulate fingerprint change
   localStorage.setItem('session_fingerprint', JSON.stringify({
     browser: 'Firefox',  // Changed from Chrome
     platform: 'Windows', // Same
     timezone: 'America/New_York' // Same
   }))
   ```
3. Trigger session validation (refresh page)

**Expected Results:**
- ✓ High-risk change detected
- ✓ Security event logged
- ✓ Possible logout (depending on risk threshold)
- ✓ User notified of suspicious activity

### Test 5.5: Concurrent Sessions

**Steps:**
1. Log in on Chrome
2. Log in on Firefox with same account
3. Perform actions in both browsers

**Expected Results:**
- ✓ Both sessions work simultaneously
- ✓ No conflict between sessions
- ✓ Actions in one browser don't affect other

### Test 5.6: Logout

**Steps:**
1. Log in
2. Click logout button
3. Check session state

**Expected Results:**
- ✓ Session cleared from cookies
- ✓ Redirected to `/login` or home page
- ✓ localStorage cleared
- ✓ Attempting to access `/dashboard` → redirect to `/login`

---

## Phase 6: Protected Route Access

### Test 6.1: Unauthenticated Access to Dashboard

**Steps:**
1. Log out completely
2. Navigate to `/dashboard`

**Expected Results:**
- ✓ Redirected to `/login?redirect=/dashboard`
- ✓ After login, redirected back to `/dashboard`

### Test 6.2: Regular User Access to Admin Routes

**Steps:**
1. Log in as regular user
2. Navigate to `/admin/dashboard`

**Expected Results:**
- ✓ Middleware blocks access
- ✓ Redirected to `/dashboard`
- ✓ Or show 403 Forbidden error

### Test 6.3: Admin Access to Admin Routes

**Steps:**
1. Log in as admin
2. Navigate to `/admin/dashboard`

**Expected Results:**
- ✓ Access granted
- ✓ Admin dashboard loads
- ✓ All admin features visible

### Test 6.4: API Route Protection - User Endpoint

**Using Postman/curl:**
```bash
curl -X GET http://localhost:3000/api/user/settings \
  -H "Cookie: sb-<project>-auth-token=<token>"
```

**Expected Results:**
- ✓ Without auth cookie → 401 Unauthorized
- ✓ With auth cookie → 200 OK + data
- ✓ Headers include: `x-user-id`, `x-user-email`

### Test 6.5: API Route Protection - Admin Endpoint

```bash
curl -X GET http://localhost:3000/api/admin/users \
  -H "Cookie: sb-<project>-auth-token=<token>"
```

**Expected Results:**
- ✓ Regular user token → 403 Forbidden
- ✓ Admin token → 200 OK + data
- ✓ No token → 401 Unauthorized

### Test 6.6: Maintenance Mode

**Steps:**
1. Enable maintenance mode (check your config)
2. Try accessing `/dashboard` while logged in

**Expected Results:**
- ✓ Regular users → `/maintenance` page
- ✓ Admin users → Still access `/admin`
- ✓ Public pages still accessible

---

## Phase 7: Security Edge Cases

### Test 7.1: SQL Injection Attempts

**Steps:**
1. On login form, enter:
   - Email: `admin@example.com' OR '1'='1`
   - Password: `anything`

**Expected Results:**
- ✓ Login fails safely
- ✓ No database error exposed
- ✓ Generic "Invalid credentials" message

### Test 7.2: XSS Attempts

**Steps:**
1. Sign up with:
   - First Name: `<script>alert('XSS')</script>`
   - Email: `valid@email.com`
2. Log in and check dashboard

**Expected Results:**
- ✓ Script tag escaped/sanitized
- ✓ No alert popup
- ✓ Name displayed as plain text

### Test 7.3: CSRF Attack Simulation

**Steps:**
1. Create malicious HTML file:
   ```html
   <form action="http://localhost:3000/api/user/settings" method="POST">
     <input name="setting" value="malicious">
   </form>
   <script>document.forms[0].submit()</script>
   ```
2. Open while logged in

**Expected Results:**
- ✓ Request blocked (missing CSRF token)
- ✓ SameSite=Strict prevents cookie sending
- ✓ Settings not changed

### Test 7.4: Timing Attack on Email Existence

**Steps:**
1. Measure response time for:
   - Existing email: `test@example.com`
   - Non-existent email: `doesnotexist@example.com`
2. Compare response times

**Expected Results:**
- ✓ Response times should be similar (±50ms)
- ✓ No significant timing difference reveals existence
- ✓ Generic error messages

### Test 7.5: Session Fixation Attack

**Steps:**
1. Get a session token without logging in
2. Force victim to use that session ID
3. Log in with that session

**Expected Results:**
- ✓ Supabase generates new session on login
- ✓ Old session invalidated
- ✓ Session fixation prevented

### Test 7.6: Account Enumeration via Password Reset

**Steps:**
1. Request password reset for existing email
2. Request password reset for non-existent email
3. Compare responses

**Expected Results:**
- ✓ Both show same message: "If email exists..."
- ✓ Same response time
- ✓ Cannot determine if account exists

### Test 7.7: Soft-Deleted User Restoration

**Steps:**
1. Soft-delete a user (set `is_active = false`)
2. User attempts OAuth login

**Expected Results:**
- ✓ User restored (`is_active = true`)
- ✓ Can log in successfully
- ⚠️ VERIFY: Check if banned users should stay banned!

---

## Phase 8: Performance & Reliability

### Test 8.1: Concurrent Logins

**Steps:**
1. Open 5 browser tabs
2. Attempt to log in simultaneously

**Expected Results:**
- ✓ All logins handled correctly
- ✓ No race conditions
- ✓ No database conflicts

### Test 8.2: Network Interruption During Auth

**Steps:**
1. Start login process
2. Disable network mid-request
3. Re-enable network

**Expected Results:**
- ✓ Retry logic kicks in
- ✓ Exponential backoff implemented
- ✓ User sees loading state
- ✓ Eventually succeeds or shows error

### Test 8.3: Database Connection Loss

**Steps:**
1. Simulate Supabase outage
2. Attempt login

**Expected Results:**
- ✓ Graceful error handling
- ✓ User-friendly error message
- ✓ No application crash
- ✓ Retry suggested

---

## Testing Checklist

Use this checklist to track your progress:

```
□ Sign Up Flow
  □ Valid signup
  □ Duplicate email prevention
  □ Password validation
  □ CAPTCHA required
  □ Rate limiting (3/hour)

□ Email Verification
  □ First-time verification
  □ Expired link handling
  □ Already verified
  □ Resend email (rate limited)
  □ User + settings creation

□ Login Flow
  □ Email/password success
  □ Unverified email blocked
  □ Invalid credentials
  □ Rate limiting (10/15min)
  □ CSRF validation
  □ Google OAuth
  □ Role-based redirects

□ Password Reset
  □ Request reset
  □ Non-existent email (same response)
  □ Complete reset
  □ Expired link
  □ Same password prevention
  □ Rate limiting (3/hour)

□ Session Management
  □ Session persistence
  □ 24-hour expiry
  □ Auto-refresh (5min threshold)
  □ Fingerprint detection
  □ Concurrent sessions
  □ Logout

□ Protected Routes
  □ Unauthenticated → login redirect
  □ User → admin blocked
  □ Admin → admin allowed
  □ API user endpoints
  □ API admin endpoints
  □ Maintenance mode

□ Security Edge Cases
  □ SQL injection prevention
  □ XSS sanitization
  □ CSRF protection
  □ Timing attack mitigation
  □ Session fixation prevention
  □ Account enumeration prevention
  □ Soft-delete restoration

□ Performance
  □ Concurrent logins
  □ Network interruption
  □ Database outage handling
```

---

## Monitoring During Testing

### 1. Browser Console
Monitor for:
- Auth state changes
- Session validation
- Security events
- Error messages

### 2. Network Tab
Check:
- API request/response
- Status codes
- Response times
- Cookies set

### 3. Supabase Dashboard
Verify:
- Auth users created
- Email logs
- Error logs

### 4. Database
Query:
- `public.users` - User creation
- `user_settings` - Settings creation
- `audit_logs` - Auth events

### 5. Application Logs
Filter for auth-related logs:
```
[Auth], [Session], [CSRF], [Rate Limit]
```

---

## Automated Testing (Optional)

Create `/tests/auth-flow.test.ts`:

```typescript
import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test('complete signup and login flow', async ({ page }) => {
    // Signup
    await page.goto('/signup')
    await page.fill('[name="email"]', 'test@example.com')
    await page.fill('[name="password"]', 'TestPass123')
    await page.fill('[name="firstName"]', 'Test')
    await page.fill('[name="lastName"]', 'User')
    await page.click('button[type="submit"]')

    await expect(page).toHaveURL(/verify-email/)

    // Login
    await page.goto('/login')
    await page.fill('[name="email"]', 'test@example.com')
    await page.fill('[name="password"]', 'TestPass123')
    await page.click('button[type="submit"]')

    await expect(page).toHaveURL('/dashboard')
  })
})
```

---

**This comprehensive testing guide should catch 99% of authentication issues. Use it when you need to meticulously verify your auth system is working correctly.**
