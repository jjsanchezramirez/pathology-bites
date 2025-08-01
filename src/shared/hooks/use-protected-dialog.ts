import { useRef, useEffect } from 'react'

/**
 * Custom hook for dialogs with modal={false} that prevents immediate closing
 * during the opening phase while avoiding screen freezing.
 * 
 * @param open - Whether the dialog is open
 * @param protectionDuration - How long to protect against closing (default: 500ms)
 * @returns Protected onOpenChange handler
 */
export function useProtectedDialog(
  open: boolean,
  onOpenChange: (open: boolean) => void,
  protectionDuration: number = 500
) {
  const isOpeningRef = useRef(false)

  useEffect(() => {
    if (open) {
      isOpeningRef.current = true
      
      // Reset protection after specified duration
      const timeout = setTimeout(() => {
        isOpeningRef.current = false
      }, protectionDuration)

      return () => clearTimeout(timeout)
    }
  }, [open, protectionDuration])

  const handleOpenChange = (newOpen: boolean) => {
    // Ignore close events during opening phase
    if (!newOpen && isOpeningRef.current) {
      return
    }
    
    onOpenChange(newOpen)
  }

  return handleOpenChange
}
