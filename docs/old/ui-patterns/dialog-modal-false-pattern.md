# Dialog Modal={false} Pattern

## Overview

This document describes the standardized pattern for implementing dialogs with `modal={false}` to prevent screen freezing while avoiding immediate closing issues.

## Problem

When using `modal={false}` on shadcn/ui Dialog components to prevent screen freezing (as per user preferences), dialogs can immediately close after opening due to focus management and event handling issues.

## Solution

Use a ref-based protection mechanism that ignores close events during the initial opening phase.

## Implementation Pattern

### Option 1: Using the Custom Hook (Recommended)

```typescript
import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog'
import { useProtectedDialog } from '@/shared/hooks/use-protected-dialog'

interface MyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // ... other props
}

export function MyDialog({ open, onOpenChange, ...props }: MyDialogProps) {
  // Use the custom hook for protection
  const handleOpenChange = useProtectedDialog(open, onOpenChange)

  // ... other state and logic

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} modal={false}>
      <DialogContent className="w-full !max-w-[min(90vw,1200px)] max-h-[85vh]">
        {/* Dialog content */}
      </DialogContent>
    </Dialog>
  )
}
```

### Option 2: Manual Implementation

```typescript
import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog'

interface MyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // ... other props
}

export function MyDialog({ open, onOpenChange, ...props }: MyDialogProps) {
  const isOpeningRef = useRef(false)

  useEffect(() => {
    if (open && someCondition) {
      // Set protection flag when dialog opens
      isOpeningRef.current = true

      // Perform any initialization (API calls, etc.)
      initializeDialog()

      // Reset protection after 500ms
      setTimeout(() => {
        isOpeningRef.current = false
      }, 500)
    }
  }, [open, someCondition])

  const handleOpenChange = (newOpen: boolean) => {
    // Ignore close events during opening phase
    if (!newOpen && isOpeningRef.current) {
      return
    }

    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} modal={false}>
      <DialogContent className="w-full !max-w-[min(90vw,1200px)] max-h-[85vh]">
        {/* Dialog content */}
      </DialogContent>
    </Dialog>
  )
}
```

## Complete Example (Using Custom Hook)

```typescript
'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog'
import { useProtectedDialog } from '@/shared/hooks/use-protected-dialog'

interface ExampleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemId?: string | null
}

export function ExampleDialog({ open, onOpenChange, itemId }: ExampleDialogProps) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)

  // Use the custom hook for protection
  const handleOpenChange = useProtectedDialog(open, onOpenChange)

  const fetchData = async () => {
    if (!itemId) return

    try {
      setLoading(true)
      const response = await fetch(`/api/items/${itemId}`)
      const result = await response.json()
      setData(result)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && itemId) {
      fetchData()
    }
  }, [open, itemId])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} modal={false}>
      <DialogContent className="w-full !max-w-[min(90vw,1200px)] max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Example Dialog</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div>Loading...</div>
        ) : (
          <div>
            {/* Dialog content */}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

## Nested Dialogs

For nested dialogs (dialogs within dialogs), apply the same pattern to each dialog:

```typescript
function ParentComponent() {
  const [parentOpen, setParentOpen] = useState(false)
  const [childOpen, setChildOpen] = useState(false)

  // Use the hook for both dialogs
  const handleParentOpenChange = useProtectedDialog(parentOpen, setParentOpen)
  const handleChildOpenChange = useProtectedDialog(childOpen, setChildOpen)

  return (
    <>
      {/* Parent Dialog */}
      <Dialog open={parentOpen} onOpenChange={handleParentOpenChange} modal={false}>
        <DialogContent>
          {/* Parent content */}
          <Button onClick={() => setChildOpen(true)}>Open Child Dialog</Button>
        </DialogContent>
      </Dialog>

      {/* Child Dialog */}
      <Dialog open={childOpen} onOpenChange={handleChildOpenChange} modal={false}>
        <DialogContent>
          {/* Child content */}
        </DialogContent>
      </Dialog>
    </>
  )
}
```

## Key Points

1. **Always use `modal={false}`** to prevent screen freezing
2. **Use `useRef` for protection flag** - don't use state as it causes re-renders
3. **500ms protection window** - sufficient for most initialization scenarios
4. **Apply to all dialogs** - including nested dialogs
5. **Clean implementation** - remove debugging code before committing

## Benefits

- ✅ Prevents screen freezing when closing dialogs
- ✅ Prevents immediate closing after opening
- ✅ Maintains proper user experience
- ✅ Works with nested dialogs
- ✅ Minimal performance impact

## When to Use

- All dialogs that perform API calls on open
- Dialogs that need `modal={false}` for UX reasons
- Any dialog experiencing immediate closing issues
- Nested dialog scenarios

## Quick Start

1. **Copy the template**: Use `docs/ui-patterns/dialog-template.tsx` as a starting point
2. **Import the hook**: `import { useProtectedDialog } from '@/shared/hooks/use-protected-dialog'`
3. **Use the hook**: `const handleOpenChange = useProtectedDialog(open, onOpenChange)`
4. **Add modal={false}**: `<Dialog open={open} onOpenChange={handleOpenChange} modal={false}>`

## Related Files

- `src/shared/hooks/use-protected-dialog.ts` - Custom hook implementation
- `docs/ui-patterns/dialog-template.tsx` - Copy-paste template
- `src/features/questions/components/version-history-dialog.tsx` - Reference implementation
- `src/features/questions/components/version-history/` - Modular component structure
