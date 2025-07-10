# Dialog Modal={false} Pattern

## Overview

This document describes the standardized pattern for implementing dialogs with `modal={false}` to prevent screen freezing while avoiding immediate closing issues.

## Problem

When using `modal={false}` on shadcn/ui Dialog components to prevent screen freezing (as per user preferences), dialogs can immediately close after opening due to focus management and event handling issues.

## Solution

Use a ref-based protection mechanism that ignores close events during the initial opening phase.

## Implementation Pattern

### 1. Basic Setup

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
  
  // ... other state and logic
}
```

### 2. Opening Protection

```typescript
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
```

### 3. Protected onOpenChange Handler

```typescript
const handleOpenChange = (newOpen: boolean) => {
  // Ignore close events during opening phase
  if (!newOpen && isOpeningRef.current) {
    return
  }
  
  onOpenChange(newOpen)
}
```

### 4. Dialog Component

```typescript
return (
  <Dialog open={open} onOpenChange={handleOpenChange} modal={false}>
    <DialogContent className="w-full !max-w-[min(90vw,1200px)] max-h-[85vh]">
      {/* Dialog content */}
    </DialogContent>
  </Dialog>
)
```

## Complete Example

```typescript
'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog'

interface ExampleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemId?: string | null
}

export function ExampleDialog({ open, onOpenChange, itemId }: ExampleDialogProps) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const isOpeningRef = useRef(false)

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
      isOpeningRef.current = true
      fetchData()
      
      // Reset protection after 500ms
      setTimeout(() => {
        isOpeningRef.current = false
      }, 500)
    }
  }, [open, itemId])

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
{/* Parent Dialog */}
<Dialog open={parentOpen} onOpenChange={handleParentOpenChange} modal={false}>
  <DialogContent>
    {/* Parent content */}
    
    {/* Child Dialog */}
    <Dialog open={childOpen} onOpenChange={handleChildOpenChange} modal={false}>
      <DialogContent>
        {/* Child content */}
      </DialogContent>
    </Dialog>
  </DialogContent>
</Dialog>
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

## Related Files

- `src/features/questions/components/version-history-dialog.tsx` - Reference implementation
- `src/features/questions/components/version-history/` - Modular component structure
