import { QuestionWithDetails } from '@/features/questions/types/questions';

/**
 * Utility function to check if a question can be deleted
 * 
 * Deletion Rules:
 * - Only draft questions can be deleted
 * - Admins can delete any draft question
 * - Creators can only delete their own draft questions
 * - Reviewers cannot delete questions
 */
export function canDeleteQuestion(
  question: QuestionWithDetails | null, 
  userRole: string | null, 
  userId: string | null
): { canDelete: boolean; reason?: string } {
  if (!question || !userRole || !userId) {
    return { canDelete: false, reason: 'Missing required information' };
  }

  // Only draft questions can be deleted
  if (question.status !== 'draft') {
    return { 
      canDelete: false, 
      reason: `Cannot delete ${question.status} questions. Only draft questions can be deleted.` 
    };
  }

  // Check role-based permissions
  if (userRole === 'admin') {
    return { canDelete: true }; // Admins can delete any draft question
  }

  if (userRole === 'creator' && question.created_by === userId) {
    return { canDelete: true }; // Creators can delete their own draft questions
  }

  if (userRole === 'creator') {
    return { canDelete: false, reason: 'You can only delete your own questions.' };
  }

  return { canDelete: false, reason: 'You do not have permission to delete questions.' };
}

/**
 * Get a user-friendly message explaining why a question cannot be deleted
 */
export function getDeletionRestrictionMessage(
  question: QuestionWithDetails | null,
  userRole: string | null
): string {
  if (!question) return 'Question not found';
  
  if (question.status !== 'draft') {
    return `Questions with status '${question.status}' cannot be deleted. Only draft questions can be deleted.`;
  }
  
  if (userRole === 'creator') {
    return 'You can only delete your own draft questions.';
  }
  
  if (userRole === 'reviewer') {
    return 'Reviewers cannot delete questions. Contact an admin if deletion is needed.';
  }
  
  return 'You do not have permission to delete questions.';
}

/**
 * Check if the delete button should be shown for a question
 */
export function shouldShowDeleteButton(
  question: QuestionWithDetails | null,
  userRole: string | null,
  userId: string | null
): boolean {
  if (!question || !userRole || !userId) return false;
  
  // Only show delete button for draft questions
  if (question.status !== 'draft') return false;
  
  // Admins can delete any draft question
  if (userRole === 'admin') return true;
  
  // Creators can delete their own draft questions
  if (userRole === 'creator' && question.created_by === userId) return true;
  
  return false;
}
