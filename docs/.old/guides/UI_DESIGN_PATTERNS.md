# UI Design Patterns Guide

This document outlines the established UI design patterns and preferences for the Pathology Bites application.

## Dialog Components

### Preferred Dialog Pattern

**Always use regular `Dialog` component instead of `AlertDialog`** to avoid jarring "flying" animations.

#### ❌ Avoid: AlertDialog (Flying Animation)
```typescript
// DON'T USE - Creates jarring slide animations
<AlertDialog open={open} onOpenChange={onOpenChange}>
  <AlertDialogContent>
    {/* Content */}
  </AlertDialogContent>
</AlertDialog>
```

**Problem**: AlertDialog uses slide animations that make dialogs appear to "fly" from the top-left corner:
- `slide-in-from-left-1/2` and `slide-in-from-top-[48%]` on open
- `slide-out-to-left-1/2` and `slide-out-to-top-[48%]` on close

#### ✅ Preferred: Dialog with Blurred Background
```typescript
// USE THIS - Smooth fade + zoom animations
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogPortal>
    <DialogOverlay className="backdrop-blur-md bg-black/20" />
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Dialog Title</DialogTitle>
        <DialogDescription>
          Dialog description text.
        </DialogDescription>
      </DialogHeader>
      
      {/* Dialog content */}
      
      <DialogFooter>
        <Button variant="outline" onClick={handleCancel}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={handleConfirm}>
          Confirm Action
        </Button>
      </DialogFooter>
    </DialogContent>
  </DialogPortal>
</Dialog>
```

### Dialog Design Standards

#### Blurred Backgrounds
- **All dialogs must have blurred backgrounds**: `backdrop-blur-md bg-black/20`
- **Consistent overlay styling** across all dialog types
- **Professional appearance** with clear visual separation

#### Dialog Sizing
- **Standard dialogs**: `max-w-md` (448px)
- **Form dialogs**: `max-w-[min(85vw,1200px)]` (responsive, max 1200px)
- **Large content dialogs**: `max-w-4xl` (896px)
- **Always include responsive considerations**

#### Fixed Height Dialogs
For complex forms with multiple tabs or sections, use fixed height to prevent resizing:

```typescript
// Fixed height dialog (75% of viewport height)
<DialogContent className="w-full max-w-[min(85vw,1200px)] h-[75vh] border-0 flex flex-col">
  <DialogHeader className="flex-shrink-0">
    <DialogTitle>Edit Question</DialogTitle>
  </DialogHeader>

  {/* Scrollable content area */}
  <div className="flex-1 overflow-y-auto min-h-0 py-4">
    {/* Tab content goes here */}
  </div>

  {/* Fixed footer */}
  <DialogFooter className="flex-shrink-0 border-t bg-background pt-6">
    <Button variant="outline" onClick={handleCancel}>Cancel</Button>
    <Button onClick={handleSave}>Save Changes</Button>
  </DialogFooter>
</DialogContent>
```

**Benefits:**
- **Consistent height** across different tabs/sections
- **Better UX** - no jarring resize when switching content
- **Proper scrolling** - only content scrolls, header/footer stay fixed

#### Animation Behavior
- **Smooth fade + zoom animations** (default Dialog behavior)
- **No slide animations** that create "flying" effects
- **Consistent timing** across all dialogs

### Button Styling in Dialogs

#### Destructive Actions
```typescript
<Button variant="destructive" onClick={handleDelete}>
  Delete Item
</Button>
```

#### Secondary Actions
```typescript
<Button variant="outline" onClick={handleCancel}>
  Cancel
</Button>
```

#### Primary Actions
```typescript
<Button onClick={handleSave}>
  Save Changes
</Button>
```

## Modal Behavior

### Non-Modal Dialogs
- **Always use `modal={false}`** to prevent screen freezing
- **Applies to all dialog types**: questions, forms, confirmations
- **Consistent user experience** without blocking interactions

```typescript
<Dialog open={open} onOpenChange={onOpenChange} modal={false}>
  {/* Dialog content */}
</Dialog>
```

## Implementation Examples

### Confirmation Dialog
```typescript
<Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
  <DialogPortal>
    <DialogOverlay className="backdrop-blur-md bg-black/20" />
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogDescription>
          Are you sure you want to delete this item? This action cannot be undone.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={handleDelete}>
          Delete
        </Button>
      </DialogFooter>
    </DialogContent>
  </DialogPortal>
</Dialog>
```

### Unsaved Changes Dialog
```typescript
<Dialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
  <DialogPortal>
    <DialogOverlay className="backdrop-blur-md bg-black/20" />
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Unsaved Changes</DialogTitle>
        <DialogDescription>
          You have unsaved changes. Are you sure you want to close this dialog? 
          All changes will be lost.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={handleKeepEditing}>
          Keep Editing
        </Button>
        <Button variant="destructive" onClick={handleDiscardChanges}>
          Discard Changes
        </Button>
      </DialogFooter>
    </DialogContent>
  </DialogPortal>
</Dialog>
```

