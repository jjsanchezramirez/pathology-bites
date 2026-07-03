// src/features/admin/questions/services/can-edit-question.ts
//
// Pure permission decision for PATCH /api/admin/questions/[id].
//
// The matrix (status × role, ownership/assignment aware):
//
// | Question status      | admin | creator (own)  | creator (other's)       | reviewer (assigned)   | reviewer (other)      | user/null |
// |----------------------|-------|----------------|-------------------------|-----------------------|-----------------------|-----------|
// | draft / rejected / * | allow | allow          | deny                    | deny                  | deny                  | deny      |
// | pending_review       | allow | allow          | deny                    | allow                 | deny                  | deny      |
// | published, patch     | allow | allow          | deny                    | allow (any published) | allow (any published) | deny      |
// | published, non-patch | allow | allow          | allow (role-only check) | deny                  | deny                  | deny      |
//
// Notes preserved from the original inline logic:
// - The published non-patch branch only checks the role (admin/creator), not
//   ownership. Creators' minor/major edits are forced through review later by
//   the status-transition rules, not here.
// - Statuses other than published/pending_review (draft, rejected, flagged,
//   archived) all fall into the "own draft/rejected" branch.

import type { UserRole } from "@/shared/utils/auth/auth-helpers";

export interface EditableQuestionRow {
  status: string;
  created_by: string;
  reviewer_id: string | null;
}

// Deliberately not a discriminated union: this repo compiles with
// strict:false, where `{allowed: false}` unions don't narrow via
// `!result.allowed` (same caveat as api-guard.ts).
export interface EditPermissionResult {
  allowed: boolean;
  /** 403 body `error` field; set when allowed is false. */
  error?: string;
  /** 403 body `message` field; set when allowed is false. */
  message?: string;
}

export function canEditQuestion(input: {
  role: UserRole | null;
  userId: string;
  question: EditableQuestionRow;
  isPatchEdit: boolean;
}): EditPermissionResult {
  const { role, userId, question, isPatchEdit } = input;

  const isAdmin = role === "admin";
  const isCreator = role === "creator";
  const isReviewer = role === "reviewer";
  const isQuestionCreator = question.created_by === userId;
  const isAssignedReviewer = question.reviewer_id === userId;

  if (question.status === "published") {
    if (isPatchEdit) {
      // Creators can patch-edit their own published questions; reviewers can
      // patch-edit any published question; admins can always edit.
      if ((isCreator && isQuestionCreator) || isReviewer || isAdmin) {
        return { allowed: true };
      }
      return {
        allowed: false,
        error: "Insufficient permissions for patch edit",
        message:
          "Only creators (of their own questions) and reviewers can make patch edits to published questions.",
      };
    }

    // Non-patch edits (minor/major) require admin or creator role.
    if (!isAdmin && !isCreator) {
      return {
        allowed: false,
        error: "Cannot edit published questions",
        message:
          "Only admins and creators can make non-patch edits to published questions. Non-patch edits require review.",
      };
    }
    return { allowed: true };
  }

  if (question.status === "pending_review") {
    // Assigned reviewers, the question's creator, and admins may edit.
    if ((isReviewer && isAssignedReviewer) || (isCreator && isQuestionCreator) || isAdmin) {
      return { allowed: true };
    }
    return {
      allowed: false,
      error: "Insufficient permissions",
      message: "You can only edit questions you created or are assigned to review.",
    };
  }

  // draft / rejected (and any other non-published status): own creator or admin.
  if ((isCreator && isQuestionCreator) || isAdmin) {
    return { allowed: true };
  }
  return {
    allowed: false,
    error: "Insufficient permissions",
    message: "You can only edit questions you created.",
  };
}
