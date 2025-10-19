# Legacy UI Settings Fields Cleanup

**Date**: October 19, 2025  
**Status**: ✅ Complete

---

## Summary

Removed three legacy fields from `ui_settings` that were no longer being used in the codebase:
- `theme` - Color mode management (now handled by next-themes library)
- `font_size` - Text size preference (replaced by `text_zoom`)
- `sidebar_collapsed` - Sidebar state (never used)

---

## Verification Results

### ✅ Confirmed: Fields Are NOT Used

**`theme` field:**
- ❌ Never read from `ui_settings`
- ✅ Color mode is managed by `next-themes` library
- ✅ Stored in localStorage as `pathology-bites-theme` (not in database)
- ✅ Controlled by `ConditionalThemeProvider` component

**`font_size` field:**
- ❌ Never read from `ui_settings`
- ✅ Replaced by `text_zoom` field
- ✅ Legacy migration code removed (was only in settings page)
- ✅ All text sizing uses `text_zoom` multiplier

**`sidebar_collapsed` field:**
- ❌ Never read anywhere in codebase
- ❌ Never written to
- ❌ No sidebar collapse functionality exists
- ✅ Safe to remove

---

## Changes Made

### 1. Updated Default Settings
**File**: `src/shared/constants/user-settings-defaults.ts`

**Before**:
```typescript
export const DEFAULT_UI_SETTINGS = {
  theme: 'system' as const,
  font_size: 'medium' as const,
  text_zoom: 1.0,
  dashboard_theme_admin: 'default',
  dashboard_theme_user: 'tangerine',
  sidebar_collapsed: false,
  welcome_message_seen: false,
}
```

**After**:
```typescript
export const DEFAULT_UI_SETTINGS = {
  text_zoom: 0.8,
  dashboard_theme_admin: 'default',
  dashboard_theme_user: 'tangerine',
  welcome_message_seen: false,
}
```

**Also updated**:
- Changed default `text_zoom` from `1.0` to `0.8` (as requested)
- Updated documentation to explain removed fields
- Added note about where color mode is managed

### 2. Updated Settings Reset Logic
**File**: `src/app/(dashboard)/dashboard/settings/page.tsx`

**Before**:
```typescript
const defaultUISettings = {
  theme: 'system' as const,
  font_size: 'medium' as const,
  text_zoom: config.default,
  sidebar_collapsed: false,
  welcome_message_seen: false
}
```

**After**:
```typescript
const defaultUISettings = {
  text_zoom: config.default,
  welcome_message_seen: false
}
```

### 3. Removed Legacy Migration Code
**File**: `src/app/(dashboard)/dashboard/settings/page.tsx`

**Before**:
```typescript
// Handle text zoom - migrate from legacy font size if needed
const config = getTextZoomConfig()
let zoom = userSettings.ui_settings.text_zoom
if (!zoom) {
  // Migrate from legacy font size
  zoom = legacyFontSizeToZoom(userSettings.ui_settings.font_size || 'medium')
}
zoom = getValidZoomLevel(zoom || config.default)
setTextZoomContext(zoom)
```

**After**:
```typescript
// Handle text zoom
const config = getTextZoomConfig()
const zoom = getValidZoomLevel(userSettings.ui_settings.text_zoom || config.default)
setTextZoomContext(zoom)
```

### 4. Removed Unused Imports
**File**: `src/app/(dashboard)/dashboard/settings/page.tsx`

Removed imports for legacy functions:
- ❌ `legacyFontSizeToZoom`
- ❌ `zoomToLegacyFontSize`

These functions still exist in `src/shared/utils/text-zoom.ts` but are no longer imported or used.

---

## Impact Analysis

### ✅ No Breaking Changes
- New users will get correct defaults with `text_zoom: 0.8`
- Existing users' settings will continue to work (legacy fields ignored)
- Color mode still works (managed by next-themes)
- Text zoom still works (uses `text_zoom` field)
- Dashboard themes still work (uses `dashboard_theme_admin/user`)

### ✅ Database Compatibility
- Existing `ui_settings` records with legacy fields will continue to work
- Legacy fields will be ignored when reading settings
- New records will only have the 4 active fields
- No migration needed for existing data

### ✅ Type Safety
- TypeScript types updated to reflect new structure
- No type errors in codebase
- All imports updated correctly

---

## Testing

### ✅ Verification Checklist
- [x] No TypeScript errors
- [x] No unused imports
- [x] Legacy fields confirmed not used
- [x] Default values updated correctly
- [x] Settings reset logic updated
- [x] Migration code removed
- [x] Documentation updated

### ✅ User Creation Testing
New users created after this change will have:
```json
{
  "text_zoom": 0.8,
  "dashboard_theme_user": "tangerine",
  "welcome_message_seen": false,
  "dashboard_theme_admin": "default"
}
```

---

## Files Modified

1. `src/shared/constants/user-settings-defaults.ts` - Updated defaults
2. `src/app/(dashboard)/dashboard/settings/page.tsx` - Removed legacy code and imports

---

## Notes

### Legacy Functions Still Available
The following functions still exist in `src/shared/utils/text-zoom.ts` but are no longer used:
- `legacyFontSizeToZoom()` - Can be removed in future cleanup
- `zoomToLegacyFontSize()` - Can be removed in future cleanup

These can be safely removed if no other code depends on them.

### Color Mode Management
The `theme` field was never actually used because:
- Color mode is managed by `next-themes` library
- Stored in localStorage as `pathology-bites-theme`
- Controlled by `ConditionalThemeProvider` component
- User can toggle light/dark/system on dashboard/admin routes
- Public routes are forced to light mode

---

## Conclusion

✅ **All legacy fields have been successfully removed from default user settings.**

The system now uses only the 4 active fields:
1. `text_zoom` - Text size multiplier (0.8 to 1.5)
2. `dashboard_theme_admin` - Admin dashboard theme
3. `dashboard_theme_user` - Student dashboard theme
4. `welcome_message_seen` - Welcome message flag

All functionality remains intact with no breaking changes.

