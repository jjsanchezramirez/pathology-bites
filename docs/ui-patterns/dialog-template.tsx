/**
 * Template for creating dialogs with modal={false} pattern
 * Copy this template and customize for your specific dialog needs
 */

'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogPortal,
  DialogOverlay
} from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { useProtectedDialog } from '@/shared/hooks/use-protected-dialog'
import { toast } from 'sonner'

interface MyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemId?: string | null
  // Add other props as needed
}

export function MyDialog({
  open,
  onOpenChange,
  itemId
}: MyDialogProps) {
  // State management
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)
  
  // Use protected dialog hook to prevent immediate closing
  const handleOpenChange = useProtectedDialog(open, onOpenChange)

  // Data fetching function
  const fetchData = async () => {
    if (!itemId) return

    try {
      setLoading(true)

      const response = await fetch(`/api/items/${itemId}`)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('API Error:', response.status, errorText)
        toast.error(`Failed to load data: ${response.status} ${response.statusText}`)
        return
      }

      const result = await response.json()
      setData(result)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error(`Failed to load data: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  // Effect to fetch data when dialog opens
  useEffect(() => {
    if (open && itemId) {
      fetchData()
    }
  }, [open, itemId])

  // Action handlers
  const handleSave = async () => {
    // Implement save logic
    try {
      setLoading(true)
      // API call to save data
      toast.success('Data saved successfully')
      onOpenChange(false)
    } catch (error) {
      toast.error('Failed to save data')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} modal={false}>
      <DialogPortal>
        <DialogOverlay className="backdrop-blur-md bg-black/20" />
        <DialogContent className="w-full !max-w-[min(90vw,1200px)] max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>My Dialog Title</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-sm text-muted-foreground">Loading...</div>
              </div>
            ) : (
              <div>
                {/* Dialog content goes here */}
                <p>Dialog content for item: {itemId}</p>
                {data && (
                  <pre className="text-xs bg-muted p-2 rounded">
                    {JSON.stringify(data, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>

          {/* Dialog Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}

/**
 * Usage Example:
 * 
 * function ParentComponent() {
 *   const [dialogOpen, setDialogOpen] = useState(false)
 *   const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
 * 
 *   const handleOpenDialog = (itemId: string) => {
 *     setSelectedItemId(itemId)
 *     setDialogOpen(true)
 *   }
 * 
 *   return (
 *     <div>
 *       <Button onClick={() => handleOpenDialog('item-123')}>
 *         Open Dialog
 *       </Button>
 * 
 *       <MyDialog
 *         open={dialogOpen}
 *         onOpenChange={setDialogOpen}
 *         itemId={selectedItemId}
 *       />
 *     </div>
 *   )
 * }
 */
