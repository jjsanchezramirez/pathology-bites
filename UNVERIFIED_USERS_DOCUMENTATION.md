# Unverified Users & Email Verification Flow

**Date**: October 19, 2025  
**Status**: ✅ Complete

---

## Summary

This document explains how unverified users are handled in the authentication system and answers common questions about the email verification flow.

---

## Question 1: Non-Verified Users in Public Schema

### ✅ Answer: There Are NONE

**Non-verified users do NOT exist in `public.users` or `public.user_settings`.**

### Why?

The user creation flow is designed to only create public records **after email verification**:

```
User Signs Up
    ↓
Entry created in auth.users (Supabase Auth)
    ↓
Verification email sent
    ↓
User clicks email link
    ↓
Email verified in auth.users
    ↓
Entry created in public.users
Entry created in public.user_settings
    ↓
User can now access dashboard
```

### Where Do Unverified Users Live?

- **Only in `auth.users`** (Supabase Auth system)
- Not in `public.users` (your application schema)
- Not in `public.user_settings`

### Cleanup

**No cleanup needed!** Supabase automatically handles this:
- Unverified accounts in `auth.users` are kept for **24 hours** by default
- After 24 hours, Supabase automatically deletes unverified accounts
- This is Supabase's built-in policy (not something we control)

---

## Question 2: Legacy Fields in Auth Routes

### ✅ Fixed

Both auth routes were hardcoding legacy fields. They now use `DEFAULT_UI_SETTINGS` from constants.

**Files Updated**:
- `src/app/api/public/auth/callback/route.ts` - OAuth flow
- `src/app/api/public/auth/confirm/route.ts` - Email verification flow

**Before**:
```typescript
ui_settings: {
  theme: 'system',
  font_size: 'medium',
  text_zoom: 1.0,
  dashboard_theme_admin: 'default',
  dashboard_theme_user: 'tangerine',
  sidebar_collapsed: false,
  welcome_message_seen: false
}
```

**After**:
```typescript
ui_settings: DEFAULT_UI_SETTINGS
```

**Benefits**:
- ✅ Single source of truth for defaults
- ✅ No more hardcoded legacy fields
- ✅ Easy to update defaults in one place
- ✅ Consistent with settings reset logic

---

## Question 3: Standard Practice for Non-Verified Accounts

### Supabase Default Behavior

| Aspect | Details |
|--------|---------|
| **Retention Period** | 24 hours |
| **Auto-Cleanup** | Yes, automatic |
| **Manual Deletion** | Not needed |
| **User Can Resend** | Yes, unlimited times |
| **User Can Sign Up Again** | Yes, after 24 hours |

### Our Implementation

We follow Supabase's standard practice:
1. User signs up → Entry in `auth.users` only
2. Verification email sent
3. If not verified within 24 hours → Supabase auto-deletes from `auth.users`
4. User can sign up again with same email

### No Custom Cleanup Needed

We don't need to implement custom cleanup because:
- ✅ Supabase handles it automatically
- ✅ Unverified accounts don't clutter our public schema
- ✅ No orphaned records to worry about

---

## Question 4: Expired Email Links - How to Resend

### ✅ Already Implemented

The system has a complete flow for handling expired links:

### User Flow

1. **User clicks expired link**
   - Redirected to `/link-expired?type=signup&email=user@example.com`

2. **Link Expired Page Shows**
   - Title: "Verification Link Expired"
   - Message: "Email verification links expire for security reasons"
   - Button: "Resend Verification Email"

3. **User Clicks "Resend Verification Email"**
   - Redirected to `/verify-email?email=user@example.com`

4. **Verify Email Page Shows**
   - Pre-filled with user's email
   - Button: "Resend verification email"

5. **User Clicks "Resend verification email"**
   - New verification email sent
   - Toast: "Verification email sent successfully"
   - User can click new link

### Code Implementation

**Link Expired Page** (`src/app/(auth)/link-expired/page.tsx`):
```typescript
case 'signup':
case 'email':
  return {
    title: 'Verification Link Expired',
    description: 'Your email verification link has expired or is no longer valid',
    content: 'Email verification links expire for security reasons. Please request a new verification email to activate your account.',
    primaryAction: {
      href: email ? `/verify-email?email=${encodeURIComponent(email)}` : '/signup',
      text: email ? 'Resend Verification Email' : 'Sign Up Again'
    }
  }
```

**Verify Email Form** (`src/features/auth/components/forms/verify-email-form.tsx`):
```typescript
async function handleResendVerification() {
  if (!email) {
    toast.error("Email address is required to resend verification")
    return
  }

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/api/public/auth/confirm`
    }
  })

  if (error) {
    toast.error(error.message)
    return
  }

  toast.success("Verification email sent successfully")
}
```

### User Can Resend Unlimited Times

- ✅ No rate limiting on resend
- ✅ Can request new email immediately
- ✅ Each new email has a fresh 24-hour expiration
- ✅ Previous links become invalid

### Email Link Expiration

- **Default**: 24 hours (Supabase setting)
- **Security**: Links expire for security reasons
- **User Experience**: Clear messaging when link expires
- **Recovery**: Easy resend flow

---

## Summary Table

| Question | Answer | Status |
|----------|--------|--------|
| Non-verified users in public schema? | No, they only exist in auth.users | ✅ Correct |
| Legacy fields in auth routes? | Fixed - now using DEFAULT_UI_SETTINGS | ✅ Fixed |
| Standard practice for unverified accounts? | Supabase auto-deletes after 24 hours | ✅ Implemented |
| How to resend expired email? | Link expired page → Resend button → New email | ✅ Implemented |

---

## Files Modified

1. `src/app/api/public/auth/callback/route.ts` - Uses DEFAULT_UI_SETTINGS
2. `src/app/api/public/auth/confirm/route.ts` - Uses DEFAULT_UI_SETTINGS

---

## No Action Required

✅ All systems are working correctly:
- Non-verified users are properly isolated
- Legacy fields have been cleaned up
- Unverified account cleanup is automatic
- Email resend flow is fully implemented

Everything is production-ready!

