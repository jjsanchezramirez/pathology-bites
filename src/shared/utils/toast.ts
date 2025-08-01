import { toast as sonnerToast } from "sonner"

// Utility to prevent duplicate toasts
const recentToasts = new Set<string>()

function generateToastId(message: string, type?: string): string {
  return `${type || 'default'}-${message.slice(0, 50)}`
}

function clearToastId(id: string, delay = 1000) {
  setTimeout(() => {
    recentToasts.delete(id)
  }, delay)
}

export const toast = {
  success: (message: string, options?: Parameters<typeof sonnerToast.success>[1]) => {
    const id = String(options?.id || generateToastId(message, 'success'))

    if (recentToasts.has(id)) {
      return
    }

    recentToasts.add(id)
    clearToastId(id)

    return sonnerToast.success(message, { ...options, id })
  },
  
  error: (message: string, options?: Parameters<typeof sonnerToast.error>[1]) => {
    const id = String(options?.id || generateToastId(message, 'error'))

    if (recentToasts.has(id)) {
      return
    }

    recentToasts.add(id)
    clearToastId(id)

    return sonnerToast.error(message, { ...options, id })
  },

  warning: (message: string, options?: Parameters<typeof sonnerToast.warning>[1]) => {
    const id = String(options?.id || generateToastId(message, 'warning'))

    if (recentToasts.has(id)) {
      return
    }

    recentToasts.add(id)
    clearToastId(id)
    
    return sonnerToast.warning(message, { ...options, id })
  },
  
  info: (message: string, options?: Parameters<typeof sonnerToast.info>[1]) => {
    const id = String(options?.id || generateToastId(message, 'info'))

    if (recentToasts.has(id)) {
      return
    }

    recentToasts.add(id)
    clearToastId(id)

    return sonnerToast.info(message, { ...options, id })
  },

  // Default toast
  default: (message: string, options?: Parameters<typeof sonnerToast>[1]) => {
    const id = String(options?.id || generateToastId(message, 'default'))

    if (recentToasts.has(id)) {
      return
    }

    recentToasts.add(id)
    clearToastId(id)

    return sonnerToast(message, { ...options, id })
  },
  
  // Direct access to sonner for custom usage
  raw: sonnerToast,
  
  // Dismiss functions
  dismiss: sonnerToast.dismiss,
  loading: sonnerToast.loading,
  promise: sonnerToast.promise,
}

// Default export for backward compatibility
export default toast
