/**
 * Admin Question Detail API Tests
 *
 * Characterization tests for GET/PATCH /api/admin/questions/[id]
 *
 * The PATCH permission matrix (derived from the handler):
 *
 * | Question status      | admin | creator (own)                | creator (other's)       | reviewer (assigned)   | reviewer (other)      | user |
 * |----------------------|-------|------------------------------|-------------------------|-----------------------|-----------------------|------|
 * | draft / rejected     | allow | allow                        | 403                     | 403                   | 403                   | 403  |
 * | pending_review       | allow | allow                        | 403                     | allow                 | 403                   | 403  |
 * | published, patch     | allow | allow                        | 403                     | allow (any published) | allow (any published) | 403  |
 * | published, non-patch | allow | allow (minor/major req. rev) | allow (role-only check) | 403                   | 403                   | 403  |
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
const PLAIN_USER_ID = "plain-user";

function makeRequest(options: {
  method?: string;
  userId?: string | null;
  role?: string | null;
  body?: any;
}): NextRequest {
  const headers: Record<string, string> = {};
  if (options.userId) headers["x-user-id"] = options.userId;
  if (options.role) headers["x-user-role"] = options.role;
  return createMockRequest({
    method: options.method ?? "PATCH",
    url: `http://localhost:3000/api/admin/questions/${QUESTION_ID}`,
    headers,
    body: options.body ?? {},
  });
}

const routeParams = { params: Promise.resolve({ id: QUESTION_ID }) };

function makeQuestionRow(overrides: Record<string, any> = {}) {
  return {
    id: QUESTION_ID,
    status: "draft",
    created_by: CREATOR_ID,
    reviewer_id: null,
    version_major: 1,
    version_minor: 0,
    version_patch: 0,
    title: "Existing title",
    stem: "Existing stem",
    difficulty: "medium",
    teaching_point: "Existing teaching point",
    question_references: null,
    question_set_id: null,
    category_id: null,
    lesson: null,
    topic: null,
    anki_card_id: null,
    anki_deck_name: null,
    ...overrides,
  };
}

function makeUpdatedRow(overrides: Record<string, any> = {}) {
  return {
    id: QUESTION_ID,
    version_major: 1,
    version_minor: 0,
    version_patch: 0,
    updated_at: "2026-07-02T00:00:00Z",
    status: "draft",
    ...overrides,
  };
}

const MINIMAL_BODY = { questionData: { title: "Updated title" } };

describe("PATCH /api/admin/questions/[id]", () => {
  let supabase: ReturnType<typeof createSupabaseMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    supabase = createSupabaseMock();
    (createServiceRoleClient as any).mockReturnValue(supabase.client);
  });

  /** Queue the current-question fetch, main update, and final refetch. */
  function enqueueMinimalHappyPath(
    questionRow: Record<string, any>,
    updatedRow: Record<string, any> = makeUpdatedRow({ status: questionRow.status })
  ) {
    supabase.enqueue(
      "questions",
      { data: questionRow, error: null }, // current question fetch
      { error: null }, // main update
      { data: updatedRow, error: null } // final refetch
    );
  }

  describe("Authentication", () => {
    it("returns 401 when x-user-id header is missing", async () => {
      const request = makeRequest({ userId: null, role: null, body: MINIMAL_BODY });

      const response = await PATCH(request, routeParams);
      const json = await getResponseJson(response);

      expect(response.status).toBe(401);
      expect(json.error).toBe("Unauthorized");
    });

    it("returns 404 when the question does not exist", async () => {
      supabase.enqueue("questions", { data: null, error: { message: "Row not found" } });
      const request = makeRequest({ userId: ADMIN_ID, role: "admin", body: MINIMAL_BODY });

      const response = await PATCH(request, routeParams);
      const json = await getResponseJson(response);

      expect(response.status).toBe(404);
      expect(json.error).toBe("Question not found");
    });
  });

  describe("Permission matrix: draft/rejected questions", () => {
    it("allows admin to edit any draft question", async () => {
      enqueueMinimalHappyPath(makeQuestionRow({ status: "draft", created_by: CREATOR_ID }));
      const request = makeRequest({ userId: ADMIN_ID, role: "admin", body: MINIMAL_BODY });

      const response = await PATCH(request, routeParams);
      const json = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.message).toBe("Question updated successfully");
      expect(json.versionId).toBeNull();
    });

    it("allows creator to edit own draft question", async () => {
      enqueueMinimalHappyPath(makeQuestionRow({ status: "draft", created_by: CREATOR_ID }));
      const request = makeRequest({ userId: CREATOR_ID, role: "creator", body: MINIMAL_BODY });

      const response = await PATCH(request, routeParams);
      const json = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
    });

    it("allows creator to edit own rejected question", async () => {
      enqueueMinimalHappyPath(makeQuestionRow({ status: "rejected", created_by: CREATOR_ID }));
      const request = makeRequest({ userId: CREATOR_ID, role: "creator", body: MINIMAL_BODY });

      const response = await PATCH(request, routeParams);

      expect(response.status).toBe(200);
    });

    it("rejects creator editing another creator's draft question", async () => {
      supabase.enqueue("questions", {
        data: makeQuestionRow({ status: "draft", created_by: OTHER_CREATOR_ID }),
        error: null,
      });
      const request = makeRequest({ userId: CREATOR_ID, role: "creator", body: MINIMAL_BODY });

      const response = await PATCH(request, routeParams);
      const json = await getResponseJson(response);

      expect(response.status).toBe(403);
      expect(json.error).toBe("Insufficient permissions");
      expect(json.message).toBe("You can only edit questions you created.");
    });

    it("rejects reviewer editing a draft question (even one they created)", async () => {
      supabase.enqueue("questions", {
        data: makeQuestionRow({ status: "draft", created_by: REVIEWER_ID }),
        error: null,
      });
      const request = makeRequest({ userId: REVIEWER_ID, role: "reviewer", body: MINIMAL_BODY });

      const response = await PATCH(request, routeParams);
      const json = await getResponseJson(response);

      expect(response.status).toBe(403);
      expect(json.error).toBe("Insufficient permissions");
    });

    it("rejects plain user editing a draft question", async () => {
      supabase.enqueue("questions", {
        data: makeQuestionRow({ status: "draft" }),
        error: null,
      });
      const request = makeRequest({ userId: PLAIN_USER_ID, role: "user", body: MINIMAL_BODY });

      const response = await PATCH(request, routeParams);

      expect(response.status).toBe(403);
    });
  });

  describe("Permission matrix: pending_review questions", () => {
    it("allows assigned reviewer to edit a pending_review question", async () => {
      enqueueMinimalHappyPath(
        makeQuestionRow({
          status: "pending_review",
          created_by: CREATOR_ID,
          reviewer_id: REVIEWER_ID,
        }),
        makeUpdatedRow({ status: "pending_review" })
      );
      const request = makeRequest({ userId: REVIEWER_ID, role: "reviewer", body: MINIMAL_BODY });

      const response = await PATCH(request, routeParams);
      const json = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
    });

    it("rejects non-assigned reviewer editing a pending_review question", async () => {
      supabase.enqueue("questions", {
        data: makeQuestionRow({
          status: "pending_review",
          created_by: CREATOR_ID,
          reviewer_id: "some-other-reviewer",
        }),
        error: null,
      });
      const request = makeRequest({ userId: REVIEWER_ID, role: "reviewer", body: MINIMAL_BODY });

      const response = await PATCH(request, routeParams);
      const json = await getResponseJson(response);

      expect(response.status).toBe(403);
      expect(json.error).toBe("Insufficient permissions");
      expect(json.message).toBe(
        "You can only edit questions you created or are assigned to review."
      );
    });

    it("allows creator to edit own pending_review question", async () => {
      enqueueMinimalHappyPath(
        makeQuestionRow({
          status: "pending_review",
          created_by: CREATOR_ID,
          reviewer_id: REVIEWER_ID,
        }),
        makeUpdatedRow({ status: "pending_review" })
      );
      const request = makeRequest({ userId: CREATOR_ID, role: "creator", body: MINIMAL_BODY });

      const response = await PATCH(request, routeParams);

      expect(response.status).toBe(200);
    });

    it("rejects creator editing another creator's pending_review question", async () => {
      supabase.enqueue("questions", {
        data: makeQuestionRow({
          status: "pending_review",
          created_by: OTHER_CREATOR_ID,
          reviewer_id: REVIEWER_ID,
        }),
        error: null,
      });
      const request = makeRequest({ userId: CREATOR_ID, role: "creator", body: MINIMAL_BODY });

      const response = await PATCH(request, routeParams);

      expect(response.status).toBe(403);
    });

    it("allows admin to edit a pending_review question", async () => {
      enqueueMinimalHappyPath(
        makeQuestionRow({
          status: "pending_review",
          created_by: CREATOR_ID,
          reviewer_id: REVIEWER_ID,
        }),
        makeUpdatedRow({ status: "pending_review" })
      );
      const request = makeRequest({ userId: ADMIN_ID, role: "admin", body: MINIMAL_BODY });

      const response = await PATCH(request, routeParams);

      expect(response.status).toBe(200);
    });
  });

  describe("Permission matrix: published questions", () => {
    /** Queue the published patch-edit path: fetch, main update, version bump, version insert, refetch. */
    function enqueuePublishedPatchEditPath(questionRow: Record<string, any>) {
      supabase.enqueue(
        "questions",
        { data: questionRow, error: null }, // current question fetch
        { error: null }, // main update
        { error: null }, // patch version bump
        {
          data: makeUpdatedRow({
            status: "published",
            version_major: questionRow.version_major,
            version_minor: questionRow.version_minor,
            version_patch: questionRow.version_patch + 1,
          }),
          error: null,
        } // final refetch
      );
      supabase.enqueue("question_versions", { data: { id: "version-1" }, error: null });
    }

    it("allows creator patch edit on own published question", async () => {
      enqueuePublishedPatchEditPath(
        makeQuestionRow({ status: "published", created_by: CREATOR_ID })
      );
      const request = makeRequest({
        userId: CREATOR_ID,
        role: "creator",
        body: { ...MINIMAL_BODY, isPatchEdit: true, patchEditReason: "Fixed typo" },
      });

      const response = await PATCH(request, routeParams);
      const json = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.versionId).toBe("version-1");
    });

    it("rejects creator patch edit on another creator's published question", async () => {
      supabase.enqueue("questions", {
        data: makeQuestionRow({ status: "published", created_by: OTHER_CREATOR_ID }),
        error: null,
      });
      const request = makeRequest({
        userId: CREATOR_ID,
        role: "creator",
        body: { ...MINIMAL_BODY, isPatchEdit: true },
      });

      const response = await PATCH(request, routeParams);
      const json = await getResponseJson(response);

      expect(response.status).toBe(403);
      expect(json.error).toBe("Insufficient permissions for patch edit");
    });

    it("allows reviewer patch edit on any published question", async () => {
      enqueuePublishedPatchEditPath(
        makeQuestionRow({ status: "published", created_by: CREATOR_ID })
      );
      const request = makeRequest({
        userId: REVIEWER_ID,
        role: "reviewer",
        body: { ...MINIMAL_BODY, isPatchEdit: true },
      });

      const response = await PATCH(request, routeParams);

      expect(response.status).toBe(200);
    });

    it("rejects plain user patch edit on a published question", async () => {
      supabase.enqueue("questions", {
        data: makeQuestionRow({ status: "published" }),
        error: null,
      });
      const request = makeRequest({
        userId: PLAIN_USER_ID,
        role: "user",
        body: { ...MINIMAL_BODY, isPatchEdit: true },
      });

      const response = await PATCH(request, routeParams);

      expect(response.status).toBe(403);
    });

    it("rejects reviewer non-patch edit on a published question", async () => {
      supabase.enqueue("questions", {
        data: makeQuestionRow({ status: "published" }),
        error: null,
      });
      const request = makeRequest({ userId: REVIEWER_ID, role: "reviewer", body: MINIMAL_BODY });

      const response = await PATCH(request, routeParams);
      const json = await getResponseJson(response);

      expect(response.status).toBe(403);
      expect(json.error).toBe("Cannot edit published questions");
    });

    it("rejects plain user non-patch edit on a published question", async () => {
      supabase.enqueue("questions", {
        data: makeQuestionRow({ status: "published" }),
        error: null,
      });
      const request = makeRequest({ userId: PLAIN_USER_ID, role: "user", body: MINIMAL_BODY });

      const response = await PATCH(request, routeParams);

      expect(response.status).toBe(403);
    });

    it("allows creator non-patch edit on another creator's published question (role-only check)", async () => {
      // Characterizes current behavior: the non-patch published branch only
      // checks role (admin/creator), not ownership. With no updateType the
      // status is unchanged and no version is created.
      enqueueMinimalHappyPath(
        makeQuestionRow({ status: "published", created_by: OTHER_CREATOR_ID }),
        makeUpdatedRow({ status: "published" })
      );
      const request = makeRequest({ userId: CREATOR_ID, role: "creator", body: MINIMAL_BODY });

      const response = await PATCH(request, routeParams);
      const json = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(json.versionId).toBeNull();
    });

    it("returns 500 when creator makes a minor edit to published question without a reviewer", async () => {
      supabase.enqueue("questions", {
        data: makeQuestionRow({ status: "published", created_by: CREATOR_ID, reviewer_id: null }),
        error: null,
      });
      const request = makeRequest({
        userId: CREATOR_ID,
        role: "creator",
        body: { ...MINIMAL_BODY, updateType: "minor" },
      });

      const response = await PATCH(request, routeParams);
      const json = await getResponseJson(response);

      expect(response.status).toBe(500);
      expect(json.error).toContain("This minor edit requires review, but no reviewer is assigned");
    });
  });

  describe("Status transition rules", () => {
    it("returns 500 when transitioning to pending_review without a reviewer", async () => {
      supabase.enqueue("questions", {
        data: makeQuestionRow({ status: "draft", created_by: CREATOR_ID, reviewer_id: null }),
        error: null,
      });
      const request = makeRequest({
        userId: CREATOR_ID,
        role: "creator",
        body: { questionData: { title: "Updated", status: "pending_review" } },
      });

      const response = await PATCH(request, routeParams);
      const json = await getResponseJson(response);

      expect(response.status).toBe(500);
      expect(json.error).toContain("Cannot set status to pending_review without a reviewer");
    });

    it("moves published question to pending_review on minor edit when a reviewer is assigned", async () => {
      supabase.enqueue(
        "questions",
        {
          data: makeQuestionRow({
            status: "published",
            created_by: CREATOR_ID,
            reviewer_id: null,
            version_major: 2,
            version_minor: 3,
            version_patch: 1,
          }),
          error: null,
        },
        { error: null }, // main update
        { error: null }, // minor version bump
        {
          data: makeUpdatedRow({
            status: "pending_review",
            version_major: 2,
            version_minor: 4,
            version_patch: 0,
          }),
          error: null,
        }
      );
      supabase.enqueue("question_versions", { data: { id: "version-minor-1" }, error: null });

      const request = makeRequest({
        userId: CREATOR_ID,
        role: "creator",
        body: { ...MINIMAL_BODY, updateType: "minor", reviewerId: REVIEWER_ID },
      });

      const response = await PATCH(request, routeParams);
      const json = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(json.versionId).toBe("version-minor-1");
      expect(json.message).toBe("Question updated to version 2.4.0");

      // Main update must set status pending_review and the reviewer.
      const questionsUpdates = supabase
        .callsFor("questions")
        .filter((c) => c.builder.update.mock.calls.length > 0);
      const mainUpdatePayload = questionsUpdates[0].builder.update.mock.calls[0][0];
      expect(mainUpdatePayload.status).toBe("pending_review");
      expect(mainUpdatePayload.reviewer_id).toBe(REVIEWER_ID);

      // Minor bump: version_minor +1, patch reset to 0.
      const versionBumpPayload = questionsUpdates[1].builder.update.mock.calls[0][0];
      expect(versionBumpPayload).toMatchObject({
        version_major: 2,
        version_minor: 4,
        version_patch: 0,
      });

      // Version history entry recorded as minor update.
      const versionInsert = supabase.callsFor("question_versions")[0];
      expect(versionInsert.builder.insert.mock.calls[0][0]).toMatchObject({
        question_id: QUESTION_ID,
        version_major: 2,
        version_minor: 4,
        version_patch: 0,
        update_type: "minor",
        changed_by: CREATOR_ID,
      });
    });
  });

  describe("Full update orchestration", () => {
    it("updates question fields, answer options, images, tags, and category together", async () => {
      const currentQuestion = makeQuestionRow({ status: "draft", created_by: CREATOR_ID });
      supabase.enqueue(
        "questions",
        { data: currentQuestion, error: null }, // current fetch
        { error: null }, // main update
        { error: null }, // category update
        { data: makeUpdatedRow(), error: null } // final refetch
      );
      supabase.enqueue(
        "question_options",
        {
          data: [
            { id: "opt-1", text: "Old A", is_correct: true, explanation: null, order_index: 0 },
            { id: "opt-2", text: "Old B", is_correct: false, explanation: null, order_index: 1 },
          ],
          error: null,
        }, // existing options fetch
        { error: null }, // update existing option opt-1
        { error: null }, // insert new option
        { error: null } // delete removed option opt-2
      );
      supabase.enqueue("quiz_attempts", { data: [], error: null }); // no referenced options
      supabase.enqueue(
        "question_images",
        { error: null }, // delete existing
        { error: null } // insert new
      );
      supabase.enqueue(
        "question_tags",
        { error: null }, // delete existing
        { error: null } // insert new
      );

      const request = makeRequest({
        userId: CREATOR_ID,
        role: "creator",
        body: {
          questionData: {
            title: "New title",
            stem: "New stem",
            difficulty: "hard",
            teaching_point: "New teaching point",
            question_references: "Ref 1",
            lesson: "Lesson 1",
            topic: "Topic 1",
            anki_card_id: 1234567890,
            anki_deck_name: "Deck",
          },
          answerOptions: [
            { id: "opt-1", text: "Updated A", is_correct: false, explanation: "Nope" },
            { text: "Brand new B", is_correct: true, explanation: "Yes" },
          ],
          questionImages: [{ image_id: "img-1", question_section: "stem" }],
          tagIds: ["tag-1", "tag-2", null, ""],
          categoryId: "cat-1",
        },
      });

      const response = await PATCH(request, routeParams);
      const json = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.message).toBe("Question updated successfully");
      expect(revalidateQuestions).toHaveBeenCalledWith({
        questionId: QUESTION_ID,
        includeDashboard: true,
      });

      // Main question update payload.
      const questionsCalls = supabase.callsFor("questions");
      const mainUpdatePayload = questionsCalls[1].builder.update.mock.calls[0][0];
      expect(mainUpdatePayload).toMatchObject({
        title: "New title",
        stem: "New stem",
        difficulty: "hard",
        teaching_point: "New teaching point",
        question_references: "Ref 1",
        lesson: "Lesson 1",
        topic: "Topic 1",
        anki_card_id: "1234567890", // number coerced to string for the text column
        anki_deck_name: "Deck",
        updated_by: CREATOR_ID,
      });
      expect(mainUpdatePayload.status).toBeUndefined();
      expect(questionsCalls[1].builder.eq).toHaveBeenCalledWith("id", QUESTION_ID);

      // Answer options: update existing, insert new, delete removed.
      const optionCalls = supabase.callsFor("question_options");
      expect(optionCalls[1].builder.update.mock.calls[0][0]).toMatchObject({
        text: "Updated A",
        is_correct: false,
        explanation: "Nope",
        order_index: 0,
      });
      expect(optionCalls[1].builder.eq).toHaveBeenCalledWith("id", "opt-1");
      expect(optionCalls[2].builder.insert.mock.calls[0][0]).toEqual([
        {
          question_id: QUESTION_ID,
          text: "Brand new B",
          is_correct: true,
          explanation: "Yes",
          order_index: 1,
        },
      ]);
      expect(optionCalls[3].builder.delete).toHaveBeenCalled();
      expect(optionCalls[3].builder.in).toHaveBeenCalledWith("id", ["opt-2"]);

      // Images: delete-all then insert with order index.
      const imageCalls = supabase.callsFor("question_images");
      expect(imageCalls[0].builder.delete).toHaveBeenCalled();
      expect(imageCalls[0].builder.eq).toHaveBeenCalledWith("question_id", QUESTION_ID);
      expect(imageCalls[1].builder.insert.mock.calls[0][0]).toEqual([
        {
          question_id: QUESTION_ID,
          image_id: "img-1",
          question_section: "stem",
          order_index: 0,
        },
      ]);

      // Tags: delete-all then insert only valid ids (null/empty filtered).
      const tagCalls = supabase.callsFor("question_tags");
      expect(tagCalls[0].builder.delete).toHaveBeenCalled();
      expect(tagCalls[1].builder.insert.mock.calls[0][0]).toEqual([
        { question_id: QUESTION_ID, tag_id: "tag-1" },
        { question_id: QUESTION_ID, tag_id: "tag-2" },
      ]);

      // Category: separate update on questions.
      const categoryUpdatePayload = questionsCalls[2].builder.update.mock.calls[0][0];
      expect(categoryUpdatePayload).toEqual({ category_id: "cat-1" });
    });

    it("keeps answer options that are referenced by quiz attempts instead of deleting them", async () => {
      supabase.enqueue(
        "questions",
        { data: makeQuestionRow(), error: null },
        { error: null },
        { data: makeUpdatedRow(), error: null }
      );
      supabase.enqueue(
        "question_options",
        {
          data: [
            { id: "opt-1", text: "A", is_correct: true, explanation: null, order_index: 0 },
            { id: "opt-2", text: "B", is_correct: false, explanation: null, order_index: 1 },
          ],
          error: null,
        },
        { error: null } // update for opt-1; no insert, no delete expected
      );
      supabase.enqueue("quiz_attempts", {
        data: [{ selected_answer_id: "opt-2" }],
        error: null,
      });

      const request = makeRequest({
        userId: ADMIN_ID,
        role: "admin",
        body: {
          answerOptions: [{ id: "opt-1", text: "A2", is_correct: true }],
        },
      });

      const response = await PATCH(request, routeParams);

      expect(response.status).toBe(200);
      // opt-2 is referenced by a quiz attempt: no delete call should be issued.
      const optionCalls = supabase.callsFor("question_options");
      const deleteCalls = optionCalls.filter((c) => c.builder.delete.mock.calls.length > 0);
      expect(deleteCalls).toHaveLength(0);
    });
  });

  describe("Versioning", () => {
    it("creates a patch version entry on patch edit of a published question", async () => {
      supabase.enqueue(
        "questions",
        {
          data: makeQuestionRow({
            status: "published",
            created_by: CREATOR_ID,
            version_major: 1,
            version_minor: 2,
            version_patch: 3,
          }),
          error: null,
        },
        { error: null }, // main update
        { error: null }, // patch version bump
        {
          data: makeUpdatedRow({
            status: "published",
            version_major: 1,
            version_minor: 2,
            version_patch: 4,
          }),
          error: null,
        }
      );
      supabase.enqueue("question_versions", { data: { id: "version-patch-1" }, error: null });

      const request = makeRequest({
        userId: ADMIN_ID,
        role: "admin",
        body: {
          questionData: { title: "Typo fixed" },
          isPatchEdit: true,
          patchEditReason: "Fixed a typo",
        },
      });

      const response = await PATCH(request, routeParams);
      const json = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(json.versionId).toBe("version-patch-1");
      expect(json.message).toBe("Question updated to version 1.2.4");

      // Patch bump on the questions row.
      const questionsCalls = supabase.callsFor("questions");
      const bumpPayload = questionsCalls[2].builder.update.mock.calls[0][0];
      expect(bumpPayload.version_patch).toBe(4);

      // Version history entry.
      const versionInsert = supabase.callsFor("question_versions")[0];
      expect(versionInsert.builder.insert.mock.calls[0][0]).toMatchObject({
        question_id: QUESTION_ID,
        version_major: 1,
        version_minor: 2,
        version_patch: 4,
        update_type: "patch",
        change_summary: "Fixed a typo",
        changed_by: ADMIN_ID,
      });
    });

    it("initializes version 1.0.0 and creates an initial version entry on first publish", async () => {
      supabase.enqueue(
        "questions",
        {
          data: makeQuestionRow({
            status: "draft",
            created_by: CREATOR_ID,
            version_major: 0,
            version_minor: 0,
            version_patch: 0,
          }),
          error: null,
        },
        { error: null }, // main update
        {
          data: makeUpdatedRow({
            status: "published",
            version_major: 1,
            version_minor: 0,
            version_patch: 0,
          }),
          error: null,
        }
      );
      supabase.enqueue("question_versions", { data: { id: "version-initial" }, error: null });

      const request = makeRequest({
        userId: ADMIN_ID,
        role: "admin",
        body: { questionData: { title: "Publishing now", status: "published" } },
      });

      const response = await PATCH(request, routeParams);
      const json = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(json.versionId).toBe("version-initial");
      expect(json.message).toBe("Question updated to version 1.0.0");

      // Main update sets status and initializes semver to 1.0.0.
      const questionsCalls = supabase.callsFor("questions");
      const mainUpdatePayload = questionsCalls[1].builder.update.mock.calls[0][0];
      expect(mainUpdatePayload).toMatchObject({
        status: "published",
        version_major: 1,
        version_minor: 0,
        version_patch: 0,
      });

      // Initial version history entry.
      const versionInsert = supabase.callsFor("question_versions")[0];
      expect(versionInsert.builder.insert.mock.calls[0][0]).toMatchObject({
        question_id: QUESTION_ID,
        version_major: 1,
        version_minor: 0,
        version_patch: 0,
        update_type: "initial",
        change_summary: "Initial publication",
        changed_by: ADMIN_ID,
      });
    });

    it("does not create a version entry for edits to non-published questions", async () => {
      enqueueMinimalHappyPath(makeQuestionRow({ status: "draft" }));
      const request = makeRequest({ userId: ADMIN_ID, role: "admin", body: MINIMAL_BODY });

      const response = await PATCH(request, routeParams);
      const json = await getResponseJson(response);

      expect(response.status).toBe(200);
      expect(json.versionId).toBeNull();
      expect(supabase.callsFor("question_versions")).toHaveLength(0);
    });
  });

  describe("Error handling", () => {
    it("returns 500 with the failure message when the main update fails", async () => {
      supabase.enqueue(
        "questions",
        { data: makeQuestionRow(), error: null },
        { error: { message: "column does not exist" } }
      );
      const request = makeRequest({ userId: ADMIN_ID, role: "admin", body: MINIMAL_BODY });

      const response = await PATCH(request, routeParams);
      const json = await getResponseJson(response);

      expect(response.status).toBe(500);
      expect(json.error).toBe("Failed to update question: column does not exist");
    });
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
    const request = makeRequest({ method: "GET", userId: CREATOR_ID, role: "creator" });

    const response = await GET(request, routeParams);
    const json = await getResponseJson(response);

    expect(response.status).toBe(403);
    expect(json.error).toBe("Insufficient permissions to access this question");
  });

  it("allows a reviewer to read a pending_review question", async () => {
    const question = makeFullQuestion({ status: "pending_review", created_by: OTHER_CREATOR_ID });
    supabase.enqueue("questions", { data: question, error: null }, { data: question, error: null });
    const request = makeRequest({ method: "GET", userId: REVIEWER_ID, role: "reviewer" });

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
