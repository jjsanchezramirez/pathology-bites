// src/shared/services/user-deletion.ts
/**
 * User deletion service
 * 
 * Handles both soft and hard deletion of users:
 * - Soft delete: For admin/creator/reviewer users (preserves record for attribution)
 * - Hard delete: For student/user users (removes all data)
 * 
 * This service is used by:
 * - /api/user/account/delete (self-deletion)
 * - /api/admin/users DELETE (admin deletion)
 */

import { SupabaseClient } from '@supabase/supabase-js'

export interface UserDeletionResult {
  success: boolean
  deletionType: 'soft_delete' | 'hard_delete'
  message: string
}

/**
 * Delete a user from the system
 * 
 * @param adminClient - Supabase admin client (service role)
 * @param userClient - Supabase user client (for RLS-aware queries)
 * @param userId - ID of user to delete
 * @param userRole - Role of user to determine deletion type
 * @returns Deletion result
 */
export async function deleteUser(
  adminClient: SupabaseClient,
  userClient: SupabaseClient,
  userId: string,
  userRole: 'admin' | 'creator' | 'reviewer' | 'user'
): Promise<UserDeletionResult> {
  const isContentCreator = ['admin', 'creator', 'reviewer'].includes(userRole)
  const deletionType = isContentCreator ? 'soft_delete' : 'hard_delete'

  try {
    if (deletionType === 'soft_delete') {
      // Soft delete: mark as deleted but keep record for attribution
      const { error: updateError } = await adminClient
        .from('users')
        .update({
          deleted_at: new Date().toISOString(),
          status: 'deleted',
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (updateError) {
        throw new Error(`Failed to soft delete user: ${updateError.message}`)
      }

      console.log('User soft deleted successfully:', { userId, role: userRole })
      return {
        success: true,
        deletionType: 'soft_delete',
        message: 'User soft deleted successfully'
      }
    } else {
      // Hard delete: remove all user data
      // Delete from all user-related tables (order matters for foreign keys)
      const tablesToDelete = [
        'user_settings',
        'user_favorites',
        'user_achievements',
        'performance_analytics',
        'notification_states',
        'quiz_sessions',
        'quiz_attempts',
        'module_sessions',
        'module_attempts',
        'user_learning'
      ]

      for (const table of tablesToDelete) {
        const { error: deleteError } = await adminClient
          .from(table)
          .delete()
          .eq('user_id', userId)

        if (deleteError) {
          console.error(`Error deleting from ${table}:`, deleteError)
          // Continue with other tables even if one fails
        }
      }

      // Finally, delete the user record
      const { error: userDeleteError } = await adminClient
        .from('users')
        .delete()
        .eq('id', userId)

      if (userDeleteError) {
        throw new Error(`Failed to delete user record: ${userDeleteError.message}`)
      }

      console.log('User hard deleted successfully:', { userId, role: userRole })
      return {
        success: true,
        deletionType: 'hard_delete',
        message: 'User hard deleted successfully'
      }
    }
  } catch (error) {
    console.error('Error during user deletion:', {
      userId,
      userRole,
      deletionType,
      error
    })
    throw error
  }
}

/**
 * Delete user from auth system
 * 
 * @param adminClient - Supabase admin client (service role)
 * @param userId - ID of user to delete from auth
 */
export async function deleteUserFromAuth(
  adminClient: SupabaseClient,
  userId: string
): Promise<void> {
  try {
    const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(userId)

    if (authDeleteError) {
      throw new Error(`Failed to delete user from auth: ${authDeleteError.message}`)
    }

    console.log('User deleted from auth successfully:', { userId })
  } catch (error) {
    console.error('Error deleting user from auth:', {
      userId,
      error
    })
    throw error
  }
}

