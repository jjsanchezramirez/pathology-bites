# Tags Management Grid - Testing Checklist

**Page:** `/admin/labels`  
**Component:** `TagsManagementGrid`  
**Date:** October 13, 2025

---

## ✅ Features Implemented

### 1. **Grid View Layout**
- ✅ Compact grid/card-based layout (responsive)
- ✅ Grid columns: 1 (mobile) → 2 (sm) → 3 (md) → 4 (lg) → 5 (xl) → 6 (2xl)
- ✅ Each card shows tag name, question count, and action buttons
- ✅ Hover effects and visual feedback
- ✅ Selected state highlighting (border-primary bg-primary/5)

### 2. **Selection & Bulk Operations**
- ✅ Individual tag selection via checkbox
- ✅ "Select All" / "Deselect All" functionality
- ✅ Selection count display
- ✅ Bulk delete operation
- ✅ Merge operation (2+ tags required)
- ✅ Clear selection button
- ✅ Bulk action bar appears when tags are selected

### 3. **Individual Tag Actions**
- ✅ **Edit** - Opens dialog to edit tag name
- ✅ **Delete** - Deletes tag with confirmation dialog
- ✅ **View Questions** - Shows all questions using the tag
- ✅ Action buttons visible on hover
- ✅ Icon-based buttons (Eye, Edit, Trash2)

### 4. **Dialog Styling**
- ✅ All dialogs use `BlurredDialog` component
- ✅ Backdrop blur effect (backdrop-blur)
- ✅ Modal behavior (prevents background interaction)
- ✅ Consistent styling across all dialogs
- ✅ Proper footer buttons (Cancel/Confirm)

### 5. **Search & Filtering**
- ✅ Search by tag name
- ✅ Sort options:
  - Alphabetical (default)
  - Most Used
  - Newest
  - Oldest
  - Unused Only
- ✅ Refresh button with loading state
- ✅ Search results count display

### 6. **API Integration**
- ✅ GET `/api/admin/tags` - List tags with pagination
- ✅ POST `/api/admin/tags` - Create new tag
- ✅ PATCH `/api/admin/tags` - Update tag name
- ✅ DELETE `/api/admin/tags` - Delete tag
- ✅ POST `/api/admin/tags/merge` - Merge multiple tags
- ✅ GET `/api/admin/tags/[tagId]/questions` - Get questions by tag

### 7. **Loading States & Error Handling**
- ✅ Loading spinner during data fetch
- ✅ Loading state for create/edit/delete operations
- ✅ Success toasts for all operations
- ✅ Error toasts with descriptive messages
- ✅ Disabled buttons during operations

### 8. **Additional Features**
- ✅ Pagination (100 items per page)
- ✅ Empty state messages
- ✅ Question count badges
- ✅ Unused tags indicator
- ✅ Role-based access control (admin/creator/reviewer)

---

## 🧪 Testing Checklist

### Grid View Display
- [ ] Grid displays all tags correctly
- [ ] Grid is responsive on different screen sizes
- [ ] Tag cards show name, question count, and actions
- [ ] Hover effects work on tag cards
- [ ] Action buttons appear on hover
- [ ] Selected tags have visual highlighting

### Selection Functionality
- [ ] Individual tag selection works (checkbox)
- [ ] Select All selects all visible tags
- [ ] Deselect All clears all selections
- [ ] Selection count updates correctly
- [ ] Bulk action bar appears when tags selected
- [ ] Clear button removes all selections

### Bulk Delete
- [ ] Bulk delete button appears when tags selected
- [ ] Bulk delete button disabled when no tags selected
- [ ] Confirmation dialog appears with correct count
- [ ] Dialog has blurred background
- [ ] Delete operation removes all selected tags
- [ ] Success toast shows correct count
- [ ] Error handling works for failed deletes
- [ ] Tags list refreshes after deletion

### Merge Tags
- [ ] Merge button appears when 2+ tags selected
- [ ] Merge button disabled when <2 tags selected
- [ ] Merge dialog shows selected tags
- [ ] Target tag dropdown shows only selected tags
- [ ] Dialog has blurred background
- [ ] Merge operation combines tags correctly
- [ ] Questions reassigned to target tag
- [ ] Source tags deleted after merge
- [ ] Success toast shows merge count
- [ ] Tags list refreshes after merge

### Edit Tag
- [ ] Edit button opens edit dialog
- [ ] Dialog pre-fills with current tag name
- [ ] Dialog has blurred background
- [ ] Name field is required
- [ ] Update button disabled when name empty
- [ ] Update operation changes tag name
- [ ] Success toast appears
- [ ] Error handling for duplicate names
- [ ] Tags list refreshes after edit

### Delete Tag
- [ ] Delete button opens confirmation dialog
- [ ] Dialog shows tag name being deleted
- [ ] Dialog has blurred background
- [ ] Warning message about permanent deletion
- [ ] Delete operation removes tag
- [ ] Tag removed from all questions
- [ ] Success toast appears
- [ ] Tags list refreshes after deletion

### View Associated Questions
- [ ] View button opens questions dialog
- [ ] Dialog shows tag name in title
- [ ] Dialog has blurred background
- [ ] Loading state while fetching questions
- [ ] Questions list displays correctly
- [ ] Shows question title, stem, and category
- [ ] Empty state when no questions
- [ ] Question count matches tag badge

### Create Tag
- [ ] Create button opens create dialog
- [ ] Dialog has blurred background
- [ ] Name field is required
- [ ] Create button disabled when name empty
- [ ] Create operation adds new tag
- [ ] Success toast appears
- [ ] Error handling for duplicate names
- [ ] Tags list refreshes after creation
- [ ] Dialog closes after successful creation

