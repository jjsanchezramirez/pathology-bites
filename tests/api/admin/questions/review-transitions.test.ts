/**
 * Review workflow routes (submit, approve, reject, reassign, delete=archive, bulk).
 *
 * Permission and state checks, and the race guard (a row lock), now live in the
 * transition_question database function, which has its own SQL tests in
 * supabase/tests/question-save-path. These tests pin the route side: each route calls
 * the function with the right action and arguments, maps its refusals to HTTP codes,
 * and notifies only after a transition succeeded.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createMockRequest, getResponseJson } from "@tests/helpers/api-test-helpers";
import type { NextRequest } from "next/server";

vi.mock("@/shared/services/service-role-client", () => ({ createServiceRoleClient: vi.fn() }));
vi.mock("@/shared/utils/api/revalidation", () => ({ revalidateQuestions: vi.fn() }));
vi.mock("@/shared/utils/logging", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const notificationSpies = {
  onQuestionApproved: vi.fn(),
  onQuestionRejected: vi.fn(),
  onQuestionSubmittedForReview: vi.fn(),
};
// A real function (not an arrow) so `new NotificationTriggers()` works.
vi.mock("@/shared/services/notification-triggers", () => ({
  NotificationTriggers: vi.fn(function () {
    return notificationSpies;
  }),
}));

vi.mock("@/features/admin/questions/services/question-service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/admin/questions/services/question-service")>();
  return { ...actual, transitionQuestion: vi.fn(), saveQuestion: vi.fn() };
});

import { createServiceRoleClient } from "@/shared/services/service-role-client";
import { revalidateQuestions } from "@/shared/utils/api/revalidation";
import {
  QuestionWriteError,
  transitionQuestion,
  type TransitionResult,
} from "@/features/admin/questions/services/question-service";
import { POST as submitPOST } from "@/app/api/admin/questions/[id]/submit-for-review/route";
import { POST as approvePOST } from "@/app/api/admin/questions/[id]/approve/route";
import { POST as rejectPOST } from "@/app/api/admin/questions/[id]/reject/route";
import { POST as reassignPOST } from "@/app/api/admin/questions/[id]/reassign/route";
import { DELETE as deleteDELETE } from "@/app/api/admin/questions/[id]/delete/route";
import { POST as bulkPOST } from "@/app/api/admin/questions/bulk/route";
import { POST as bulkApprovePOST } from "@/app/api/admin/questions/bulk-approve/route";

const QUESTION_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const REVIEWER_ID = "33333333-3333-4333-8333-333333333333";
const AUTHOR_ID = "44444444-4444-4444-8444-444444444444";
const params = { params: Promise.resolve({ id: QUESTION_ID }) };

const transition = transitionQuestion as unknown as ReturnType<typeof vi.fn>;

function req(path: string, body: unknown = {}, method = "POST", permissions = "review_questions") {
  return createMockRequest({
    method,
    url: `http://localhost:3000/api/admin/questions/${path}`,
    headers: { "x-user-id": USER_ID, "x-user-role": "user", "x-user-permissions": permissions },
    body,
  }) as NextRequest;
}

function result(overrides: Partial<TransitionResult> = {}): TransitionResult {
  return {
    question_id: QUESTION_ID,
    action: "approve",
    previous_status: "pending_review",
    status: "published",
    reviewer_id: REVIEWER_ID,
    created_by: AUTHOR_ID,
    title: "A question",
    version_id: "v1",
    ...overrides,
  };
}

// Service-role client: `from(table)...` resolves to the queued rows for that table.
let rows: Record<string, unknown> = {};
function builder(table: string) {
  const data = rows[table] ?? null;
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in"]) b[m] = vi.fn(() => b);
  b.maybeSingle = vi.fn(async () => ({ data, error: null }));
  b.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data, error: null }).then(resolve);
  return b;
}

beforeEach(() => {
  vi.clearAllMocks();
  rows = { questions: { id: QUESTION_ID, status: "published" } };
  (createServiceRoleClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    from: vi.fn((table: string) => builder(table)),
  });
});

describe("single-question review routes", () => {
  it("submit passes the reviewer and resubmission notes", async () => {
    transition.mockResolvedValue(result({ action: "submit", status: "pending_review" }));
    const res = await submitPOST(
      req(`${QUESTION_ID}/submit-for-review`, {
        reviewer_id: REVIEWER_ID,
        resubmission_notes: "fixed",
      }),
      params
    );
    expect(res.status).toBe(200);
    expect(transition).toHaveBeenCalledWith({
      actor: USER_ID,
      questionId: QUESTION_ID,
      action: "submit",
      reviewerId: REVIEWER_ID,
      notes: "fixed",
    });
    expect(notificationSpies.onQuestionSubmittedForReview).toHaveBeenCalledWith(
      REVIEWER_ID,
      QUESTION_ID,
      "A question",
      AUTHOR_ID
    );
    expect(revalidateQuestions).toHaveBeenCalled();
  });

  it("submit without a reviewer is a 400 before the database is called", async () => {
    const res = await submitPOST(req(`${QUESTION_ID}/submit-for-review`, {}), params);
    expect(res.status).toBe(400);
    expect(transition).not.toHaveBeenCalled();
  });

  it("approve notifies the author and returns the question", async () => {
    transition.mockResolvedValue(result());
    const res = await approvePOST(req(`${QUESTION_ID}/approve`), params);
    const body = await getResponseJson(res);
    expect(res.status).toBe(200);
    expect(body.question).toEqual({ id: QUESTION_ID, status: "published" });
    expect(transition.mock.calls[0][0].action).toBe("approve");
    expect(notificationSpies.onQuestionApproved).toHaveBeenCalledWith(
      AUTHOR_ID,
      QUESTION_ID,
      "A question",
      USER_ID
    );
  });

  it.each([
    ["PBA01 forbidden", 403],
    ["PBN01 not found", 404],
    ["PBV01 invalid", 400],
    ["PBC01 wrong state", 409],
  ])("a refusal (%s) maps to %i and sends no notification", async (label, status) => {
    transition.mockRejectedValue(new QuestionWriteError(label, status, label.slice(0, 5)));
    const res = await approvePOST(req(`${QUESTION_ID}/approve`), params);
    expect(res.status).toBe(status);
    expect((await getResponseJson(res)).error).toBe(label);
    expect(notificationSpies.onQuestionApproved).not.toHaveBeenCalled();
    expect(revalidateQuestions).not.toHaveBeenCalled();
  });

  it("reject requires feedback and passes it to the author's notification", async () => {
    expect((await rejectPOST(req(`${QUESTION_ID}/reject`, { feedback: " " }), params)).status).toBe(
      400
    );
    transition.mockResolvedValue(result({ action: "reject", status: "rejected" }));
    const res = await rejectPOST(req(`${QUESTION_ID}/reject`, { feedback: "Wrong key" }), params);
    expect(res.status).toBe(200);
    expect(transition.mock.calls[0][0]).toMatchObject({ action: "reject", feedback: "Wrong key" });
    expect(notificationSpies.onQuestionRejected).toHaveBeenCalledWith(
      AUTHOR_ID,
      QUESTION_ID,
      "A question",
      USER_ID,
      "Wrong key"
    );
  });

  it("reassign passes the new reviewer and notifies them", async () => {
    transition.mockResolvedValue(result({ action: "reassign", status: "pending_review" }));
    const res = await reassignPOST(
      req(`${QUESTION_ID}/reassign`, { reviewer_id: REVIEWER_ID }),
      params
    );
    expect(res.status).toBe(200);
    expect(transition.mock.calls[0][0]).toMatchObject({
      action: "reassign",
      reviewerId: REVIEWER_ID,
    });
    expect(notificationSpies.onQuestionSubmittedForReview).toHaveBeenCalled();
  });

  it("delete archives the question instead of deleting it", async () => {
    transition.mockResolvedValue(result({ action: "archive", status: "archived" }));
    const res = await deleteDELETE(req(`${QUESTION_ID}/delete`, undefined, "DELETE"), params);
    const body = await getResponseJson(res);
    expect(res.status).toBe(200);
    expect(transition.mock.calls[0][0].action).toBe("archive");
    expect(body).toMatchObject({ success: true, archived: true, questionId: QUESTION_ID });
  });

  it("requires a signed-in user", async () => {
    const anon = createMockRequest({
      method: "POST",
      url: `http://localhost:3000/api/admin/questions/${QUESTION_ID}/approve`,
      body: {},
    }) as NextRequest;
    expect((await approvePOST(anon, params)).status).toBe(401);
    expect(transition).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/questions/bulk", () => {
  const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

  it("approves only questions in review, one transition each, and reports the rest", async () => {
    rows.questions = [
      { id: A, status: "pending_review", created_by: AUTHOR_ID },
      { id: B, status: "pending_review", created_by: AUTHOR_ID },
      { id: C, status: "draft", created_by: AUTHOR_ID },
    ];
    transition
      .mockResolvedValueOnce(result({ question_id: A }))
      .mockRejectedValueOnce(new QuestionWriteError("Only the assigned reviewer", 403, "PBA01"));
    const res = await bulkPOST(req("bulk", { action: "approve", questionIds: [A, B, C] }));
    const body = await getResponseJson(res);
    expect(res.status).toBe(200);
    expect(transition).toHaveBeenCalledTimes(2);
    expect(transition.mock.calls.map((c) => c[0].questionId)).toEqual([A, B]);
    expect(body.affectedCount).toBe(1);
    expect(body.errors).toEqual([
      { id: C, error: "Status is draft" },
      { id: B, error: "Only the assigned reviewer" },
    ]);
    expect(notificationSpies.onQuestionApproved).toHaveBeenCalledTimes(1);
  });

  it("delete archives drafts and never touches published questions", async () => {
    rows.questions = [
      { id: A, status: "draft", created_by: USER_ID },
      { id: B, status: "published", created_by: USER_ID },
    ];
    transition.mockResolvedValue(result({ question_id: A, action: "archive", status: "archived" }));
    const res = await bulkPOST(req("bulk", { action: "delete", questionIds: [A, B] }));
    const body = await getResponseJson(res);
    expect(res.status).toBe(200);
    expect(transition).toHaveBeenCalledTimes(1);
    expect(transition.mock.calls[0][0]).toMatchObject({ questionId: A, action: "archive" });
    expect(body.message).toMatch(/archived 1/);
  });

  it("returns 400 when nothing went through", async () => {
    rows.questions = [{ id: A, status: "draft", created_by: USER_ID }];
    transition.mockRejectedValue(
      new QuestionWriteError("Question is incomplete: stem", 400, "PBV01")
    );
    const res = await bulkPOST(
      req("bulk", { action: "submit_for_review", questionIds: [A], reviewer_id: REVIEWER_ID })
    );
    expect(res.status).toBe(400);
    expect((await getResponseJson(res)).error).toBe("Question is incomplete: stem");
  });

  it("404s on unknown ids before any transition", async () => {
    rows.questions = [{ id: A, status: "draft", created_by: USER_ID }];
    const res = await bulkPOST(req("bulk", { action: "delete", questionIds: [A, B] }));
    expect(res.status).toBe(404);
    expect(transition).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/questions/bulk-approve", () => {
  const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  it("needs review_questions", async () => {
    const res = await bulkApprovePOST(
      req("bulk-approve", { questionIds: [A] }, "POST", "create_questions")
    );
    expect(res.status).toBe(403);
  });

  it("approves each question in review and never publishes drafts", async () => {
    rows.questions = [
      { id: A, status: "pending_review" },
      { id: B, status: "draft" },
    ];
    transition.mockResolvedValue(result({ question_id: A }));
    const res = await bulkApprovePOST(req("bulk-approve", { questionIds: [A, B] }));
    const body = await getResponseJson(res);
    expect(res.status).toBe(200);
    expect(transition).toHaveBeenCalledTimes(1);
    expect(transition.mock.calls[0][0]).toMatchObject({ questionId: A, action: "approve" });
    expect(body).toMatchObject({ approved: 1, failed: 1 });
  });
});
