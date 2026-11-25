/**
 * Admin Question Detail API Tests: GET and PATCH /api/admin/questions/[id]
 *
 * PATCH now hands the edit to the save_question database function (permissions,
 * completeness, versioning and the snapshot are checked and tested there, in
 * supabase/tests/question-save-path). These tests pin the route's own job: turning the
 * edit form's body into the function's payload, choosing the update type for live
 * questions, turning a requested status change into a review action, and mapping
 * refusals to HTTP codes.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, PATCH } from "@/app/api/admin/questions/[id]/route";
import { createMockRequest, getResponseJson } from "@tests/helpers/api-test-helpers";
import type { NextRequest } from "next/server";

// Mock dependencies
vi.mock("@/shared/services/service-role-client", () => ({
  createServiceRoleClient: vi.fn(),
}));

vi.mock("@/shared/utils/api/revalidation", () => ({
  revalidateQuestions: vi.fn(),
}));

vi.mock("@/features/admin/questions/services/question-service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/admin/questions/services/question-service")>();
  return { ...actual, saveQuestion: vi.fn(), transitionQuestion: vi.fn() };
});

vi.mock("@/features/admin/questions/services/question-notifications", () => ({
  notifyTransition: vi.fn(),
}));

vi.mock("@/shared/utils/logging", () => ({
  log: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { createServiceRoleClient } from "@/shared/services/service-role-client";
import { revalidateQuestions } from "@/shared/utils/api/revalidation";
import {
  QuestionWriteError,
  saveQuestion,
  transitionQuestion,
  type SaveResult,
} from "@/features/admin/questions/services/question-service";
import { notifyTransition } from "@/features/admin/questions/services/question-notifications";

// ---------------------------------------------------------------------------
// Supabase mock: every from(table) call pops the next queued result for that
// table. The returned builder is chainable (each method returns itself), is
// awaitable (thenable resolving the queued result), and single()/maybeSingle()
// resolve the same result. Builders are recorded so tests can assert payloads.
// ---------------------------------------------------------------------------

type QueryResult = { data?: any; error?: any; count?: number | null };

interface RecordedCall {
  table: string;
  builder: any;
}

function createBuilder(result: QueryResult) {
  const builder: any = {};
  const chainMethods = [
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
    "range",
  ];
  for (const method of chainMethods) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }
  builder.single = vi.fn().mockResolvedValue(result);
  builder.maybeSingle = vi.fn().mockResolvedValue(result);
  builder.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);
  return builder;
}

function createSupabaseMock() {
  const queues: Record<string, QueryResult[]> = {};
  const calls: RecordedCall[] = [];

  const client = {
    from: vi.fn((table: string) => {
      const result = queues[table]?.shift() ?? { data: null, error: null };
      const builder = createBuilder(result);
      calls.push({ table, builder });
      return builder;
    }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  const enqueue = (table: string, ...results: QueryResult[]) => {
    queues[table] = [...(queues[table] ?? []), ...results];
  };

  const callsFor = (table: string) => calls.filter((c) => c.table === table);

  return { client, enqueue, calls, callsFor };
}

// ---------------------------------------------------------------------------
// Request + fixture helpers
// ---------------------------------------------------------------------------

const QUESTION_ID = "question-1";
const ADMIN_ID = "admin-user";
const CREATOR_ID = "creator-user";
const OTHER_CREATOR_ID = "other-creator";
const REVIEWER_ID = "reviewer-user";

function makeRequest(options: {
  method?: string;
  userId?: string | null;
  role?: string | null;
  permissions?: string;
  body?: any;
}): NextRequest {
  const headers: Record<string, string> = {};
  if (options.userId) headers["x-user-id"] = options.userId;
  if (options.role) headers["x-user-role"] = options.role;
  if (options.permissions) headers["x-user-permissions"] = options.permissions;
  return createMockRequest({
    method: options.method ?? "PATCH",
    url: `http://localhost:3000/api/admin/questions/${QUESTION_ID}`,
    headers,
    body: options.body ?? {},
  });
}

const routeParams = { params: Promise.resolve({ id: QUESTION_ID }) };

const MINIMAL_BODY = { questionData: { title: "Updated title" } };

describe("PATCH /api/admin/questions/[id]", () => {
  let supabase: ReturnType<typeof createSupabaseMock>;
  const save = saveQuestion as unknown as ReturnType<typeof vi.fn>;
  const transition = transitionQuestion as unknown as ReturnType<typeof vi.fn>;

  function saved(overrides: Partial<SaveResult> = {}): SaveResult {
    return {
      question_id: QUESTION_ID,
      status: "draft",
      reviewer_id: null,
      created_by: CREATOR_ID,
      title: "Updated title",
      update_type: "edit",
      version: { major: 1, minor: 0, patch: 0 },
      version_id: "version-1",
      ...overrides,
    };
  }

  function withCurrent(status: string, reviewer_id: string | null = null) {
    supabase.enqueue("questions", { data: { id: QUESTION_ID, status, reviewer_id }, error: null });
  }

  const writer = { userId: CREATOR_ID, role: "user", permissions: "create_questions" };

  beforeEach(() => {
    vi.clearAllMocks();
    supabase = createSupabaseMock();
    (createServiceRoleClient as any).mockReturnValue(supabase.client);
    save.mockResolvedValue(saved());
  });

  it("requires a signed-in user", async () => {
    const res = await PATCH(makeRequest({ userId: null, body: MINIMAL_BODY }), routeParams);
    expect(res.status).toBe(401);
    expect(save).not.toHaveBeenCalled();
  });

  it("404s when the question does not exist", async () => {
    supabase.enqueue("questions", { data: null, error: null });
    const res = await PATCH(makeRequest({ ...writer, body: MINIMAL_BODY }), routeParams);
    expect(res.status).toBe(404);
    expect(save).not.toHaveBeenCalled();
  });

  it("maps the edit form body to the save payload", async () => {
    withCurrent("draft");
    const res = await PATCH(
      makeRequest({
        ...writer,
        body: {
          questionData: {
            title: "New title",
            stem: "",
            teaching_point: "TP",
            question_references: null,
            anki_card_id: 123,
            question_set_id: "set-1",
          },
          categoryId: "cat-1",
          answerOptions: [
            { id: "opt-1", text: "A", is_correct: true, explanation: "" },
            { text: "B", is_correct: false, explanation: "because" },
          ],
          questionImages: [{ image_id: "img-1", question_section: "stem", order_index: 3 }],
          tagIds: ["tag-1", null, ""],
          changeSummary: "tidied",
        },
      }),
      routeParams
    );
    expect(res.status).toBe(200);
    expect(save).toHaveBeenCalledWith({
      actor: CREATOR_ID,
      questionId: QUESTION_ID,
      payload: {
        title: "New title",
        teaching_point: "TP",
        question_references: null,
        question_set_id: "set-1",
        anki_card_id: "123",
        category_id: "cat-1",
        options: [
          { id: "opt-1", text: "A", is_correct: true, explanation: null },
          { text: "B", is_correct: false, explanation: "because" },
        ],
        images: [{ image_id: "img-1", question_section: "stem" }],
        tag_ids: ["tag-1"],
      },
      changeSummary: "tidied",
      updateType: null,
    });
    expect(transition).not.toHaveBeenCalled();
  });

  it("edits of a published question default to a patch", async () => {
    withCurrent("published", REVIEWER_ID);
    save.mockResolvedValue(
      saved({
        status: "published",
        update_type: "patch",
        version: { major: 1, minor: 0, patch: 1 },
      })
    );
    const res = await PATCH(makeRequest({ ...writer, body: MINIMAL_BODY }), routeParams);
    const body = await getResponseJson(res);
    expect(save.mock.calls[0][0].updateType).toBe("patch");
    expect(save.mock.calls[0][0].payload.reviewer_id).toBeUndefined();
    expect(body.message).toBe("Question updated to version 1.0.1");
    expect(body.question).toMatchObject({ version_patch: 1, status: "published" });
  });

  it("a minor edit sends the reviewer and notifies them when it goes back to review", async () => {
    withCurrent("flagged", REVIEWER_ID);
    save.mockResolvedValue(
      saved({
        status: "pending_review",
        reviewer_id: REVIEWER_ID,
        update_type: "minor",
        version: { major: 1, minor: 1, patch: 0 },
      })
    );
    const res = await PATCH(
      makeRequest({
        ...writer,
        body: { ...MINIMAL_BODY, updateType: "minor", isPatchEdit: false, reviewerId: REVIEWER_ID },
      }),
      routeParams
    );
    expect(res.status).toBe(200);
    expect(save.mock.calls[0][0]).toMatchObject({
      updateType: "minor",
      payload: { reviewer_id: REVIEWER_ID },
    });
    expect(transition).not.toHaveBeenCalled();
    expect(notifyTransition).toHaveBeenCalledWith(
      expect.objectContaining({ action: "submit", reviewer_id: REVIEWER_ID }),
      CREATOR_ID
    );
  });

  it("isPatchEdit wins over a minor update type", async () => {
    withCurrent("published");
    await PATCH(
      makeRequest({ ...writer, body: { ...MINIMAL_BODY, updateType: "minor", isPatchEdit: true } }),
      routeParams
    );
    expect(save.mock.calls[0][0].updateType).toBe("patch");
  });

  it.each([
    ["draft", "pending_review", "submit"],
    ["draft", "published", "approve"],
    ["draft", "archived", "archive"],
    ["archived", "draft", "restore"],
  ])("a status change from %s to %s runs the %s action after saving", async (from, to, action) => {
    withCurrent(from, REVIEWER_ID);
    transition.mockResolvedValue({
      question_id: QUESTION_ID,
      action,
      status: to,
      version_id: "v2",
    });
    const res = await PATCH(
      makeRequest({ ...writer, body: { questionData: { title: "T", status: to } } }),
      routeParams
    );
    const body = await getResponseJson(res);
    expect(res.status).toBe(200);
    expect(transition).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: CREATOR_ID,
        questionId: QUESTION_ID,
        action,
        reviewerId: REVIEWER_ID,
      })
    );
    expect(save.mock.invocationCallOrder[0]).toBeLessThan(transition.mock.invocationCallOrder[0]);
    expect(body.question.status).toBe(to);
    expect(body.versionId).toBe("v2");
  });

  it("refuses a status the edit form cannot set, before saving", async () => {
    withCurrent("draft");
    const res = await PATCH(
      makeRequest({ ...writer, body: { questionData: { title: "T", status: "rejected" } } }),
      routeParams
    );
    expect(res.status).toBe(400);
    expect(save).not.toHaveBeenCalled();
  });

  it("says the edit was saved when only the status change was refused", async () => {
    withCurrent("draft");
    transition.mockRejectedValue(
      new QuestionWriteError("Question is incomplete: teaching point", 400, "PBV01")
    );
    const res = await PATCH(
      makeRequest({
        ...writer,
        body: { questionData: { title: "T", status: "pending_review" }, reviewerId: REVIEWER_ID },
      }),
      routeParams
    );
    expect(res.status).toBe(400);
    expect((await getResponseJson(res)).error).toBe(
      "Your changes were saved, but the status was not changed: Question is incomplete: teaching point"
    );
    expect(revalidateQuestions).toHaveBeenCalled();
  });

  it.each([
    [403, "PBA01"],
    [404, "PBN01"],
    [400, "PBV01"],
  ])("a refused save returns %i", async (status, code) => {
    withCurrent("draft");
    save.mockRejectedValue(new QuestionWriteError("nope", status, code));
    const res = await PATCH(makeRequest({ ...writer, body: MINIMAL_BODY }), routeParams);
    expect(res.status).toBe(status);
    expect(revalidateQuestions).not.toHaveBeenCalled();
  });

  it("an unexpected failure is a 500 without details", async () => {
    withCurrent("draft");
    save.mockRejectedValue(new Error("boom"));
    const res = await PATCH(makeRequest({ ...writer, body: MINIMAL_BODY }), routeParams);
    expect(res.status).toBe(500);
    expect(await getResponseJson(res)).toEqual({ error: "Internal server error" });
  });
});

describe("GET /api/admin/questions/[id]", () => {
  let supabase: ReturnType<typeof createSupabaseMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    supabase = createSupabaseMock();
    (createServiceRoleClient as any).mockReturnValue(supabase.client);
  });

  function makeFullQuestion(overrides: Record<string, any> = {}) {
    return {
      id: QUESTION_ID,
      title: "Q title",
      stem: "Q stem",
      difficulty: "medium",
      teaching_point: "TP",
      question_references: null,
      status: "draft",
      question_set_id: null,
      category_id: null,
      lesson: null,
      topic: null,
      anki_card_id: null,
      anki_deck_name: null,
      created_by: CREATOR_ID,
      updated_by: CREATOR_ID,
      reviewer_id: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      version_major: 1,
      version_minor: 0,
      version_patch: 0,
      question_set: null,
      category: null,
      created_by_user: { first_name: "Jane", last_name: "Doe" },
      updated_by_user: { first_name: "Jane", last_name: "Doe" },
      question_images: [],
      question_options: [],
      question_tags: [{ tag: { id: "tag-1", name: "Tag One", created_at: "2026-01-01" } }],
      ...overrides,
    };
  }

  it("returns 401 when unauthenticated", async () => {
    const request = makeRequest({ method: "GET", userId: null, role: null });

    const response = await GET(request, routeParams);
    const json = await getResponseJson(response);

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 404 when the question does not exist", async () => {
    supabase.enqueue("questions", { data: null, error: { message: "no rows" } });
    const request = makeRequest({ method: "GET", userId: ADMIN_ID, role: "admin" });

    const response = await GET(request, routeParams);

    expect(response.status).toBe(404);
  });

  it("returns 403 when a creator requests another creator's question", async () => {
    supabase.enqueue(
      "questions",
      { data: makeFullQuestion({ created_by: OTHER_CREATOR_ID }), error: null }, // simple fetch
      { data: makeFullQuestion({ created_by: OTHER_CREATOR_ID }), error: null } // full fetch
    );
    const request = makeRequest({
      method: "GET",
      userId: CREATOR_ID,
      role: "user",
      permissions: "create_questions",
    });

    const response = await GET(request, routeParams);
    const json = await getResponseJson(response);

    expect(response.status).toBe(403);
    expect(json.error).toBe("Insufficient permissions to access this question");
  });

  it("allows a reviewer to read a pending_review question", async () => {
    const question = makeFullQuestion({ status: "pending_review", created_by: OTHER_CREATOR_ID });
    supabase.enqueue("questions", { data: question, error: null }, { data: question, error: null });
    const request = makeRequest({
      method: "GET",
      userId: REVIEWER_ID,
      role: "user",
      permissions: "review_questions",
    });

    const response = await GET(request, routeParams);

    expect(response.status).toBe(200);
  });

  it("returns the question with flattened tags and user names for admin", async () => {
    const question = makeFullQuestion();
    supabase.enqueue("questions", { data: question, error: null }, { data: question, error: null });
    const request = makeRequest({ method: "GET", userId: ADMIN_ID, role: "admin" });

    const response = await GET(request, routeParams);
    const json = await getResponseJson(response);

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.question.tags).toEqual([
      { id: "tag-1", name: "Tag One", created_at: "2026-01-01" },
    ]);
    expect(json.question.created_by_name).toBe("Jane Doe");
    expect(json.question.updated_by_name).toBe("Jane Doe");
  });
});
