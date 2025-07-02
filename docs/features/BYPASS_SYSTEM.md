# 🔓 Coming Soon Mode Bypass System

## Overview

The bypass system allows authorized users to access all features of the application even when `NEXT_PUBLIC_COMING_SOON_MODE=true` is enabled.

## Coming Soon Mode Features

When Coming Soon mode is enabled:
- **Public pages are accessible**: FAQ, Terms, Privacy, About, Contact pages can be accessed without bypass
- **Auth pages modified**: Login shows "Admin Login", Sign up buttons are hidden
- **Sign up blocked**: All signup-related pages redirect to login unless bypass is enabled
- **Navigation added**: Coming Soon page includes links to all public pages
- **Discord link updated**: All Discord links use the public invite: https://discord.gg/PNFvwVbW

## How It Works

### Environment Variable
- `NEXT_PUBLIC_COMING_SOON_MODE=true` - Enables coming soon mode
- When enabled, regular users see the coming soon page
- With bypass enabled, users can access all features normally

### Bypass Methods

#### 1. URL Parameter Method
Add `?bypass=true` to any URL:
```
http://localhost:3000/?bypass=true
http://localhost:3000/demo-comparison?bypass=true
http://localhost:3000/bypass?bypass=true
http://localhost:3000/about?bypass=true
```

#### 2. Bypass Control Panel
Visit the bypass management page:
```
http://localhost:3000/bypass
```

#### 3. Persistent Bypass
- Enable bypass through the control panel
- Setting is saved in browser's localStorage
- Persists across browser sessions
- Only affects the current browser

## Access URLs

### Always Available (No Bypass Needed)
- `/bypass` - Bypass control panel
- `/login` - Authentication pages (shows "Admin Login" in Coming Soon mode)
- `/forgot-password` - Password reset pages
- `/auth-error` - Authentication error pages
- `/api/*` - API endpoints

### Public Routes (Available in Coming Soon Mode)
- `/about` - About page
- `/contact` - Contact page
- `/faq` - FAQ page
- `/privacy` - Privacy policy
- `/terms` - Terms of service

### Blocked in Coming Soon Mode (Require Bypass)
- `/` - Main landing page (shows Coming Soon page instead)
- `/signup` - Registration pages (redirects to login)
- `/verify-email` - Email verification pages
- `/demo-comparison` - Component comparison page

### Protected Routes (Require Authentication)
- `/admin/*` - Admin dashboard and features
- `/dashboard` - User dashboard
- `/quiz/*` - Quiz functionality
- `/profile/*` - User profile pages
- `/settings/*` - User settings pages

### Error Handling
- **404 Pages**: Unknown routes properly display the custom 404 page instead of redirecting to login
- **Middleware Logic**: Only specific protected routes require authentication; all other routes pass through normally

## Usage Examples

### For Development
```bash
# Enable coming soon mode
NEXT_PUBLIC_COMING_SOON_MODE=true

# Access bypass control panel
http://localhost:3000/bypass

# Enable persistent bypass
# Then access any feature normally
```

### For Testing
```bash
# Quick bypass for single session
http://localhost:3000/?bypass=true

# Compare demo components
http://localhost:3000/demo-comparison?bypass=true
```

### For Production
```bash
# Share bypass link with stakeholders
https://yoursite.com/?bypass=true

# Or give them the bypass control panel URL
https://yoursite.com/bypass
```

## Security Notes

### Client-Side Only
- Bypass is implemented client-side only
- Does not affect server-side security
- Protected routes still require authentication
- Admin routes still require admin role

### Browser-Specific
- Bypass setting is stored in localStorage
- Only affects the specific browser/device
- Other users still see coming soon page
- No server-side bypass tracking

### No Security Risk
- Does not bypass authentication
- Does not bypass authorization
- Only bypasses the coming soon display
- All other security measures remain active

## Implementation Details

### Files Modified
- `src/app/(public)/page.tsx` - Main bypass logic
- `src/app/(public)/bypass/page.tsx` - Control panel

### Code Structure
```tsx
// Check for bypass
const urlParams = new URLSearchParams(window.location.search)
const bypassParam = urlParams.get('bypass')
const storedBypass = localStorage.getItem('pathology-bites-bypass')

if (bypassParam === 'true' || storedBypass === 'true') {
  setBypassEnabled(true)
  localStorage.setItem('pathology-bites-bypass', 'true')
}

// Apply bypass
if (isComingSoonMode && !bypassEnabled) {
  return <ComingSoonPage />
}
```

## Troubleshooting

### Bypass Not Working
1. Check if coming soon mode is actually enabled
2. Clear browser localStorage and try again
3. Try the URL parameter method: `?bypass=true`
4. Visit `/bypass` directly to manage settings

### Can't Access Bypass Page
- The `/bypass` route is always accessible
- Try clearing browser cache
- Check for JavaScript errors in console

### Bypass Resets
- localStorage can be cleared by browser settings
- Re-enable bypass through control panel
- Use URL parameter as backup method

## Best Practices

### For Developers
- Use persistent bypass during development
- Test both bypass and non-bypass modes
- Document bypass URLs for team members

### For Stakeholders
- Provide bypass control panel URL
- Explain how to enable/disable bypass
- Share quick bypass URLs for demos

### For Production
- Only share bypass with authorized users
- Monitor bypass usage if needed
- Consider time-limited bypass tokens for enhanced security

## Future Enhancements

### Possible Improvements
- Server-side bypass tokens
- Time-limited bypass access
- User-specific bypass permissions
- Bypass usage analytics
- Admin-controlled bypass management

### Current Limitations
- Client-side only implementation
- No centralized bypass management
- No bypass usage tracking
- No automatic bypass expiration