### Search & Filter
- [ ] Search filters tags by name
- [ ] Search is case-insensitive
- [ ] Search results update in real-time
- [ ] Clear search shows all tags
- [ ] Sort by Alphabetical works
- [ ] Sort by Most Used works
- [ ] Sort by Newest works
- [ ] Sort by Oldest works
- [ ] Sort by Unused Only works
- [ ] Unused count badge shows correct number

### Loading States
- [ ] Loading spinner shows during initial load
- [ ] Refresh button shows spinner when loading
- [ ] Create button shows "Creating..." state
- [ ] Edit button shows "Updating..." state
- [ ] Delete button shows "Deleting..." state
- [ ] Bulk delete shows "Deleting..." state
- [ ] Merge button shows "Merging..." state
- [ ] Buttons disabled during operations

### Error Handling
- [ ] Network errors show error toast
- [ ] Duplicate tag name shows specific error
- [ ] Unauthorized access shows error
- [ ] Failed operations show error toast
- [ ] Error messages are descriptive
- [ ] Failed operations don't close dialogs
- [ ] Failed operations don't clear selections

### Pagination
- [ ] Pagination controls appear when >100 tags
- [ ] Previous button disabled on first page
- [ ] Next button disabled on last page
- [ ] Page number displays correctly
- [ ] Navigation between pages works
- [ ] Selection cleared when changing pages

### Empty States
- [ ] Empty state shows when no tags exist
- [ ] "Create your first tag" button appears
- [ ] Empty state shows for search with no results
- [ ] Empty state shows for unused filter with no results
- [ ] Empty state messages are descriptive

### Permissions
- [ ] Admin users can access page
- [ ] Creator users can access page
- [ ] Reviewer users can access page
- [ ] Regular users cannot access page
- [ ] Unauthorized users redirected

---

## 🔍 API Endpoint Testing

### GET `/api/admin/tags`
- [ ] Returns list of tags
- [ ] Includes question counts
- [ ] Pagination works correctly
- [ ] Search parameter filters results
- [ ] Returns 401 for unauthenticated users
- [ ] Returns 403 for unauthorized roles

### POST `/api/admin/tags`
- [ ] Creates new tag
- [ ] Returns created tag data
- [ ] Validates tag name required
- [ ] Prevents duplicate tag names (409)
- [ ] Returns 401 for unauthenticated users
- [ ] Returns 403 for unauthorized roles

### PATCH `/api/admin/tags`
- [ ] Updates tag name
- [ ] Returns updated tag data
- [ ] Validates tag ID and name required
- [ ] Prevents duplicate tag names (409)
- [ ] Returns 401 for unauthenticated users
- [ ] Returns 403 for unauthorized roles

### DELETE `/api/admin/tags`
- [ ] Deletes tag
- [ ] Removes tag from all questions
- [ ] Returns success response
- [ ] Validates tag ID required
- [ ] Returns 401 for unauthenticated users
- [ ] Returns 403 for unauthorized roles

### POST `/api/admin/tags/merge`
- [ ] Merges multiple tags into one
- [ ] Reassigns all questions to target tag
- [ ] Deletes source tags
- [ ] Returns merge count
- [ ] Validates source and target IDs
- [ ] Prevents target in source list
- [ ] Returns 401 for unauthenticated users
- [ ] Returns 403 for unauthorized roles

### GET `/api/admin/tags/[tagId]/questions`
- [ ] Returns questions for tag
- [ ] Includes question title, stem, category
- [ ] Returns empty array when no questions
- [ ] Returns 401 for unauthenticated users
- [ ] Returns 403 for unauthorized roles

---

## 🎨 UI/UX Verification

### Visual Design
- [ ] Grid layout is clean and organized
- [ ] Cards have consistent spacing
- [ ] Colors match theme (primary, destructive, etc.)
- [ ] Icons are appropriate and clear
- [ ] Typography is readable
- [ ] Hover states are smooth
- [ ] Selected state is obvious

### Dialogs
- [ ] All dialogs have blurred backgrounds
- [ ] Dialog widths are appropriate
- [ ] Dialog content is centered
- [ ] Footer buttons are aligned right
- [ ] Close button (X) works
- [ ] ESC key closes dialogs
- [ ] Click outside closes dialogs

### Responsiveness
- [ ] Grid adapts to screen size
- [ ] Mobile view (1 column) works
- [ ] Tablet view (2-3 columns) works
- [ ] Desktop view (4-6 columns) works
- [ ] Search bar responsive
- [ ] Bulk action bar responsive
- [ ] Dialogs responsive

### Accessibility
- [ ] Checkboxes are keyboard accessible
- [ ] Buttons are keyboard accessible
- [ ] Dialogs are keyboard accessible
- [ ] Focus states are visible
- [ ] Screen reader labels present
- [ ] Color contrast meets standards

---

## 📊 Performance

- [ ] Grid renders quickly with 100+ tags
- [ ] Search is responsive (no lag)
- [ ] Bulk operations complete in reasonable time
- [ ] No memory leaks on repeated operations
- [ ] Pagination prevents loading all tags at once

---

## ✅ Summary

**Total Features:** 8 major feature areas  
**Total Test Cases:** 150+ individual tests  
**Build Status:** ✅ PASSING  
**Lint Status:** ✅ PASSING  

**All requirements from the task have been implemented:**
1. ✅ Compact grid view (responsive)
2. ✅ Selection & bulk operations (delete, merge)
3. ✅ Individual tag actions (edit, delete, view questions)
4. ✅ Blurred dialog backgrounds
5. ✅ Complete API integration
6. ✅ Loading states and error handling
7. ✅ Role-based access control
8. ✅ Search and filtering

**Ready for testing at:** http://localhost:3000/admin/labels

