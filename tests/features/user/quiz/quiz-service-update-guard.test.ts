/**
 * quizService.updateQuizSession — TOCTOU WHERE-clause guard.
 *
 * Regression test for the documented timer-expiry race (CLAUDE.md "Read-then-write
 * UPDATEs in API routes race themselves"): when an update is NOT marking the session
 * `completed`, updateQuizSession must add `.neq("status", "completed")` so a stale
 * "demote me to in_progress/paused" write matches zero rows once /complete has
 * committed. When the update IS the terminal `completed` transition, the guard must
 * be omitted so the legit completion isn't blocked.
 *
 * The session route tests mock quizService entirely, so this is the only place the
 * real WHERE-clause logic is exercised. If a refactor drops the `.neq(...)` guard
 * (back to a plain `.eq("id")` update), these tests fail.
 */
import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { quizService } from "@/features/user/quiz/services/quiz-service";

function makeMockSupabase() {
  // Single chainable, thenable query object: update/eq/neq all return it, and it
  // resolves to { error: null } when awaited.
  const query: Record<string, unknown> = {};
  query.update = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.neq = vi.fn(() => query);
  query.then = (resolve: (v: { error: null }) => unknown) => resolve({ error: null });
  const client = { from: vi.fn(() => query) } as unknown as SupabaseClient;
  return {
    client,
    query: query as {
      update: ReturnType<typeof vi.fn>;
      eq: ReturnType<typeof vi.fn>;
      neq: ReturnType<typeof vi.fn>;
      from?: unknown;
    },
  };
}

const SESSION_ID = "session-123";

describe("quizService.updateQuizSession — TOCTOU guard", () => {
  it("adds .neq('status','completed') when demoting to in_progress (stale PATCH path)", async () => {
    const { client, query } = makeMockSupabase();
    await quizService.updateQuizSession(SESSION_ID, { status: "in_progress" }, client);

    expect(query.eq).toHaveBeenCalledWith("id", SESSION_ID);
    expect(query.neq).toHaveBeenCalledWith("status", "completed");
  });

  it("adds the guard for a status-less progress update (status is undefined ≠ completed)", async () => {
    const { client, query } = makeMockSupabase();
    await quizService.updateQuizSession(SESSION_ID, { currentQuestionIndex: 3 }, client);

    expect(query.neq).toHaveBeenCalledWith("status", "completed");
  });

  it("OMITS the guard when the update itself marks the session completed", async () => {
    const { client, query } = makeMockSupabase();
    await quizService.updateQuizSession(
      SESSION_ID,
      { status: "completed", completedAt: new Date().toISOString() },
      client
    );

    expect(query.eq).toHaveBeenCalledWith("id", SESSION_ID);
    expect(query.neq).not.toHaveBeenCalled();
  });

  it("propagates a DB error (so callers can react, not silently swallow)", async () => {
    const query: Record<string, unknown> = {};
    query.update = vi.fn(() => query);
    query.eq = vi.fn(() => query);
    query.neq = vi.fn(() => query);
    query.then = (resolve: (v: { error: { message: string } }) => unknown) =>
      resolve({ error: { message: "boom" } });
    const client = { from: vi.fn(() => query) } as unknown as SupabaseClient;

    await expect(
      quizService.updateQuizSession(SESSION_ID, { status: "paused" }, client)
    ).rejects.toBeTruthy();
  });
});
