# Development Setup Guide

## Quick Start

### Recommended: Use Turbopack (Default)
```bash
npm run dev
```

This now uses Turbopack by default for faster HMR and better stability.

### Alternative: Use Webpack
```bash
npm run dev:webpack
```

Use this if you encounter Turbopack-specific issues.

### Clean Start (When HMR Breaks)
```bash
npm run dev:clean
```

This removes the `.next` cache and starts fresh with Turbopack.

---

## Browser Configuration

### Chrome/Edge (Recommended for Development)

1. **Open DevTools** (F12 or Cmd+Option+I)
2. **Go to Network tab**
3. **Check "Disable cache"** (only works while DevTools is open)
4. **Optional**: Right-click refresh button → "Empty Cache and Hard Reload"

### Firefox

1. **Open DevTools** (F12)
2. **Go to Settings** (gear icon in DevTools)
3. **Check "Disable HTTP Cache (when toolbox is open)"**

### Safari

1. **Enable Develop menu**: Safari → Preferences → Advanced → "Show Develop menu"
2. **Develop → Disable Caches**

---

## When to Clean `.next/` Cache

You should run `npm run clean` or `npm run dev:clean` when:

- ✅ You get `ENOENT` errors for vendor chunks (`@supabase`, `next`, etc.)
- ✅ After updating dependencies (`npm install`)
- ✅ After switching Git branches with significant changes
- ✅ When HMR stops working (changes don't reflect)
- ✅ After pulling major changes from remote
- ✅ When you see webpack/turbopack compilation errors that don't make sense

---

## Troubleshooting HMR Issues

### Issue: Changes not reflecting in browser

**Solution 1**: Hard refresh
- Chrome/Edge: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
- Firefox: `Cmd+Shift+R` (Mac) or `Ctrl+F5` (Windows)
- Safari: `Cmd+Option+R`

**Solution 2**: Clear browser cache
- Open DevTools → Application → Clear storage → Clear site data

**Solution 3**: Restart dev server with clean cache
```bash
# Stop server (Ctrl+C)
npm run dev:clean
```

### Issue: `ENOENT: no such file or directory` errors

**Cause**: Next.js cache corruption

**Solution**:
```bash
# Stop server (Ctrl+C)
npm run clean
npm run dev
```

### Issue: Server crashes frequently

**Possible causes**:
1. Memory issues (too many pages cached)
2. File watcher limits exceeded
3. Conflicting processes

**Solutions**:

1. **Increase file watcher limit** (Mac/Linux):
```bash
# Add to ~/.zshrc or ~/.bashrc
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

2. **Check for port conflicts**:
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

3. **Reduce memory usage**: Close other applications, especially browsers with many tabs

### Issue: Turbopack errors

**Solution**: Fall back to Webpack temporarily
```bash
npm run dev:webpack
```

Then report the issue to the team.

---

## Performance Tips

### 1. Use Turbopack (Default)
- Faster cold starts
- Better HMR performance
- Lower memory usage

### 2. Keep DevTools Open
- Enables "Disable cache" option
- Helps with debugging
- Shows network requests and console errors

### 3. Limit Open Pages
- Close unused browser tabs
- Only keep necessary pages open
- Reduces memory usage

### 4. Use Incremental Changes
- Make small, focused changes
- Test frequently
- Easier to debug when issues occur

### 5. Monitor Memory Usage
```bash
# Check Node.js memory usage
node --max-old-space-size=4096 node_modules/.bin/next dev --turbo
```

---

## Development Workflow

### Recommended Workflow

1. **Start dev server**:
   ```bash
   npm run dev
   ```

2. **Open browser with DevTools**:
   - Chrome: `http://localhost:3000`
   - Enable "Disable cache" in Network tab

3. **Make changes**:
   - Edit files in your IDE
   - Save changes
   - Wait for "compiled successfully" message
   - Browser should auto-refresh

4. **If changes don't reflect**:
   - Hard refresh: `Cmd+Shift+R`
   - Check terminal for compilation errors
   - Check browser console for errors

5. **If HMR breaks**:
   ```bash
   # Stop server (Ctrl+C)
   npm run dev:clean
   ```

6. **Before committing**:
   ```bash
   npm run lint
   npm run build
   ```

---

## Configuration Summary

### What We've Optimized

1. **Turbopack by default** (`npm run dev`)
   - Faster HMR
   - Better stability
   - Lower memory usage

2. **Webpack optimizations** (fallback mode)
   - File watching with polling
   - Reduced memory usage
   - Better chunk splitting

3. **Browser cache disabled** (development only)
   - No stale data
   - Always fresh content
   - Easier debugging

4. **Extended keep-alive times**
   - Pages stay in memory longer
   - Fewer recompilations
   - Faster navigation

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server with Turbopack (default) |
| `npm run dev:webpack` | Start dev server with Webpack |
| `npm run dev:clean` | Clean cache and start fresh |
| `npm run clean` | Remove `.next` cache only |
| `npm run build` | Production build |
| `npm run lint` | Check for linting errors |

---

## Need Help?

If you're still experiencing issues after trying these solutions:

1. Check the terminal output for specific error messages
2. Check the browser console for client-side errors
3. Try `npm run dev:clean` to start completely fresh
4. Check if the issue persists in a different browser
5. Report the issue with:
   - Error message
   - Steps to reproduce
   - Browser and OS version
   - Node.js version (`node --version`)

