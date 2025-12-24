'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { RefreshCw, RotateCcw } from 'lucide-react'

interface ResetSettingsDialogProps {
  open: boolean
  isResetting: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function ResetSettingsDialog({
  open,
  isResetting,
  onOpenChange,
  onConfirm
}: ResetSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="backdrop-blur-md bg-black/20" />
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset All Settings</DialogTitle>
            <DialogDescription>
              Are you sure you want to reset all your settings to their default values?
              <br />
              <br />
              This will reset:
              <br />
              • All appearance preferences (theme, text size, dashboard theme)
              <br />
              • All notification settings
              <br />
              • All quiz preferences
              <br />
              <br />
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isResetting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirm}
              disabled={isResetting}
            >
              {isResetting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset All Settings
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}

