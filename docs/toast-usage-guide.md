# Toast Notification Usage Guide

This guide explains how to use the standardized toast notification system in the Pathology Bites application.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Basic Usage](#basic-usage)
3. [Advanced Features](#advanced-features)
4. [Categorized Toasts](#categorized-toasts)
5. [Best Practices](#best-practices)
6. [API Reference](#api-reference)
7. [Migration Guide](#migration-guide)

## Quick Start

```typescript
import { toast } from '@/shared/utils/toast'

// Show a success message
toast.success('Profile updated successfully')

// Show an error message
toast.error('Failed to save changes')
```

## Basic Usage

### Success Messages

Use for successful operations:

```typescript
toast.success('Question created successfully')
toast.success('Image uploaded', { duration: 5000 })
```

### Error Messages

Use for errors and failures:

```typescript
toast.error('Failed to load data')
toast.error('Invalid credentials', { duration: 10000 })
```

### Info Messages

Use for informational messages:

```typescript
toast.info('New features available')
toast.info('Your session will expire in 5 minutes')
```

### Warning Messages

Use for warnings and cautions:

```typescript
toast.warning('You have unsaved changes')
toast.warning('This action cannot be undone')
```

### Generic Messages

Use for neutral messages:

```typescript
toast.message('Welcome back!')
```

## Advanced Features

### Promise-Based Loading States

Automatically handle loading, success, and error states:

```typescript
toast.promise(
  saveQuestion(),
  {
    loading: 'Saving question...',
    success: 'Question saved successfully!',
    error: 'Failed to save question'
  }
)

// With dynamic messages based on result
toast.promise(
  fetchQuestions(),
  {
    loading: 'Loading questions...',
    success: (data) => `Loaded ${data.length} questions`,
    error: (err) => `Error: ${err.message}`
  }
)
```

### Manual Loading States

For more control over loading states:

```typescript
const toastId = toast.loading('Processing...')

try {
  await longRunningOperation()
  toast.success('Operation completed', { id: toastId })
} catch (error) {
  toast.error('Operation failed', { id: toastId })
}
```

### Custom Durations

```typescript
// Short-lived toast (3 seconds)
toast.info('Quick tip!', { duration: 3000 })

// Long-lived toast (15 seconds)
toast.error('Critical error - please read carefully', { duration: 15000 })

// Persistent toast (requires manual dismissal)
toast.warning('Review required', { duration: Infinity })
```

### Dismissing Toasts

```typescript
// Dismiss a specific toast
const toastId = toast.success('Action completed')
toast.dismiss(toastId)

// Dismiss all toasts
toast.dismiss()
```

## Categorized Toasts

Use categorized toasts for better semantic grouping and automatic deduplication within categories:

### Authentication Toasts

```typescript
toast.auth.success('Login successful')
toast.auth.error('Invalid credentials')
toast.auth.info('Please verify your email')
```

### Question Management Toasts

```typescript
toast.question.success('Question created')
toast.question.error('Failed to delete question')
toast.question.info('Question submitted for review')
```

### Quiz Toasts

```typescript
toast.quiz.success('Quiz completed!')
toast.quiz.error('Failed to load quiz')
toast.quiz.info('Progress saved')
```

### Upload Toasts

```typescript
toast.upload.success('Image uploaded successfully')
toast.upload.error('Upload failed - file too large')
toast.upload.info('Processing upload...')
```

## Best Practices

### 1. Use Appropriate Toast Types

- ✅ `toast.success()` for successful operations
- ✅ `toast.error()` for errors and failures
- ✅ `toast.warning()` for warnings and cautions
- ✅ `toast.info()` for informational messages
- ✅ `toast.message()` for neutral messages

### 2. Write Clear, Concise Messages

```typescript
// ✅ Good: Clear and actionable
toast.success('Question saved')
toast.error('Failed to save question. Please try again.')

// ❌ Bad: Vague or technical
toast.success('Success!')
toast.error('Error code 500')
```

### 3. Use Promise-Based Toasts for Async Operations

```typescript
// ✅ Good: Automatic state management
toast.promise(
  saveData(),
  {
    loading: 'Saving...',
    success: 'Saved successfully',
    error: 'Failed to save'
  }
)

// ❌ Less ideal: Manual state management
toast.loading('Saving...')
try {
  await saveData()
  toast.success('Saved successfully')
} catch (error) {
  toast.error('Failed to save')
}
```

### 4. Leverage Categories for Related Operations

```typescript
// ✅ Good: Uses category for better organization
toast.auth.error('Login failed')

// ✅ Also good: Standard approach for one-off messages
toast.error('Login failed')
```

### 5. Don't Overuse Toasts

```typescript
// ❌ Bad: Too many toasts for a single action
toast.info('Validating...')
toast.info('Uploading...')
toast.info('Processing...')
toast.success('Complete!')

// ✅ Good: Use one toast with promise
toast.promise(
  uploadAndProcess(),
  {
    loading: 'Uploading and processing...',
    success: 'Upload complete!',
    error: 'Upload failed'
  }
)
```

### 6. Adjust Duration Based on Message Importance

```typescript
// Quick confirmation (3-5 seconds)
toast.success('Copied to clipboard', { duration: 3000 })

// Important error (10+ seconds)
toast.error('Payment failed. Please check your payment method.', {
  duration: 12000
})

// Critical warning (persistent)
toast.warning('Your account will be suspended in 24 hours', {
  duration: Infinity
})
```

## API Reference

### Core Methods

#### `toast.success(message, options?)`
Display a success toast.

```typescript
toast.success('Operation completed')
toast.success('Saved!', { duration: 5000 })
```

#### `toast.error(message, options?)`
Display an error toast.

```typescript
toast.error('Failed to load')
toast.error('Error occurred', { id: 'custom-id' })
```

#### `toast.warning(message, options?)`
Display a warning toast.

```typescript
toast.warning('Unsaved changes')
```

#### `toast.info(message, options?)`
Display an info toast.

```typescript
toast.info('New update available')
```

#### `toast.message(message, options?)`
Display a neutral toast.

```typescript
toast.message('Welcome!')
```

#### `toast.loading(message, options?)`
Display a loading toast. Returns toast ID.

```typescript
const id = toast.loading('Processing...')
```

#### `toast.promise(promise, messages, options?)`
Handle promise states automatically.

```typescript
toast.promise(
  fetchData(),
  {
    loading: 'Loading...',
    success: (data) => `Loaded ${data.items} items`,
    error: 'Failed to load'
  }
)
```

#### `toast.dismiss(toastId?)`
Dismiss toasts. If no ID provided, dismisses all.

```typescript
toast.dismiss()           // Dismiss all
toast.dismiss(toastId)    // Dismiss specific toast
```

### Options

All toast methods accept an optional `options` parameter:

```typescript
interface ToastOptions {
  id?: string | number          // Unique identifier
  duration?: number             // Display duration in ms
  position?: 'top-left' | 'top-center' | 'top-right' |
             'bottom-left' | 'bottom-center' | 'bottom-right'
  description?: string          // Additional description text
  action?: {                    // Action button
    label: string
    onClick: () => void
  }
  cancel?: {                    // Cancel button
    label: string
    onClick: () => void
  }
  onDismiss?: () => void        // Called when dismissed
  onAutoClose?: () => void      // Called when auto-closed
}
```

### Categorized Toast Methods

Each category has `success`, `error`, and `info` methods:

- `toast.auth.*` - Authentication toasts
- `toast.question.*` - Question management toasts
- `toast.quiz.*` - Quiz-related toasts
- `toast.upload.*` - Upload/file operation toasts

## Migration Guide

### From Direct Sonner Imports

If you have existing code using direct sonner imports:

```typescript
// ❌ Old way
import { toast } from 'sonner'

toast.success('Done!')
```

Change to:

```typescript
// ✅ New way
import { toast } from '@/shared/utils/toast'

toast.success('Done!')
```

### Automatic Migration

We provide a script to migrate all files automatically:

```bash
./scripts/migrate-toast-imports.sh
```

This script will:
1. Find all files importing from 'sonner'
2. Replace imports with '@/shared/utils/toast'
3. Report the number of files migrated

### ESLint Protection

The codebase includes an ESLint rule that prevents direct sonner imports:

```javascript
// This will trigger an ESLint error:
import { toast } from 'sonner' // ❌ Error

// Use this instead:
import { toast } from '@/shared/utils/toast' // ✅ Correct
```

## Features

### Automatic Duplicate Prevention

The toast utility automatically prevents duplicate toasts within a 1-second window:

```typescript
// Only one toast will appear even if called multiple times
toast.error('Network error')
toast.error('Network error') // Prevented (duplicate)
toast.error('Network error') // Prevented (duplicate)
```

### Memory Management

The utility automatically manages memory by:
- Limiting toast history to 100 entries
- Clearing old toast IDs after the deduplication window
- Using timestamps for efficient duplicate detection

### Category-Based Deduplication

Categorized toasts have separate deduplication namespaces:

```typescript
// Both toasts will show (different categories)
toast.auth.error('Login failed')
toast.question.error('Login failed')

// But these will deduplicate within auth category
toast.auth.error('Login failed')
toast.auth.error('Login failed') // Prevented
```

## Troubleshooting

### Toast Not Showing

1. Check that `<Toaster />` is rendered in your app layout
2. Verify the import path is correct
3. Check browser console for errors

### Duplicate Toasts Appearing

If you see duplicates despite the prevention system:
- Different messages are treated as unique
- Check if you're manually providing different `id` options
- Categories create separate namespaces

### Toast Disappearing Too Quickly/Slowly

Adjust the duration:

```typescript
toast.error('Important message', { duration: 10000 }) // 10 seconds
```

Global duration is set to 8 seconds in `src/shared/components/ui/sonner.tsx`.

## Configuration

### Global Toast Settings

Edit `src/shared/components/ui/sonner.tsx` to modify global settings:

```typescript
<Sonner
  theme="dark"                    // Theme
  position="bottom-right"         // Default position
  richColors                      // Enable rich colors
  expand={true}                   // Expand on hover
  visibleToasts={4}              // Max visible toasts
  closeButton                     // Show close button
  toastOptions={{
    duration: 8000,               // Default duration
    // ... other options
  }}
/>
```

### Deduplication Settings

Edit `src/shared/utils/toast.ts` to modify deduplication behavior:

```typescript
const DEDUPLICATION_WINDOW = 1000 // ms - how long to prevent duplicates
const MAX_TOAST_HISTORY = 100     // Maximum toast IDs to track
```

## Examples

### Real-World Usage Examples

#### Form Submission

```typescript
async function handleSubmit(data: FormData) {
  await toast.promise(
    submitForm(data),
    {
      loading: 'Submitting form...',
      success: 'Form submitted successfully!',
      error: 'Failed to submit form. Please try again.'
    }
  )
}
```

#### File Upload with Progress

```typescript
async function uploadFile(file: File) {
  const toastId = toast.loading(`Uploading ${file.name}...`)

  try {
    await uploadToServer(file)
    toast.upload.success(`${file.name} uploaded successfully`, { id: toastId })
  } catch (error) {
    toast.upload.error(`Failed to upload ${file.name}`, { id: toastId })
  }
}
```

#### Multiple Operations

```typescript
async function syncData() {
  await toast.promise(
    Promise.all([syncUsers(), syncQuestions(), syncQuizzes()]),
    {
      loading: 'Syncing all data...',
      success: 'All data synced successfully',
      error: 'Failed to sync some data'
    }
  )
}
```

#### Action with Confirmation

```typescript
toast.warning('Are you sure you want to delete this question?', {
  duration: Infinity,
  action: {
    label: 'Delete',
    onClick: async () => {
      await deleteQuestion()
      toast.success('Question deleted')
    }
  },
  cancel: {
    label: 'Cancel',
    onClick: () => toast.dismiss()
  }
})
```

## Support

For issues or questions:
1. Check this documentation
2. Review the implementation in `src/shared/utils/toast.ts`
3. Check existing usage patterns in the codebase
4. Open an issue on GitHub

---

**Last Updated:** 2025-12-18
**Version:** 1.0.0
