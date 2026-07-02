/**
 * Unit tests for the canEditQuestion permission matrix
 * (src/features/admin/questions/services/can-edit-question.ts)
 */

import { describe, it, expect } from "vitest";
import { canEditQuestion } from "@/features/admin/questions/services/can-edit-question";
import type { UserRole } from "@/shared/utils/auth/auth-helpers";

const CREATOR_ID = "creator-1";
const OTHER_ID = "someone-else";
const REVIEWER_ID = "reviewer-1";

function decide(options: {
  role: UserRole | null;
  userId: string;
  status: string;
  createdBy?: string;
  reviewerId?: string | null;
  isPatchEdit?: boolean;
}) {
  return canEditQuestion({
    role: options.role,
    userId: options.userId,
    question: {
      status: options.status,
      created_by: options.createdBy ?? CREATOR_ID,
      reviewer_id: options.reviewerId ?? null,
    },
    isPatchEdit: options.isPatchEdit ?? false,
  });
}

describe("canEditQuestion", () => {
  describe("draft / rejected (and other non-published, non-pending statuses)", () => {
    it.each(["draft", "rejected", "flagged", "archived"])(
      "allows admin on %s questions",
      (status) => {
        expect(decide({ role: "admin", userId: "any-admin", status }).allowed).toBe(true);
      }
    );

    it.each(["draft", "rejected"])("allows creator on own %s question", (status) => {
      expect(
        decide({ role: "creator", userId: CREATOR_ID, status, createdBy: CREATOR_ID }).allowed
      ).toBe(true);
    });

    it("denies creator on another creator's draft", () => {
      const result = decide({
        role: "creator",
        userId: OTHER_ID,
        status: "draft",
        createdBy: CREATOR_ID,
      });
      expect(result).toEqual({
        allowed: false,
        error: "Insufficient permissions",
        message: "You can only edit questions you created.",
      });
    });

    it("denies reviewer on drafts, even ones they created (role gate, not ownership)", () => {
      const result = decide({
        role: "reviewer",
        userId: REVIEWER_ID,
        status: "draft",
        createdBy: REVIEWER_ID,
      });
      expect(result.allowed).toBe(false);
    });

    it.each<UserRole | null>(["user", null])("denies role %s on drafts", (role) => {
      expect(decide({ role, userId: CREATOR_ID, status: "draft" }).allowed).toBe(false);
    });
  });

  describe("pending_review", () => {
    it("allows the assigned reviewer", () => {
      const result = decide({
        role: "reviewer",
        userId: REVIEWER_ID,
        status: "pending_review",
        reviewerId: REVIEWER_ID,
      });
      expect(result.allowed).toBe(true);
    });

    it("denies a reviewer who is not assigned", () => {
      const result = decide({
        role: "reviewer",
        userId: REVIEWER_ID,
        status: "pending_review",
        reviewerId: "other-reviewer",
      });
      expect(result).toEqual({
        allowed: false,
        error: "Insufficient permissions",
        message: "You can only edit questions you created or are assigned to review.",
      });
    });

    it("allows the creator of the question", () => {
      const result = decide({
        role: "creator",
        userId: CREATOR_ID,
        status: "pending_review",
        createdBy: CREATOR_ID,
        reviewerId: REVIEWER_ID,
      });
      expect(result.allowed).toBe(true);
    });

    it("denies a creator who did not create the question", () => {
      const result = decide({
        role: "creator",
        userId: OTHER_ID,
        status: "pending_review",
        createdBy: CREATOR_ID,
      });
      expect(result.allowed).toBe(false);
    });

    it("allows admin", () => {
      expect(decide({ role: "admin", userId: "any-admin", status: "pending_review" }).allowed).toBe(
        true
      );
    });

    it("denies plain users", () => {
      expect(decide({ role: "user", userId: OTHER_ID, status: "pending_review" }).allowed).toBe(
        false
      );
    });
  });

  describe("published + patch edit", () => {
    it("allows creator on own published question", () => {
      const result = decide({
        role: "creator",
        userId: CREATOR_ID,
        status: "published",
        createdBy: CREATOR_ID,
        isPatchEdit: true,
      });
      expect(result.allowed).toBe(true);
    });

    it("denies creator on another creator's published question", () => {
      const result = decide({
        role: "creator",
        userId: OTHER_ID,
        status: "published",
        createdBy: CREATOR_ID,
        isPatchEdit: true,
      });
      expect(result).toEqual({
        allowed: false,
        error: "Insufficient permissions for patch edit",
        message:
          "Only creators (of their own questions) and reviewers can make patch edits to published questions.",
      });
    });

    it("allows any reviewer regardless of assignment", () => {
      const result = decide({
        role: "reviewer",
        userId: REVIEWER_ID,
        status: "published",
        reviewerId: null,
        isPatchEdit: true,
      });
      expect(result.allowed).toBe(true);
    });

    it("allows admin", () => {
      expect(
        decide({ role: "admin", userId: "any-admin", status: "published", isPatchEdit: true })
          .allowed
      ).toBe(true);
    });

    it.each<UserRole | null>(["user", null])("denies role %s", (role) => {
      expect(
        decide({ role, userId: OTHER_ID, status: "published", isPatchEdit: true }).allowed
      ).toBe(false);
    });
  });

  describe("published + non-patch edit", () => {
    it("allows admin", () => {
      expect(decide({ role: "admin", userId: "any-admin", status: "published" }).allowed).toBe(
        true
      );
    });

    it("allows creator on own published question", () => {
      expect(
        decide({ role: "creator", userId: CREATOR_ID, status: "published", createdBy: CREATOR_ID })
          .allowed
      ).toBe(true);
    });

    it("allows creator on another creator's published question (role-only check, preserved behavior)", () => {
      expect(
        decide({ role: "creator", userId: OTHER_ID, status: "published", createdBy: CREATOR_ID })
          .allowed
      ).toBe(true);
    });

    it("denies reviewer", () => {
      const result = decide({
        role: "reviewer",
        userId: REVIEWER_ID,
        status: "published",
        reviewerId: REVIEWER_ID,
      });
      expect(result).toEqual({
        allowed: false,
        error: "Cannot edit published questions",
        message:
          "Only admins and creators can make non-patch edits to published questions. Non-patch edits require review.",
      });
    });

    it.each<UserRole | null>(["user", null])("denies role %s", (role) => {
      expect(decide({ role, userId: OTHER_ID, status: "published" }).allowed).toBe(false);
    });
  });
});
