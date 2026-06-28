/**
 * Unit tests for the pure helpers extracted from edit-question-client.tsx.
 */
import { describe, it, expect } from "vitest";
import {
  getContextBanner,
  getReviewerFeedback,
  computePatchDisabled,
} from "@/app/(admin)/admin/questions/[id]/edit/edit-question-utils";

describe("getContextBanner", () => {
  it("returns a banner per known status", () => {
    expect(getContextBanner("draft")?.title).toBe("Editing Draft");
    expect(getContextBanner("flagged")?.title).toBe("Editing Flagged Question");
    expect(getContextBanner("published")?.title).toBe("Patch Editing Published Question");
    expect(getContextBanner("pending_review")?.title).toBe("Editing Question Under Review");
  });

  it("returns null for rejected/unknown statuses (feedback shown separately)", () => {
    expect(getContextBanner("rejected")).toBeNull();
    expect(getContextBanner(undefined)).toBeNull();
  });
});

describe("getReviewerFeedback", () => {
  it("surfaces feedback only for flagged/rejected", () => {
    expect(getReviewerFeedback({ status: "flagged", reviewer_feedback: "fix it" })).toBe("fix it");
    expect(getReviewerFeedback({ status: "rejected", reviewer_feedback: "no" })).toBe("no");
    expect(getReviewerFeedback({ status: "draft", reviewer_feedback: "hidden" })).toBeNull();
    expect(getReviewerFeedback({ status: "flagged" })).toBeNull();
  });
});

describe("computePatchDisabled", () => {
  it("is false when nothing changed", () => {
    const imgs = [{ image_id: "i1" }];
    expect(computePatchDisabled("opt1", "opt1", imgs, imgs)).toBe(false);
  });

  it("is true when the correct answer changed", () => {
    expect(computePatchDisabled("opt1", "opt2", [], [])).toBe(true);
  });

  it("is true when the image count changed", () => {
    expect(computePatchDisabled("opt1", "opt1", [{ image_id: "i1" }], [])).toBe(true);
  });

  it("is true when an image was swapped", () => {
    expect(computePatchDisabled("opt1", "opt1", [{ image_id: "i1" }], [{ image_id: "i2" }])).toBe(
      true
    );
  });

  it("ignores images when both sides are empty", () => {
    expect(computePatchDisabled("opt1", "opt1", [], [])).toBe(false);
  });
});