## Tag Display Patterns

### Horizontal Tag Layout
Tags should always be displayed horizontally with proper spacing:

```typescript
// ✅ Correct: Horizontal tag display with full width
<div className="flex flex-wrap gap-2">
  {selectedTags.map((tag, index) => (
    <Badge key={tag.id || `tag-${index}`} variant="secondary" className="flex items-center gap-1">
      {tag.name}
      <button
        type="button"
        onClick={() => handleRemoveTag(tag.id)}
        className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  ))}
</div>
```

### Tag Section Layout in Forms
When placing tags in form layouts, give them full width outside of grid constraints:

```typescript
// ❌ Avoid: Tags constrained in grid columns
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
  <FormField name="difficulty">...</FormField>
  <FormField name="status">...</FormField>
  <TagsSelector /> {/* Constrained width */}
</div>

// ✅ Preferred: Tags with full width
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
  <FormField name="difficulty">...</FormField>
  <FormField name="status">...</FormField>
</div>

{/* Tags - Full Width */}
<TagsSelector selectedTagIds={selectedTagIds} onTagsChange={setSelectedTagIds} />
```

## Error Handling Patterns

### Database Constraint Violations
Handle specific database errors with user-friendly messages:

```typescript
catch (error) {
  let errorMessage = 'Operation failed';
  if (error instanceof Error) {
    if (error.message.includes('question_versions_question_id_version_number_key')) {
      errorMessage = 'Update conflict detected. Please try again in a moment.';
    } else {
      errorMessage = error.message;
    }
  }
  toast.error(errorMessage);
}
```

### Retry Logic for Race Conditions
Implement retry logic for transient database conflicts:

```typescript
// Handle version constraint violations with retry
if (error.message.includes('question_versions_question_id_version_number_key')) {
  console.warn('Version constraint violation detected, retrying update...');
  await new Promise(resolve => setTimeout(resolve, 100));

  const { error: retryError } = await supabase
    .from('questions')
    .update(data)
    .eq('id', questionId);

  if (retryError) {
    throw new Error(retryError.message);
  }
}
```

## Key Principles

1. **Consistency**: All dialogs follow the same pattern
2. **Smooth animations**: No jarring slide effects
3. **Professional appearance**: Blurred backgrounds throughout
4. **User-friendly**: Non-modal behavior prevents blocking
5. **Accessible**: Clear visual hierarchy and button styling
6. **Horizontal layouts**: Tags and similar elements display horizontally
7. **Graceful error handling**: Specific messages for different error types

## Sidebar Components

### Auth Status Component

The sidebar auth status component should integrate seamlessly with navigation items for consistent behavior.

#### ✅ Preferred: Structural Integration
```typescript
// Integrate auth status directly into navigation structure
<div className="space-y-1 px-3 flex flex-col h-full">
  <div className="flex-1 space-y-1">
    {/* Navigation items */}
  </div>

  {/* Auth Status as Navigation Item */}
  <SidebarAuthStatus isCollapsed={isCollapsed} />
</div>
```

**Key Requirements:**
1. **Fixed height consistency**: Both collapsed (`h-14`) and expanded states use same height
2. **Perfect text alignment**: Text starts exactly where navigation text starts (no extra margins)
3. **Icon positioning**: Icons stay centered vertically regardless of text content
4. **Structural integration**: Component is part of `space-y-1` navigation context

#### Auth Status Dialog Content
Display essential user information in logical order:
1. **Name**: Display name from user profile
2. **Email**: User's email address
3. **Role**: Properly capitalized role (Admin, Creator, Reviewer, User)
4. **User ID**: Full UUID in monospace font for easy copying

```typescript
// Clean dialog content structure
<div className="px-2 py-1.5 text-sm space-y-1">
  <div><strong>Name:</strong> {getDisplayName()}</div>
  <div><strong>Email:</strong> {user.email}</div>
  <div><strong>Role:</strong> {capitalizedRole}</div>
  <div><strong>User ID:</strong> <span className="font-mono text-xs">{user.id}</span></div>
</div>
```

## Migration Notes

When updating existing dialogs:
1. Replace `AlertDialog` imports with `Dialog` imports
2. Add `DialogPortal` and `DialogOverlay` with blur styling
3. Update button components to use proper variants
4. Test animations to ensure smooth behavior
5. Verify consistent styling across all dialogs

When updating sidebar components:
1. Ensure consistent height across all states
2. Integrate components into navigation structure rather than separate containers
3. Match text alignment with existing navigation items
4. Use proper role capitalization and essential user information only
