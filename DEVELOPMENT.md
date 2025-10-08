# Development Guide

## Cache Management

This project has aggressive caching optimizations for production performance, which can make development frustrating. Here's how to handle it:

### Automatic Cache Disabling (Recommended)

The app now automatically disables caching in development mode (`NODE_ENV=development`). This includes:

- **Next.js headers**: All pages and API routes get `no-cache` headers
- **Static assets**: Reduced caching (1 hour vs 1 year in production)
- **ETags**: Disabled in development

### Manual Cache Clearing

If you still experience caching issues:

#### Chrome/Edge
1. **Hard Refresh**: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
2. **Dev Tools**: Open DevTools → Network tab → check "Disable cache"
3. **Clear Storage**: DevTools → Application tab → Storage → Clear site data

#### Firefox
1. **Hard Refresh**: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
2. **Dev Tools**: Network tab → Settings gear → "Disable HTTP Cache"

#### Safari
1. **Hard Refresh**: `Cmd+Option+R`
2. **Develop Menu**: Develop → Empty Caches

### Private/Incognito Mode

If you need a completely clean slate:
- **Chrome**: `Cmd+Shift+N` (Mac) or `Ctrl+Shift+N` (Windows)
- **Firefox**: `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows)
- **Safari**: `Cmd+Shift+N`

### Development Tips

1. **Use DevTools**: Keep Network tab open with cache disabled during development
2. **Hard Refresh**: Get in the habit of using hard refresh instead of normal refresh
3. **Browser Extensions**: Consider "Clear Cache" extensions for one-click clearing
4. **Multiple Browsers**: Test in different browsers to verify it's not browser-specific

### Reverting Cache Changes

If you need to test production caching behavior locally:

1. Set `NODE_ENV=production` in your environment
2. Or temporarily modify `next.config.ts` to force production cache headers

## Admin Mode Toggle

The new admin mode toggle uses cookies to persist preferences. If you're testing this feature:

1. The toggle appears next to the hamburger menu for admin users
2. Cookie name: `admin-mode` with values `admin` or `user`
3. Cookie expires in 30 days
4. Clear cookies to reset to default behavior

## Middleware Behavior

The middleware respects the admin mode cookie:
- `admin-mode=user`: Admin users can access user dashboard
- `admin-mode=admin` (default): Admin users redirect to admin dashboard
- Regular users: Always go to user dashboard regardless of cookie