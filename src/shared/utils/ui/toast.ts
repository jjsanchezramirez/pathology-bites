/**
 * Standardized Toast Utility
 *
 * This wrapper provides automatic duplicate prevention, consistent ID generation,
 * and enhanced features for toast notifications across the application.
 *
 * Features:
 * - Automatic duplicate prevention (configurable window)
 * - Consistent ID generation for related toasts
 * - Promise-based loading states
 * - Type-safe options
 * - Categorized toasts for better semantics
 *
 * @example
 * ```typescript
 * // Simple success toast
 * toast.success('Profile updated successfully')
 *
 * // Error with custom duration
 * toast.error('Failed to save', { duration: 10000 })
 *
 * // Promise-based loading states
 * toast.promise(
 *   saveData(),
 *   {
 *     loading: 'Saving...',
 *     success: 'Saved successfully!',
 *     error: 'Failed to save'
 *   }
 * )
 *
 * // Categorized toasts (auto-prefixed for deduplication)
 * toast.auth.error('Invalid credentials')
 * ```
 */

// eslint-disable-next-line no-restricted-imports
import { toast as sonnerToast, type ExternalToast } from "sonner";

// Configuration
const DEDUPLICATION_WINDOW = 1000; // ms - how long to prevent duplicates
const MAX_TOAST_HISTORY = 100; // Maximum number of toast IDs to track

// Utility to prevent duplicate toasts
const recentToasts = new Map<string, number>();

/**
 * Generates a consistent ID for a toast message
 */
function generateToastId(message: string, type?: string, category?: string): string {
  const prefix = category ? `${category}-${type}` : type || "default";
  // Use first 100 chars to balance uniqueness and deduplication
  const messageKey = message.slice(0, 100).toLowerCase().trim();
  return `${prefix}-${messageKey}`;
}

/**
 * Clears old toast IDs from tracking to prevent memory leaks
 */
function clearToastId(id: string, delay = DEDUPLICATION_WINDOW) {
  setTimeout(() => {
    recentToasts.delete(id);
  }, delay);
}

/**
 * Checks if a toast should be prevented (duplicate within window)
 */
function shouldPreventToast(id: string): boolean {
  const lastShown = recentToasts.get(id);
  if (!lastShown) return false;

  const timeSinceLastShown = Date.now() - lastShown;
  return timeSinceLastShown < DEDUPLICATION_WINDOW;
}

/**
 * Tracks a toast as shown
 */
function trackToast(id: string) {
  // Prevent memory leaks by limiting history size
  if (recentToasts.size >= MAX_TOAST_HISTORY) {
    const firstKey = recentToasts.keys().next().value;
    recentToasts.delete(firstKey);
  }

  recentToasts.set(id, Date.now());
  clearToastId(id);
}

/**
 * Core toast display function with deduplication
 */
function showToast(
  type: "success" | "error" | "warning" | "info" | "default",
  message: string,
  options?: ExternalToast,
  category?: string
) {
  const id = String(options?.id || generateToastId(message, type, category));

  if (shouldPreventToast(id)) {
    return id;
  }

  trackToast(id);

  const toastFn = type === "default" ? sonnerToast : sonnerToast[type];
  return toastFn(message, { ...options, id });
}

// Main toast interface
export const toast = {
  /**
   * Success toast - for successful operations
   */
  success: (message: string, options?: ExternalToast) => {
    return showToast("success", message, options);
  },

  /**
   * Error toast - for errors and failures
   */
  error: (message: string, options?: ExternalToast) => {
    return showToast("error", message, options);
  },

  /**
   * Warning toast - for warnings and cautions
   */
  warning: (message: string, options?: ExternalToast) => {
    return showToast("warning", message, options);
  },

  /**
   * Info toast - for informational messages
   */
  info: (message: string, options?: ExternalToast) => {
    return showToast("info", message, options);
  },

  /**
   * Default toast - neutral messages
   */
  message: (message: string, options?: ExternalToast) => {
    return showToast("default", message, options);
  },

  /**
   * Loading toast - for in-progress operations
   * Returns toast ID that can be used to dismiss or update
   */
  loading: (message: string, options?: ExternalToast) => {
    const id = String(options?.id || generateToastId(message, "loading"));
    return sonnerToast.loading(message, { ...options, id });
  },

  /**
   * Promise-based toast - automatically handles loading, success, and error states
   *
   * @example
   * ```typescript
   * toast.promise(
   *   fetchData(),
   *   {
   *     loading: 'Loading data...',
   *     success: (data) => `Loaded ${data.length} items`,
   *     error: 'Failed to load data'
   *   }
   * )
   * ```
   */
  promise: sonnerToast.promise,

  /**
   * Dismiss a toast by ID, or all toasts if no ID provided
   */
  dismiss: sonnerToast.dismiss,

  // Categorized toasts for semantic grouping and better deduplication

  /**
   * Authentication-related toasts
   */
  auth: {
    success: (message: string, options?: ExternalToast) =>
      showToast("success", message, options, "auth"),
    error: (message: string, options?: ExternalToast) =>
      showToast("error", message, options, "auth"),
    info: (message: string, options?: ExternalToast) => showToast("info", message, options, "auth"),
  },

  /**
   * Question management toasts
   */
  question: {
    success: (message: string, options?: ExternalToast) =>
      showToast("success", message, options, "question"),
    error: (message: string, options?: ExternalToast) =>
      showToast("error", message, options, "question"),
    info: (message: string, options?: ExternalToast) =>
      showToast("info", message, options, "question"),
  },

  /**
   * Quiz-related toasts
   */
  quiz: {
    success: (message: string, options?: ExternalToast) =>
      showToast("success", message, options, "quiz"),
    error: (message: string, options?: ExternalToast) =>
      showToast("error", message, options, "quiz"),
    info: (message: string, options?: ExternalToast) => showToast("info", message, options, "quiz"),
  },

  /**
   * Image/file upload toasts
   */
  upload: {
    success: (message: string, options?: ExternalToast) =>
      showToast("success", message, options, "upload"),
    error: (message: string, options?: ExternalToast) =>
      showToast("error", message, options, "upload"),
    info: (message: string, options?: ExternalToast) =>
      showToast("info", message, options, "upload"),
  },
};
