/**
 * Utility functions for displaying user information
 * Handles soft-deleted users by showing "[Deleted User]" instead of actual names
 */

export interface UserDisplayInfo {
  id: string
  first_name: string | null
  last_name: string | null
  deleted_at: string | null
}

/**
 * Get display name for a user, handling soft-deleted users
 * @param user User object with name and deleted_at fields
 * @returns Display name or "[Deleted User]" if soft-deleted
 */
export function getUserDisplayName(user: UserDisplayInfo | null | undefined): string {
  if (!user) {
    return '[Unknown User]'
  }

  if (user.deleted_at) {
    return '[Deleted User]'
  }

  const firstName = user.first_name || ''
  const lastName = user.last_name || ''
  const fullName = `${firstName} ${lastName}`.trim()

  return fullName || '[No Name]'
}

/**
 * Get display name with ID for debugging/audit purposes
 * @param user User object with name and deleted_at fields
 * @returns Display name with user ID
 */
export function getUserDisplayNameWithId(user: UserDisplayInfo | null | undefined): string {
  if (!user) {
    return '[Unknown User]'
  }

  const displayName = getUserDisplayName(user)
  return `${displayName} (${user.id})`
}

/**
 * Check if a user is soft-deleted
 * @param user User object with deleted_at field
 * @returns true if user is soft-deleted
 */
export function isUserDeleted(user: { deleted_at: string | null } | null | undefined): boolean {
  return !!user?.deleted_at
}

/**
 * Format deleted_at timestamp for display
 * @param deletedAt ISO timestamp string
 * @returns Formatted date string or null
 */
export function formatDeletedAt(deletedAt: string | null | undefined): string | null {
  if (!deletedAt) return null

  try {
    const date = new Date(deletedAt)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch {
    return null
  }
}

