/**
 * Question review-workflow transitions — TOCTOU WHERE-clause guards.
 *
 * Sibling audit of the documented quiz-session race (CLAUDE.md "Read-then-write
 * UPDATEs in API routes race themselves"). Every route in the review workflow
 * reads `questions.status`, branches on it, then writes a new status. The read
 * is only a short-circuit; without a matching filter on the UPDATE, two
 * concurrent reviewers both observe `pending_review` and both writes land —
 * so the creator gets an "approved" AND a "rejected" notification, and two
 * rows appear in question_reviews for a single decision.
 *
 * These tests assert two things per route:
 *   1. the status filter is present on the UPDATE (not just the read), and
 *   2. when it matches zero rows the handler 409s BEFORE its side effects
 *      (review record + notification) rather than reporting success.
 *
 * If a refactor drops a guard back to a bare `.eq("id", ...)` update, the
 * corresponding test fails.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createMockRequest, getResponseJson } from "@tests/helpers/api-test-helpers";
import type { NextRequest } from "next/server";

vi.mock("@/shared/services/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/shared/utils/api/revalidation", () => ({
  revalidateQuestions: vi.fn(),
}));

vi.mock("@/shared/utils/logging", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const notificationSpies = {
  onQuestionApproved: vi.fn(),
  onQuestionRejected: vi.fn(),
  onQuestionSubmittedForReview: vi.fn(),
  onQuestionReassigned: vi.fn(),
};

// Must be a real function, not an arrow: the routes call `new
// NotificationTriggers()`, and an arrow throws on construct — which the
// routes' try/catch would swallow, silently making every
// "did not notify" assertion below pass for the wrong reason.
vi.mock("@/shared/services/notification-triggers", () => ({
  NotificationTriggers: vi.fn(function () {
    return notificationSpies;
  }),
}));

import { createClient } from "@/shared/services/server";
import { POST as approve } from "@/app/api/admin/questions/[id]/approve/route";
import { POST as reject } from "@/app/api/admin/questions/[id]/reject/route";
import { POST as submitForReview } from "@/app/api/admin/questions/[id]/submit-for-review/route";
import { POST as bulkApprove } from "@/app/api/admin/questions/bulk-approve/route";
import { POST as reassign } from "@/app/api/admin/questions/[id]/reassign/route";

// ---------------------------------------------------------------------------
// Supabase mock — same shape as id-route.test.ts: per-table result queues,
// chainable + thenable builders, recorded so tests can inspect filter calls.
// ---------------------------------------------------------------------------

type QueryResult = { data?: any; error?: any };

function createBuilder(result: QueryResult) {
  const builder: any = {};
  for (const method of [
    "select",
    "insert",
    "update",
    "delete",
    "upsert",
    "eq",
    "neq",
    "in",
    "not",
    "is",
    "order",
    "limit",
  ]) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }
  builder.single = vi.fn().mockResolvedValue(result);
  builder.maybeSingle = vi.fn().mockResolvedValue(result);
  builder.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);
  return builder;
}

function createSupabaseMock() {
  const queues: Record<string, QueryResult[]> = {};
  const calls: { table: string; builder: any }[] = [];

  const client = {
    from: vi.fn((table: string) => {
      const result = queues[table]?.shift() ?? { data: null, error: null };
      const builder = createBuilder(result);
      calls.push({ table, builder });
      return builder;
    }),
  };

  return {
    client,
    enqueue: (table: string, ...results: QueryResult[]) => {
      queues[table] = [...(queues[table] ?? []), ...results];
    },
    callsFor: (table: string) => calls.filter((c) => c.table === table),
    /** The builder for the UPDATE on `questions` (second from("questions")). */
    updateBuilder: () => {
      const questionCalls = calls.filter((c) => c.table === "questions");
      return questionCalls[questionCalls.length - 1].builder;
    },
  };
}

const QUESTION_ID = "question-1";
const ADMIN_ID = "admin-user";
const CREATOR_ID = "creator-user";

function makeRequest(
  body: any = {},
  url = `http://localhost:3000/api/admin/questions`
): NextRequest {
  return createMockRequest({
    method: "POST",
    url,
    headers: { "x-user-id": ADMIN_ID, "x-user-role": "admin" },
    body,
  });
}

const routeParams = { params: Promise.resolve({ id: QUESTION_ID }) };

function pendingRow(overrides: Record<string, any> = {}) {
  return {
    id: QUESTION_ID,
    status: "pending_review",
    reviewer_id: ADMIN_ID,
    created_by: CREATOR_ID,
    title: "A question",
    ...overrides,
  };
}

const adminProfile = { data: { role: "admin" }, error: null };

let mock: ReturnType<typeof createSupabaseMock>;

beforeEach(() => {
  vi.clearAllMocks();
  mock = createSupabaseMock();
  (createClient as any).mockResolvedValue(mock.client);
});

// ---------------------------------------------------------------------------

describe("POST /approve — TOCTOU guard", () => {
  it("filters the UPDATE on status, not just the pre-read", async () => {
    mock.enqueue(
      "questions",
      { data: pendingRow(), error: null },
      { data: pendingRow({ status: "published" }), error: null }
    );
    mock.enqueue("users", adminProfile);

    const res = await approve(makeRequest(), routeParams);

    expect(res.status).toBe(200);
    expect(mock.updateBuilder().eq).toHaveBeenCalledWith("status", "pending_review");
  });

  it("409s without notifying when the row already left pending_review", async () => {
    // Read sees pending_review; the guarded UPDATE matches zero rows.
    mock.enqueue("questions", { data: pendingRow(), error: null }, { data: null, error: null });
    mock.enqueue("users", adminProfile);

    const res = await approve(makeRequest(), routeParams);

    expect(res.status).toBe(409);
    expect(notificationSpies.onQuestionApproved).not.toHaveBeenCalled();
    expect(mock.callsFor("question_reviews")).toHaveLength(0);
  });
});

describe("POST /reject — TOCTOU guard", () => {
  const body = { feedback: "Needs work" };

  it("filters the UPDATE on status, not just the pre-read", async () => {
    mock.enqueue(
      "questions",
      { data: pendingRow(), error: null },
      { data: pendingRow({ status: "rejected" }), error: null }
    );
    mock.enqueue("users", adminProfile);

    const res = await reject(makeRequest(body), routeParams);

    expect(res.status).toBe(200);
    expect(mock.updateBuilder().eq).toHaveBeenCalledWith("status", "pending_review");
  });

  it("409s without notifying when the row already left pending_review", async () => {
    mock.enqueue("questions", { data: pendingRow(), error: null }, { data: null, error: null });
    mock.enqueue("users", adminProfile);

    const res = await reject(makeRequest(body), routeParams);

    expect(res.status).toBe(409);
    expect(notificationSpies.onQuestionRejected).not.toHaveBeenCalled();
    expect(mock.callsFor("question_reviews")).toHaveLength(0);
  });
});

describe("POST /submit-for-review — TOCTOU guard", () => {
  const body = { reviewer_id: "reviewer-1" };

  it("filters the UPDATE on the same draft/rejected set the pre-read checked", async () => {
    mock.enqueue(
      "users",
      { data: { id: "reviewer-1", role: "reviewer" }, error: null },
      adminProfile
    );
    mock.enqueue(
      "questions",
      { data: pendingRow({ status: "draft" }), error: null },
      { data: pendingRow({ status: "pending_review" }), error: null }
    );

    const res = await submitForReview(makeRequest(body), routeParams);

    expect(res.status).toBe(200);
    expect(mock.updateBuilder().in).toHaveBeenCalledWith("status", ["draft", "rejected"]);
  });

  it("409s without notifying the reviewer when the row already moved", async () => {
    mock.enqueue(
      "users",
      { data: { id: "reviewer-1", role: "reviewer" }, error: null },
      adminProfile
    );
    mock.enqueue(
      "questions",
      { data: pendingRow({ status: "draft" }), error: null },
      { data: null, error: null }
    );

    const res = await submitForReview(makeRequest(body), routeParams);

    expect(res.status).toBe(409);
    expect(notificationSpies.onQuestionSubmittedForReview).not.toHaveBeenCalled();
  });
});

describe("POST /reassign — TOCTOU guard", () => {
  const body = { reviewer_id: "reviewer-1" };

  it("filters the UPDATE on status, not just the pre-read", async () => {
    mock.enqueue(
      "users",
      { data: { id: "reviewer-1", role: "reviewer" }, error: null },
      adminProfile
    );
    mock.enqueue(
      "questions",
      { data: pendingRow(), error: null },
      { data: pendingRow(), error: null }
    );

    const res = await reassign(makeRequest(body), routeParams);

    expect(res.status).toBe(200);
    expect(mock.updateBuilder().eq).toHaveBeenCalledWith("status", "pending_review");
  });

  it("409s when the question left pending_review before the write", async () => {
    mock.enqueue(
      "users",
      { data: { id: "reviewer-1", role: "reviewer" }, error: null },
      adminProfile
    );
    mock.enqueue("questions", { data: pendingRow(), error: null }, { data: null, error: null });

    const res = await reassign(makeRequest(body), routeParams);

    expect(res.status).toBe(409);
  });
});

describe("POST /bulk-approve — TOCTOU guard", () => {
  const body = { questionIds: ["q1", "q2"] };

  function bulkRow(id: string) {
    return {
      id,
      status: "pending_review",
      reviewer_id: ADMIN_ID,
      created_by: CREATOR_ID,
      title: id,
    };
  }

  it("filters the bulk UPDATE on status and counts only rows that flipped", async () => {
    mock.enqueue("users", adminProfile);
    mock.enqueue(
      "questions",
      { data: [bulkRow("q1"), bulkRow("q2")], error: null },
      // Only q1 actually flipped — q2 lost the race.
      { data: [{ id: "q1" }], error: null }
    );

    const res = await bulkApprove(makeRequest(body));
    const json = await getResponseJson(res);

    expect(mock.updateBuilder().eq).toHaveBeenCalledWith("status", "pending_review");
    expect(json.approved).toBe(1);
    expect(json.failed).toBe(1);
  });

  it("notifies only the creators of rows that actually flipped", async () => {
    mock.enqueue("users", adminProfile);
    mock.enqueue(
      "questions",
      { data: [bulkRow("q1"), bulkRow("q2")], error: null },
      { data: [{ id: "q1" }], error: null }
    );

    await bulkApprove(makeRequest(body));

    expect(notificationSpies.onQuestionApproved).toHaveBeenCalledTimes(1);
    expect(notificationSpies.onQuestionApproved).toHaveBeenCalledWith(
      CREATOR_ID,
      "q1",
      "q1",
      ADMIN_ID
    );
  });

  it("records no review rows when every question lost the race", async () => {
    mock.enqueue("users", adminProfile);
    mock.enqueue(
      "questions",
      { data: [bulkRow("q1"), bulkRow("q2")], error: null },
      { data: [], error: null }
    );

    const res = await bulkApprove(makeRequest(body));
    const json = await getResponseJson(res);

    expect(json.approved).toBe(0);
    expect(mock.callsFor("question_reviews")).toHaveLength(0);
    expect(notificationSpies.onQuestionApproved).not.toHaveBeenCalled();
  });
});
